import { PrskRemoteError } from './errors'
import {
  parsePrskChibiViewerCatalogBundle,
  parseCustomPrskCatalogManifest,
  resolvePrskChibiViewerBundleUrl,
} from './catalogParsers'
import {
  createRemoteOperationSignal,
  decodeFatalUtf8,
  fetchPrskRemoteResponse,
  readLimitedResponseBody,
  throwIfRemoteOperationAborted,
} from './network'
import { assertPrskRemoteProviderConfig } from './provider'
import {
  PRSK_REMOTE_LIMITS,
  type PrskRemoteCatalog,
  type PrskRemoteCatalogRequest,
  type PrskRemoteCharacterOption,
  type PrskRemoteProviderConfig,
} from './types'

export interface PrskRemoteCatalogSourceOptions {
  readonly fetcher?: typeof fetch
  readonly timeoutMs?: number
}

function invalidCatalog(message: string, cause?: unknown): never {
  throw new PrskRemoteError(
    'REMOTE_CATALOG_INVALID',
    message,
    cause === undefined
      ? { resource: 'catalog' }
      : { cause, resource: 'catalog' },
  )
}

function parseJson(buffer: ArrayBuffer): unknown {
  const text = decodeFatalUtf8(buffer, 'catalog')
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    return invalidCatalog('원격 catalog가 올바른 JSON이 아닙니다.', error)
  }
}

export class PrskRemoteCatalogSource {
  readonly #fetcher?: typeof fetch
  readonly #timeoutMs: number

  constructor(options: PrskRemoteCatalogSourceOptions = {}) {
    this.#fetcher = options.fetcher
    this.#timeoutMs = options.timeoutMs ?? PRSK_REMOTE_LIMITS.timeoutMs
  }

  async load(request: PrskRemoteCatalogRequest): Promise<PrskRemoteCatalog> {
    assertPrskRemoteProviderConfig(request.provider)
    const operation = createRemoteOperationSignal(
      request.signal,
      this.#timeoutMs,
    )

    try {
      const characters = request.provider.kind === 'custom'
        ? await this.#loadCustom(request.provider, operation.signal)
        : await this.#loadPrskChibiViewer(request.provider, operation.signal)
      throwIfRemoteOperationAborted(operation.signal)

      if (characters.length === 0) {
        throw new PrskRemoteError(
          'REMOTE_CATALOG_EMPTY',
          '원격 catalog에 사용할 수 있는 캐릭터가 없습니다.',
          { resource: 'catalog' },
        )
      }

      return Object.freeze({
        providerLabel: request.provider.providerLabel,
        assetBaseUrl: request.provider.assetBaseUrl,
        requestOrigins: Object.freeze([...request.provider.requestOrigins]),
        characters,
      })
    } finally {
      operation.cleanup()
    }
  }

  async #loadCustom(
    provider: Extract<PrskRemoteProviderConfig, { kind: 'custom' }>,
    signal: AbortSignal,
  ): Promise<readonly PrskRemoteCharacterOption[]> {
    const response = await fetchPrskRemoteResponse(
      this.#fetcher ?? fetch,
      provider.catalogUrl,
      signal,
      'catalog',
    )
    const buffer = await readLimitedResponseBody(
      response,
      PRSK_REMOTE_LIMITS.catalogBytes,
      {
        signal,
        resource: 'catalog',
        tooLargeCode: 'REMOTE_CATALOG_TOO_LARGE',
        url: provider.catalogUrl,
      },
    )
    return parseCustomPrskCatalogManifest(parseJson(buffer))
  }

  async #loadPrskChibiViewer(
    provider: Extract<
      PrskRemoteCatalogRequest['provider'],
      { kind: 'prsk-chibi-viewer' }
    >,
    signal: AbortSignal,
  ): Promise<readonly PrskRemoteCharacterOption[]> {
    const fetcher = this.#fetcher ?? fetch
    const htmlResponse = await fetchPrskRemoteResponse(
      fetcher,
      provider.catalogUrl,
      signal,
      'catalog',
    )
    const htmlBuffer = await readLimitedResponseBody(
      htmlResponse,
      PRSK_REMOTE_LIMITS.catalogBytes,
      {
        signal,
        resource: 'catalog',
        tooLargeCode: 'REMOTE_CATALOG_TOO_LARGE',
        url: provider.catalogUrl,
      },
    )
    const bundleUrl = resolvePrskChibiViewerBundleUrl(
      decodeFatalUtf8(htmlBuffer, 'catalog'),
      provider.catalogUrl,
    )
    const bundleResponse = await fetchPrskRemoteResponse(
      fetcher,
      bundleUrl,
      signal,
      'catalog',
    )
    const bundleBuffer = await readLimitedResponseBody(
      bundleResponse,
      PRSK_REMOTE_LIMITS.catalogBytes - htmlBuffer.byteLength,
      {
        signal,
        resource: 'catalog',
        tooLargeCode: 'REMOTE_CATALOG_TOO_LARGE',
        url: bundleUrl,
      },
    )

    return parsePrskChibiViewerCatalogBundle(
      decodeFatalUtf8(bundleBuffer, 'catalog'),
    )
  }
}

export const prskRemoteCatalogSource = new PrskRemoteCatalogSource()
