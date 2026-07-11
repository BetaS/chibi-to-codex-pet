import { afterEach, describe, expect, it, vi } from 'vitest'

import { PrskRemoteCatalogSource } from './PrskRemoteCatalogSource'
import { resolvePrskRemoteProvider } from './provider'
import {
  PJSEK_AI_ASSET_BASE_URL,
  PRSK_CHIBI_VIEWER_CATALOG_URL,
  PRSK_REMOTE_LIMITS,
  type PrskRemoteProviderConfig,
} from './types'

function jsonResponse(
  value: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  })
}

function customProvider() {
  return resolvePrskRemoteProvider(
    { kind: 'custom', assetBaseUrl: 'https://assets.example/area_sd' },
    { development: false },
  )
}

function catalogRequest(provider = customProvider()) {
  return { provider, signal: new AbortController().signal }
}

function textResponse(value: string, init: ResponseInit = {}): Response {
  return new Response(value, { status: 200, ...init })
}

function viewerProvider() {
  return resolvePrskRemoteProvider({ kind: 'prsk-chibi-viewer' })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('PrskRemoteCatalogSource', () => {
  it('custom catalog에 공통 fetch 정책을 적용하고 정렬된 최신 응답만 반환한다', async () => {
    let generation = 0
    const fetcher = vi.fn(async (
      _input: string | URL | Request,
      _init?: RequestInit,
    ) => {
      void _input
      void _init
      generation += 1
      return generation === 1
        ? jsonResponse({
            version: 1,
            characters: [
              { id: 'old_b', label: 'B' },
              { id: 'old_a', label: 'A' },
            ],
          })
        : jsonResponse({
            version: 1,
            characters: [{ id: 'new_only', label: 'New' }],
          })
    })
    const source = new PrskRemoteCatalogSource({
      fetcher: fetcher as unknown as typeof fetch,
    })
    const request = catalogRequest()

    const first = await source.load(request)
    const second = await source.load(request)

    expect(first.characters).toEqual([
      { id: 'old_a', label: 'A' },
      { id: 'old_b', label: 'B' },
    ])
    expect(second.characters).toEqual([{ id: 'new_only', label: 'New' }])
    expect(second.characters).not.toContainEqual({ id: 'old_a', label: 'A' })
    expect(second).toMatchObject({
      providerLabel: 'Custom',
      assetBaseUrl: 'https://assets.example/area_sd',
      requestOrigins: ['https://assets.example'],
    })

    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(url).toBe('https://assets.example/area_sd/catalog.json')
    expect(init).toMatchObject({
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    'http://public.example/area_sd',
    'https://192.168.1.20/area_sd',
    'https://assets.example/area_sd?token=secret',
    'https://assets.example/area_sd/',
  ])('구조적으로 위조된 custom base URL %s도 요청 전에 재검증한다', async (assetBaseUrl) => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        version: 1,
        characters: [{ id: 'unexpected', label: 'Unexpected' }],
      }),
    )
    const provider = {
      kind: 'custom',
      providerLabel: 'Forged',
      assetBaseUrl,
      catalogUrl: `${assetBaseUrl}/catalog.json`,
      requestOrigins: [new URL(assetBaseUrl).origin],
    } as PrskRemoteProviderConfig
    const source = new PrskRemoteCatalogSource({
      fetcher: fetcher as unknown as typeof fetch,
    })

    await expect(
      source.load({ provider, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: 'REMOTE_ASSET_URL_INVALID' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('viewer HTML과 same-origin bundle을 순서대로 읽어 strict sd_ 목록만 반환한다', async () => {
    const fetcher = vi.fn(async (
      input: string | URL | Request,
      _init?: RequestInit,
    ) => {
      void _init
      const url = String(input)
      return url === PRSK_CHIBI_VIEWER_CATALOG_URL
        ? textResponse(
            '<script defer src="/static/js/main.8ca0b7b5.js"></script>',
          )
        : textResponse([
            'JSON.parse(\'[{"value":"base_model","label":"base_model"},',
            '{"value":"sd_z","label":"sd_z"},',
            '{"value":"jump","label":"jump"},',
            '{"value":"sd_a","label":"sd_a"}]\')',
          ].join(''))
    })
    const source = new PrskRemoteCatalogSource({
      fetcher: fetcher as unknown as typeof fetch,
    })
    const provider = viewerProvider()

    const result = await source.load(catalogRequest(provider))

    expect(result.characters).toEqual([
      { id: 'sd_a', label: 'sd_a' },
      { id: 'sd_z', label: 'sd_z' },
    ])
    expect(result.assetBaseUrl).toBe(PJSEK_AI_ASSET_BASE_URL)
    expect(result.providerLabel).toBe('prsk-chibi-viewer snapshot')
    expect(result.requestOrigins).toEqual([
      'https://prsk-chibi-viewer.vercel.app',
      'https://assets.pjsek.ai',
    ])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      PRSK_CHIBI_VIEWER_CATALOG_URL,
      'https://prsk-chibi-viewer.vercel.app/static/js/main.8ca0b7b5.js',
    ])
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
      })
    }
  })

  it('preset 해석만으로 요청하지 않고 load 시점에만 viewer를 요청한다', async () => {
    let call = 0
    const fetcher = vi.fn(async () => {
      call += 1
      return call === 1
        ? textResponse('<script src="/static/js/main.8ca0b7b5.js"></script>')
        : textResponse('{"value":"sd_only","label":"sd_only"}')
    })
    const source = new PrskRemoteCatalogSource({
      fetcher: fetcher as unknown as typeof fetch,
    })

    const provider = viewerProvider()
    expect(provider.assetBaseUrl).toBe(PJSEK_AI_ASSET_BASE_URL)
    expect(fetcher).not.toHaveBeenCalled()

    await source.load(catalogRequest(provider))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('빈 custom 및 sd_ 항목이 없는 viewer bundle을 구분한다', async () => {
    const customSource = new PrskRemoteCatalogSource({
      fetcher: vi.fn(async () =>
        jsonResponse({ version: 1, characters: [] }),
      ) as unknown as typeof fetch,
    })
    await expect(customSource.load(catalogRequest())).rejects.toMatchObject({
      code: 'REMOTE_CATALOG_EMPTY',
    })

    let call = 0
    const viewerSource = new PrskRemoteCatalogSource({
      fetcher: vi.fn(async () => {
        call += 1
        return call === 1
          ? textResponse('<script src="/static/js/main.8ca0b7b5.js"></script>')
          : textResponse('{"value":"base_model","label":"base_model"}')
      }) as unknown as typeof fetch,
    })
    await expect(
      viewerSource.load(catalogRequest(viewerProvider())),
    ).rejects.toMatchObject({ code: 'REMOTE_CATALOG_EMPTY' })
  })

  it('unsafe viewer HTML을 거부하고 다른 catalog로 fallback하지 않는다', async () => {
    const fetcher = vi.fn(async () =>
      textResponse('<script src="https://evil.example/static/js/main.8ca0b7b5.js"></script>'),
    )
    const source = new PrskRemoteCatalogSource({
      fetcher: fetcher as unknown as typeof fetch,
    })
    await expect(
      source.load(catalogRequest(viewerProvider())),
    ).rejects.toMatchObject({ code: 'REMOTE_CATALOG_ORIGIN_INVALID' })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('Content-Length, stream 및 viewer 두 응답 누적에 1MiB 제한을 적용한다', async () => {
    const contentLengthSource = new PrskRemoteCatalogSource({
      fetcher: vi.fn(async () =>
        jsonResponse(
          { version: 1, characters: [{ id: 'valid', label: 'Valid' }] },
          {
            headers: {
              'content-length': String(PRSK_REMOTE_LIMITS.catalogBytes + 1),
            },
          },
        ),
      ) as unknown as typeof fetch,
    })
    await expect(
      contentLengthSource.load(catalogRequest()),
    ).rejects.toMatchObject({ code: 'REMOTE_CATALOG_TOO_LARGE' })

    const oversized = new Uint8Array(PRSK_REMOTE_LIMITS.catalogBytes + 1)
    const streamSource = new PrskRemoteCatalogSource({
      fetcher: vi.fn(async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(oversized.subarray(0, 512 * 1024))
              controller.enqueue(oversized.subarray(512 * 1024))
              controller.close()
            },
          }),
        ),
      ) as unknown as typeof fetch,
    })
    await expect(streamSource.load(catalogRequest())).rejects.toMatchObject({
      code: 'REMOTE_CATALOG_TOO_LARGE',
    })

    const html = '<script src="/static/js/main.8ca0b7b5.js"></script>'
    const htmlBytes = new TextEncoder().encode(html).byteLength
    let viewerCall = 0
    const cumulativeViewerSource = new PrskRemoteCatalogSource({
      fetcher: vi.fn(async () => {
        viewerCall += 1
        return viewerCall === 1
          ? textResponse(html)
          : textResponse('{"value":"sd_valid","label":"sd_valid"}', {
              headers: {
                'content-length': String(
                  PRSK_REMOTE_LIMITS.catalogBytes - htmlBytes + 1,
                ),
              },
            })
      }) as unknown as typeof fetch,
    })
    await expect(
      cumulativeViewerSource.load(catalogRequest(viewerProvider())),
    ).rejects.toMatchObject({ code: 'REMOTE_CATALOG_TOO_LARGE' })
  })

  it('viewer HTML과 bundle 모두 fatal UTF-8로 decode한다', async () => {
    const invalidUtf8 = new Response(new Uint8Array([0xc3, 0x28]))
    const invalidHtml = new PrskRemoteCatalogSource({
      fetcher: vi.fn(async () => invalidUtf8) as unknown as typeof fetch,
    })
    await expect(
      invalidHtml.load(catalogRequest(viewerProvider())),
    ).rejects.toMatchObject({ code: 'REMOTE_CATALOG_INVALID' })

    let call = 0
    const invalidBundle = new PrskRemoteCatalogSource({
      fetcher: vi.fn(async () => {
        call += 1
        return call === 1
          ? textResponse('<script src="/static/js/main.8ca0b7b5.js"></script>')
          : new Response(new Uint8Array([0xc3, 0x28]))
      }) as unknown as typeof fetch,
    })
    await expect(
      invalidBundle.load(catalogRequest(viewerProvider())),
    ).rejects.toMatchObject({ code: 'REMOTE_CATALOG_INVALID' })
  })

  it('fatal UTF-8, HTTP, redirect와 CORS/네트워크 오류를 구분한다', async () => {
    const cases: readonly [Response | Error, string][] = [
      [new Response(new Uint8Array([0xc3, 0x28])), 'REMOTE_CATALOG_INVALID'],
      [new Response('', { status: 503 }), 'REMOTE_CATALOG_HTTP'],
      [new Response('', { status: 302 }), 'REMOTE_REDIRECT'],
      [new TypeError('Failed to fetch'), 'REMOTE_NETWORK_OR_CORS'],
    ]

    for (const [result, code] of cases) {
      const source = new PrskRemoteCatalogSource({
        fetcher: vi.fn(async () => {
          if (result instanceof Error) throw result
          return result
        }) as unknown as typeof fetch,
      })
      await expect(source.load(catalogRequest())).rejects.toMatchObject({ code })
    }
  })

  it('20초 계열 timeout과 사용자 abort를 서로 다른 코드로 전달한다', async () => {
    vi.useFakeTimers()
    const waitingFetcher = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true },
          )
        }),
    ) as unknown as typeof fetch
    const source = new PrskRemoteCatalogSource({
      fetcher: waitingFetcher,
      timeoutMs: 50,
    })

    const timedOut = source.load(catalogRequest())
    const timeoutExpectation = expect(timedOut).rejects.toMatchObject({
      code: 'REMOTE_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(50)
    await timeoutExpectation

    const user = new AbortController()
    const aborted = source.load({ provider: customProvider(), signal: user.signal })
    const abortExpectation = expect(aborted).rejects.toMatchObject({
      code: 'REMOTE_ABORTED',
    })
    user.abort()
    await abortExpectation
  })
})
