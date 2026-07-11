import { readAtlasPageReferences } from '../../model'
import { PrskRemoteError } from './errors'
import {
  buildPrskRemoteModelUrls,
  resolvePrskRemoteAtlasPages,
} from './modelPaths'
import {
  createRemoteOperationSignal,
  decodeFatalUtf8,
  fetchPrskRemoteResponse,
  readLimitedResponseBody,
  throwIfRemoteOperationAborted,
} from './network'
import {
  PRSK_REMOTE_LIMITS,
  type PrskRemoteModelInput,
  type PrskRemoteModelRequest,
  type PrskRemoteResourceKind,
} from './types'

export interface PrskRemoteResourceSourceOptions {
  readonly fetcher?: typeof fetch
  readonly timeoutMs?: number
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

function assertPngSignature(buffer: ArrayBuffer, path: string): void {
  const bytes = new Uint8Array(buffer)
  if (
    bytes.byteLength < PNG_SIGNATURE.byteLength ||
    PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)
  ) {
    throw new PrskRemoteError(
      'REMOTE_CONTENT_INVALID',
      `원격 atlas 페이지가 올바른 PNG가 아닙니다: ${path}`,
      { path, resource: 'png' },
    )
  }
}

function modelReadOptions(
  signal: AbortSignal,
  resource: PrskRemoteResourceKind,
  url: string,
) {
  return {
    signal,
    resource,
    tooLargeCode: 'REMOTE_RESOURCE_TOO_LARGE' as const,
    url,
  }
}

export class PrskRemoteResourceSource {
  readonly #fetcher?: typeof fetch
  readonly #timeoutMs: number

  constructor(options: PrskRemoteResourceSourceOptions = {}) {
    this.#fetcher = options.fetcher
    this.#timeoutMs = options.timeoutMs ?? PRSK_REMOTE_LIMITS.timeoutMs
  }

  async load(request: PrskRemoteModelRequest): Promise<PrskRemoteModelInput> {
    const urls = buildPrskRemoteModelUrls(
      request.catalog,
      request.characterId,
    )
    const operation = createRemoteOperationSignal(
      request.signal,
      this.#timeoutMs,
    )
    const fetcher = this.#fetcher ?? fetch

    try {
      const skeletonResponse = await fetchPrskRemoteResponse(
        fetcher,
        urls.skeletonUrl,
        operation.signal,
        'skeleton',
      )
      const skeletonData = await readLimitedResponseBody(
        skeletonResponse,
        PRSK_REMOTE_LIMITS.skeletonBytes,
        modelReadOptions(operation.signal, 'skeleton', urls.skeletonUrl),
      )

      const atlasResponse = await fetchPrskRemoteResponse(
        fetcher,
        urls.atlasUrl,
        operation.signal,
        'atlas',
      )
      const atlasData = await readLimitedResponseBody(
        atlasResponse,
        PRSK_REMOTE_LIMITS.atlasBytes,
        modelReadOptions(operation.signal, 'atlas', urls.atlasUrl),
      )
      const atlasText = decodeFatalUtf8(atlasData, 'atlas')

      let pageReferences: readonly string[]
      try {
        pageReferences = readAtlasPageReferences(atlasText)
      } catch (error) {
        throw new PrskRemoteError(
          'REMOTE_CONTENT_INVALID',
          '원격 atlas에서 PNG 페이지 목록을 읽을 수 없습니다.',
          { cause: error, resource: 'atlas', url: urls.atlasUrl },
        )
      }
      const pages = resolvePrskRemoteAtlasPages(urls, pageReferences)
      const atlasPages = new Map<string, Blob>()
      let totalPngBytes = 0

      for (const page of pages) {
        const response = await fetchPrskRemoteResponse(
          fetcher,
          page.url,
          operation.signal,
          'png',
        )
        const pngData = await readLimitedResponseBody(
          response,
          PRSK_REMOTE_LIMITS.pngBytes - totalPngBytes,
          modelReadOptions(operation.signal, 'png', page.url),
        )
        assertPngSignature(pngData, page.path)
        totalPngBytes += pngData.byteLength
        atlasPages.set(
          page.path,
          new Blob([pngData], { type: 'image/png' }),
        )
      }

      throwIfRemoteOperationAborted(operation.signal)
      return Object.freeze({
        skeletonData,
        sourceOrigin: new URL(request.catalog.assetBaseUrl).origin,
        atlasBundle: Object.freeze({
          sourceName: request.characterId,
          atlasPath: 'sekai_atlas.atlas',
          atlasText,
          atlasPages,
        }),
      })
    } finally {
      operation.cleanup()
    }
  }
}

export const prskRemoteResourceSource = new PrskRemoteResourceSource()
