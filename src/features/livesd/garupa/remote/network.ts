import { GarupaRemoteError, type GarupaRemoteErrorCode } from './errors'
import { resolveGarupaPinnedUrl } from './providerManifest'

const DEFAULT_TIMEOUT_MS = 15_000

export interface FetchGarupaPinnedBytesOptions {
  readonly signal: AbortSignal
  readonly maxBytes: number
  readonly timeoutMs?: number
  readonly expectedBytes?: number
  readonly expectedSha256?: string
  readonly expectedContentTypes?: readonly string[]
  readonly integrityErrorCode?: Extract<
    GarupaRemoteErrorCode,
    'GARUPA_REMOTE_CATALOG_INVALID' | 'GARUPA_REMOTE_SNAPSHOT_INVALID'
  >
}

export interface GarupaPinnedResponse {
  readonly bytes: Uint8Array
  readonly contentType: string
  readonly sha256: string
  readonly url: string
}

function responseTooLarge(maxBytes: number): GarupaRemoteError {
  return new GarupaRemoteError(
    'GARUPA_REMOTE_RESPONSE_TOO_LARGE',
    'Garupa pinned response가 허용 크기를 초과했습니다.',
    { maxBytes },
  )
}

function concatChunks(
  chunks: readonly Uint8Array[],
  byteLength: number,
): Uint8Array {
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength)
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_SNAPSHOT_INVALID',
        'Garupa pinned response의 Content-Length가 올바르지 않습니다.',
      )
    }
    if (parsedLength > maxBytes) throw responseTooLarge(maxBytes)
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) throw responseTooLarge(maxBytes)
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel()
        throw responseTooLarge(maxBytes)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return concatChunks(chunks, byteLength)
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer,
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function fetchGarupaPinnedBytes(
  relativePath: string,
  options: FetchGarupaPinnedBytesOptions,
): Promise<GarupaPinnedResponse> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer.')
  }
  if (options.signal.aborted) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_ABORTED',
      'Garupa pinned request가 취소되었습니다.',
    )
  }

  const url = resolveGarupaPinnedUrl(relativePath)
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  options.signal.addEventListener('abort', onAbort, { once: true })

  try {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
        signal: controller.signal,
      })
    } catch (error) {
      if (timedOut) {
        throw new GarupaRemoteError(
          'GARUPA_REMOTE_TIMEOUT',
          'Garupa pinned request 시간이 초과되었습니다.',
          {},
          { cause: error },
        )
      }
      if (options.signal.aborted) {
        throw new GarupaRemoteError(
          'GARUPA_REMOTE_ABORTED',
          'Garupa pinned request가 취소되었습니다.',
          {},
          { cause: error },
        )
      }
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_NETWORK_OR_CORS',
        'Garupa pinned source에 연결할 수 없습니다.',
        {},
        { cause: error },
      )
    }

    if (!response.ok) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_NETWORK_OR_CORS',
        'Garupa pinned source가 성공 응답을 반환하지 않았습니다.',
        { status: response.status },
      )
    }
    if (response.url && response.url !== url) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_URL_INVALID',
        'Garupa pinned source가 승인 URL 밖의 응답을 반환했습니다.',
      )
    }

    const contentType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase() ?? ''
    if (
      options.expectedContentTypes &&
      !options.expectedContentTypes.includes(contentType)
    ) {
      throw new GarupaRemoteError(
        options.integrityErrorCode ?? 'GARUPA_REMOTE_SNAPSHOT_INVALID',
        'Garupa pinned response의 형식이 올바르지 않습니다.',
        { contentType },
      )
    }

    const bytes = await readBoundedBody(response, options.maxBytes)
    const sha256 = await sha256Hex(bytes)
    if (
      (options.expectedBytes !== undefined &&
        bytes.byteLength !== options.expectedBytes) ||
      (options.expectedSha256 !== undefined &&
        sha256 !== options.expectedSha256)
    ) {
      throw new GarupaRemoteError(
        options.integrityErrorCode ?? 'GARUPA_REMOTE_SNAPSHOT_INVALID',
        'Garupa pinned response의 크기 또는 SHA-256이 승인값과 다릅니다.',
        { bytes: bytes.byteLength },
      )
    }

    return Object.freeze({ bytes, contentType, sha256, url })
  } finally {
    clearTimeout(timeout)
    options.signal.removeEventListener('abort', onAbort)
  }
}
