import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchGarupaPinnedBytes, sha256Hex } from './network'

const textEncoder = new TextEncoder()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Garupa pinned network boundary', () => {
  it('uses the exact commit URL and privacy-preserving full GET policy', async () => {
    const bytes = textEncoder.encode('{"ok":true}')
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input
        void _init
        return new Response(bytes, {
          headers: {
            'content-length': String(bytes.byteLength),
            'content-type': 'application/json; charset=utf-8',
          },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    const result = await fetchGarupaPinnedBytes('sdchara/_info.json', {
      signal: controller.signal,
      maxBytes: 1024,
      expectedBytes: bytes.byteLength,
      expectedSha256: await sha256Hex(bytes),
      expectedContentTypes: ['application/json'],
      integrityErrorCode: 'GARUPA_REMOTE_CATALOG_INVALID',
    })

    expect(Array.from(result.bytes)).toEqual(Array.from(bytes))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@15b3e023cfdc576212f8b3a6b001c9f26e755f23/sdchara/_info.json',
    )
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
    })
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has('Range')).toBe(
      false,
    )
  })

  it('rejects declared and streamed bodies above the configured limit', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(new Uint8Array(16), {
          headers: { 'content-length': '16' },
        }),
      ),
    )
    await expect(
      fetchGarupaPinnedBytes('sdchara/_info.json', {
        signal: controller.signal,
        maxBytes: 8,
      }),
    ).rejects.toMatchObject({
      code: 'GARUPA_REMOTE_RESPONSE_TOO_LARGE',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          new ReadableStream({
            start(streamController) {
              streamController.enqueue(new Uint8Array(5))
              streamController.enqueue(new Uint8Array(5))
              streamController.close()
            },
          }),
        ),
      ),
    )
    await expect(
      fetchGarupaPinnedBytes('sdchara/_info.json', {
        signal: controller.signal,
        maxBytes: 8,
      }),
    ).rejects.toMatchObject({
      code: 'GARUPA_REMOTE_RESPONSE_TOO_LARGE',
    })
  })

  it('normalizes caller cancellation and timeout without exposing the URL', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      fetchGarupaPinnedBytes('sdchara/_info.json', {
        signal: controller.signal,
        maxBytes: 8,
      }),
    ).rejects.toMatchObject({
      code: 'GARUPA_REMOTE_ABORTED',
    })

    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      ),
    )
    const timedRequest = fetchGarupaPinnedBytes('sdchara/_info.json', {
      signal: new AbortController().signal,
      maxBytes: 8,
      timeoutMs: 10,
    })
    const timedExpectation = expect(timedRequest).rejects.toMatchObject({
      code: 'GARUPA_REMOTE_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(10)
    await timedExpectation
  })
})
