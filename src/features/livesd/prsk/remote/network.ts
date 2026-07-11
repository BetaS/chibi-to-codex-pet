import {
  isPrskRemoteError,
  PrskRemoteError,
  type PrskRemoteErrorCode,
} from './errors'
import type { PrskRemoteResourceKind } from './types'

export const PRSK_REMOTE_FETCH_POLICY = Object.freeze({
  mode: 'cors' as const,
  credentials: 'omit' as const,
  referrerPolicy: 'no-referrer' as const,
  redirect: 'error' as const,
})

interface RemoteOperationSignal {
  readonly signal: AbortSignal
  cleanup(): void
}

function abortedError(): PrskRemoteError {
  return new PrskRemoteError(
    'REMOTE_ABORTED',
    '원격 요청이 취소되었습니다.',
  )
}

function timeoutError(): PrskRemoteError {
  return new PrskRemoteError(
    'REMOTE_TIMEOUT',
    '원격 서버가 제한 시간 안에 응답하지 않았습니다.',
  )
}

export function createRemoteOperationSignal(
  userSignal: AbortSignal,
  timeoutMs: number,
): RemoteOperationSignal {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new RangeError('timeoutMs must be a finite non-negative number')
  }

  const controller = new AbortController()
  const abortFromUser = () => {
    if (!controller.signal.aborted) {
      controller.abort(abortedError())
    }
  }

  if (userSignal.aborted) {
    abortFromUser()
  } else {
    userSignal.addEventListener('abort', abortFromUser, { once: true })
  }

  const timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(timeoutError())
    }
  }, timeoutMs)

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout)
      userSignal.removeEventListener('abort', abortFromUser)
    },
  }
}

export function throwIfRemoteOperationAborted(signal: AbortSignal): void {
  if (!signal.aborted) {
    return
  }

  if (isPrskRemoteError(signal.reason)) {
    throw signal.reason
  }
  throw abortedError()
}

function networkError(error: unknown, url: string): PrskRemoteError {
  return new PrskRemoteError(
    'REMOTE_NETWORK_OR_CORS',
    '원격 서버에 연결할 수 없습니다. 네트워크 상태와 서버의 CORS 설정을 확인하세요.',
    { cause: error, url },
  )
}

export async function fetchPrskRemoteResponse(
  fetcher: typeof fetch,
  url: string,
  signal: AbortSignal,
  resource: PrskRemoteResourceKind,
): Promise<Response> {
  throwIfRemoteOperationAborted(signal)

  let response: Response
  try {
    response = await fetcher(url, {
      ...PRSK_REMOTE_FETCH_POLICY,
      signal,
    })
  } catch (error) {
    if (signal.aborted) {
      throwIfRemoteOperationAborted(signal)
    }
    if (isPrskRemoteError(error)) {
      throw error
    }
    throw networkError(error, url)
  }

  throwIfRemoteOperationAborted(signal)
  if (
    response.redirected ||
    response.type === 'opaqueredirect' ||
    (response.status >= 300 && response.status < 400)
  ) {
    throw new PrskRemoteError(
      'REMOTE_REDIRECT',
      '원격 리소스 redirect는 허용되지 않습니다.',
      { resource, status: response.status, url },
    )
  }
  if (!response.ok) {
    throw new PrskRemoteError(
      resource === 'catalog' ? 'REMOTE_CATALOG_HTTP' : 'REMOTE_MODEL_HTTP',
      `원격 ${resource} 요청이 HTTP ${response.status}로 실패했습니다.`,
      { resource, status: response.status, url },
    )
  }

  return response
}

export interface ReadLimitedResponseOptions {
  readonly signal: AbortSignal
  readonly resource: PrskRemoteResourceKind
  readonly tooLargeCode: Extract<
    PrskRemoteErrorCode,
    'REMOTE_CATALOG_TOO_LARGE' | 'REMOTE_RESOURCE_TOO_LARGE'
  >
  readonly url: string
}

function validContentLength(response: Response): number | null {
  const raw = response.headers.get('content-length')?.trim()
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }

  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : Number.POSITIVE_INFINITY
}

function tooLargeError(
  maxBytes: number,
  options: ReadLimitedResponseOptions,
): PrskRemoteError {
  return new PrskRemoteError(
    options.tooLargeCode,
    `원격 ${options.resource} 응답이 ${maxBytes}바이트 제한을 초과했습니다.`,
    { resource: options.resource, url: options.url },
  )
}

export async function readLimitedResponseBody(
  response: Response,
  maxBytes: number,
  options: ReadLimitedResponseOptions,
): Promise<ArrayBuffer> {
  throwIfRemoteOperationAborted(options.signal)
  const contentLength = validContentLength(response)
  if (contentLength !== null && contentLength > maxBytes) {
    try {
      await response.body?.cancel()
    } catch {
      // The size error remains the actionable failure.
    }
    throw tooLargeError(maxBytes, options)
  }
  if (!response.body) {
    const result = await response.arrayBuffer()
    throwIfRemoteOperationAborted(options.signal)
    if (result.byteLength > maxBytes) {
      throw tooLargeError(maxBytes, options)
    }
    return result
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  const cancelReader = () => {
    void reader.cancel(options.signal.reason).catch(() => undefined)
  }
  options.signal.addEventListener('abort', cancelReader, { once: true })

  try {
    while (true) {
      throwIfRemoteOperationAborted(options.signal)
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        const error = tooLargeError(maxBytes, options)
        try {
          await reader.cancel(error)
        } catch {
          // The size error remains the actionable failure.
        }
        throw error
      }
      chunks.push(value)
    }
  } catch (error) {
    if (options.signal.aborted) {
      throwIfRemoteOperationAborted(options.signal)
    }
    if (isPrskRemoteError(error)) {
      throw error
    }
    throw networkError(error, options.url)
  } finally {
    options.signal.removeEventListener('abort', cancelReader)
    reader.releaseLock()
  }

  throwIfRemoteOperationAborted(options.signal)

  const result = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result.buffer
}

export function decodeFatalUtf8(
  buffer: ArrayBuffer,
  resource: Extract<PrskRemoteResourceKind, 'atlas' | 'catalog'>,
): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch (error) {
    throw new PrskRemoteError(
      resource === 'catalog'
        ? 'REMOTE_CATALOG_INVALID'
        : 'REMOTE_CONTENT_INVALID',
      `원격 ${resource} 응답이 올바른 UTF-8 text가 아닙니다.`,
      { cause: error, resource },
    )
  }
}
