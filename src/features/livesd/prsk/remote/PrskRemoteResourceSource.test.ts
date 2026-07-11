import { afterEach, describe, expect, it, vi } from 'vitest'

import { PrskRemoteResourceSource } from './PrskRemoteResourceSource'
import { PRSK_REMOTE_LIMITS, type PrskRemoteCatalog } from './types'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2])
const SKELETON = new Uint8Array([3, 6, 0, 1])

function atlas(...pages: string[]): string {
  return pages
    .map(
      (page) => `${page}
size: 1,1
format: RGBA8888
filter: Linear,Linear
repeat: none
region
  rotate: false
  xy: 0, 0
  size: 1, 1`,
    )
    .join('\n\n')
}

const catalog: PrskRemoteCatalog = {
  providerLabel: 'Custom',
  assetBaseUrl: 'https://assets.example/area_sd',
  requestOrigins: ['https://assets.example'],
  characters: [{ id: 'sd_01ichika_normal', label: 'Ichika' }],
}

function request(signal = new AbortController().signal) {
  return { catalog, characterId: 'sd_01ichika_normal', signal }
}

function successfulFetcher(atlasText = atlas('textures/page.png')) {
  return vi.fn(async (
    input: string | URL | Request,
    _init?: RequestInit,
  ) => {
    void _init
    const url = String(input)
    if (url.endsWith('.skel')) return new Response(SKELETON)
    if (url.endsWith('.atlas')) return new Response(atlasText)
    return new Response(PNG)
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('PrskRemoteResourceSource', () => {
  it('원본 skeleton과 정규화된 LiveSDAtlasBundle만 반환한다', async () => {
    const fetcher = successfulFetcher()
    const source = new PrskRemoteResourceSource({ fetcher })

    const result = await source.load(request())

    expect([...new Uint8Array(result.skeletonData)]).toEqual([...SKELETON])
    expect(result.sourceOrigin).toBe('https://assets.example')
    expect(result.atlasBundle).toMatchObject({
      sourceName: 'sd_01ichika_normal',
      atlasPath: 'sekai_atlas.atlas',
      atlasText: atlas('textures/page.png'),
    })
    expect([...result.atlasBundle.atlasPages.keys()]).toEqual([
      'textures/page.png',
    ])
    expect(result.atlasBundle.atlasPages.get('textures/page.png')).toMatchObject({
      type: 'image/png',
      size: PNG.byteLength,
    })
    expect(Object.keys(result)).toEqual([
      'skeletonData',
      'sourceOrigin',
      'atlasBundle',
    ])
    expect(Object.keys(result)).not.toContain('animations')
    expect(Object.keys(result.atlasBundle)).not.toContain('objectUrl')
  })

  it('고정 모델 URL과 중첩 PNG URL을 모두 같은 operation fetch 정책으로 요청한다', async () => {
    const fetcher = successfulFetcher()
    const source = new PrskRemoteResourceSource({ fetcher })

    await source.load(request())

    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://assets.example/area_sd/base_model/sekai_skeleton.skel',
      'https://assets.example/area_sd/sd_01ichika_normal/sekai_atlas.atlas',
      'https://assets.example/area_sd/sd_01ichika_normal/textures/page.png',
    ])
    const signals = fetcher.mock.calls.map(([, init]) => init?.signal)
    expect(new Set(signals)).toHaveLength(1)
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
      })
      expect(init?.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it('현재 catalog에 없는 선택은 어떤 요청도 만들기 전에 거부한다', async () => {
    const fetcher = successfulFetcher()
    const source = new PrskRemoteResourceSource({ fetcher })
    await expect(
      source.load({ ...request(), characterId: 'stale' }),
    ).rejects.toMatchObject({ code: 'REMOTE_SELECTION_INVALID' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('skeleton 및 atlas Content-Length 제한을 body read 전에 적용한다', async () => {
    const skeletonSource = new PrskRemoteResourceSource({
      fetcher: vi.fn(async () =>
        new Response(new Uint8Array([1]), {
          headers: {
            'content-length': String(PRSK_REMOTE_LIMITS.skeletonBytes + 1),
          },
        }),
      ) as unknown as typeof fetch,
    })
    await expect(skeletonSource.load(request())).rejects.toMatchObject({
      code: 'REMOTE_RESOURCE_TOO_LARGE',
      resource: 'skeleton',
    })

    const atlasSource = new PrskRemoteResourceSource({
      fetcher: vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith('.skel')
          ? new Response(SKELETON)
          : new Response('small', {
              headers: {
                'content-length': String(PRSK_REMOTE_LIMITS.atlasBytes + 1),
              },
            }),
      ) as unknown as typeof fetch,
    })
    await expect(atlasSource.load(request())).rejects.toMatchObject({
      code: 'REMOTE_RESOURCE_TOO_LARGE',
      resource: 'atlas',
    })
  })

  it('PNG Content-Length와 여러 PNG의 누적 64MiB 제한을 적용한다', async () => {
    const oversizedPng = new PrskRemoteResourceSource({
      fetcher: vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.endsWith('.skel')) return new Response(SKELETON)
        if (url.endsWith('.atlas')) return new Response(atlas('page.png'))
        return new Response(PNG, {
          headers: {
            'content-length': String(PRSK_REMOTE_LIMITS.pngBytes + 1),
          },
        })
      }) as unknown as typeof fetch,
    })
    await expect(oversizedPng.load(request())).rejects.toMatchObject({
      code: 'REMOTE_RESOURCE_TOO_LARGE',
      resource: 'png',
    })

    const firstPng = new Uint8Array(1 * 1024 * 1024)
    firstPng.set(PNG)
    const remainingAfterFirst = PRSK_REMOTE_LIMITS.pngBytes - firstPng.byteLength
    const cumulativeFetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('.skel')) return new Response(SKELETON)
      if (url.endsWith('.atlas')) {
        return new Response(atlas('first.png', 'second.png'))
      }
      if (url.endsWith('/first.png')) return new Response(firstPng)
      return new Response(PNG, {
        headers: { 'content-length': String(remainingAfterFirst + 1) },
      })
    }) as unknown as typeof fetch
    await expect(
      new PrskRemoteResourceSource({ fetcher: cumulativeFetcher }).load(
        request(),
      ),
    ).rejects.toMatchObject({
      code: 'REMOTE_RESOURCE_TOO_LARGE',
      resource: 'png',
    })
  })

  it('32개 page 경계를 허용하고 33개면 PNG 요청 전에 거부한다', async () => {
    const exactPages = Array.from(
      { length: PRSK_REMOTE_LIMITS.pngPages },
      (_, index) => `page-${index}.png`,
    )
    const exactFetcher = successfulFetcher(atlas(...exactPages))
    const exact = await new PrskRemoteResourceSource({
      fetcher: exactFetcher,
    }).load(request())
    expect(exact.atlasBundle.atlasPages).toHaveLength(
      PRSK_REMOTE_LIMITS.pngPages,
    )

    const overflowPages = [...exactPages, 'overflow.png']
    const overflowFetcher = successfulFetcher(atlas(...overflowPages))
    await expect(
      new PrskRemoteResourceSource({ fetcher: overflowFetcher }).load(request()),
    ).rejects.toMatchObject({ code: 'REMOTE_ATLAS_PAGE_LIMIT_EXCEEDED' })
    expect(overflowFetcher).toHaveBeenCalledTimes(2)
  })

  it('fatal UTF-8 atlas, 빈 atlas, unsafe page 및 PNG signature를 구분한다', async () => {
    const invalidAtlas = new PrskRemoteResourceSource({
      fetcher: vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith('.skel')
          ? new Response(SKELETON)
          : new Response(new Uint8Array([0xc3, 0x28])),
      ) as unknown as typeof fetch,
    })
    await expect(invalidAtlas.load(request())).rejects.toMatchObject({
      code: 'REMOTE_CONTENT_INVALID',
      resource: 'atlas',
    })

    for (const atlasText of ['', atlas('../escape.png')]) {
      const source = new PrskRemoteResourceSource({
        fetcher: successfulFetcher(atlasText),
      })
      await expect(source.load(request())).rejects.toMatchObject({
        code:
          atlasText === ''
            ? 'REMOTE_CONTENT_INVALID'
            : 'REMOTE_ATLAS_PAGE_UNSAFE',
      })
    }

    const invalidPng = new PrskRemoteResourceSource({
      fetcher: vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url.endsWith('.skel')) return new Response(SKELETON)
        if (url.endsWith('.atlas')) return new Response(atlas('page.png'))
        return new Response(new Uint8Array([1, 2, 3]))
      }) as unknown as typeof fetch,
    })
    await expect(invalidPng.load(request())).rejects.toMatchObject({
      code: 'REMOTE_CONTENT_INVALID',
      resource: 'png',
    })
  })

  it('model HTTP, redirect와 CORS/네트워크 오류를 구분한다', async () => {
    const cases: readonly [Response | Error, string][] = [
      [new Response('', { status: 404 }), 'REMOTE_MODEL_HTTP'],
      [new Response('', { status: 301 }), 'REMOTE_REDIRECT'],
      [new TypeError('Failed to fetch'), 'REMOTE_NETWORK_OR_CORS'],
    ]
    for (const [result, code] of cases) {
      const source = new PrskRemoteResourceSource({
        fetcher: vi.fn(async () => {
          if (result instanceof Error) throw result
          return result
        }) as unknown as typeof fetch,
      })
      await expect(source.load(request())).rejects.toMatchObject({ code })
    }
  })

  it('model timeout과 사용자 abort를 구분하고 진행 중 fetch signal을 취소한다', async () => {
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
    const source = new PrskRemoteResourceSource({
      fetcher: waitingFetcher,
      timeoutMs: 50,
    })

    const timedOut = source.load(request())
    const timeoutExpectation = expect(timedOut).rejects.toMatchObject({
      code: 'REMOTE_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(50)
    await timeoutExpectation

    const user = new AbortController()
    const aborted = source.load(request(user.signal))
    const abortExpectation = expect(aborted).rejects.toMatchObject({
      code: 'REMOTE_ABORTED',
    })
    user.abort()
    await abortExpectation
  })
})
