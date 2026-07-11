import { describe, expect, it } from 'vitest'

import {
  buildPrskRemoteModelUrls,
  resolvePrskRemoteAtlasPages,
} from './modelPaths'
import { PRSK_REMOTE_LIMITS, type PrskRemoteCatalog } from './types'

const catalog: PrskRemoteCatalog = {
  providerLabel: 'Custom',
  assetBaseUrl: 'https://assets.example/area_sd',
  requestOrigins: ['https://assets.example'],
  characters: [{ id: 'sd_01ichika_normal', label: 'Ichika' }],
}

describe('PRSK remote model paths', () => {
  it('현재 catalog option으로 고정 skeleton 및 atlas URL을 구성한다', () => {
    expect(buildPrskRemoteModelUrls(catalog, 'sd_01ichika_normal')).toEqual({
      skeletonUrl:
        'https://assets.example/area_sd/base_model/sekai_skeleton.skel',
      atlasUrl:
        'https://assets.example/area_sd/sd_01ichika_normal/sekai_atlas.atlas',
      characterRootUrl:
        'https://assets.example/area_sd/sd_01ichika_normal/',
    })
  })

  it('현재 catalog에 없는 오래된 선택을 URL 구성 전에 거부한다', () => {
    expect(() => buildPrskRemoteModelUrls(catalog, 'stale')).toThrowError(
      expect.objectContaining({ code: 'REMOTE_SELECTION_INVALID' }),
    )
  })

  it('구조적으로 위조된 catalog의 unsafe base와 path ID도 URL 구성 전에 거부한다', () => {
    expect(() =>
      buildPrskRemoteModelUrls(
        { ...catalog, assetBaseUrl: 'https://192.168.1.10/area_sd' },
        'sd_01ichika_normal',
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_ASSET_URL_INVALID' }),
    )

    const unsafeId = '../escape'
    expect(() =>
      buildPrskRemoteModelUrls(
        {
          ...catalog,
          characters: [{ id: unsafeId, label: 'Unsafe' }],
        },
        unsafeId,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_SELECTION_INVALID' }),
    )
  })

  it('중첩 PNG를 character root 아래 URL과 bundle key로 정규화한다', () => {
    const urls = buildPrskRemoteModelUrls(catalog, 'sd_01ichika_normal')
    expect(resolvePrskRemoteAtlasPages(urls, ['textures/page 1.png'])).toEqual([
      {
        path: 'textures/page 1.png',
        url: 'https://assets.example/area_sd/sd_01ichika_normal/textures/page%201.png',
      },
    ])
  })

  it.each([
    '../escape.png',
    '/absolute.png',
    'https://evil.example/page.png',
    '//evil.example/page.png',
    'C:\\page.png',
    'page.webp',
  ])('안전하지 않은 atlas 페이지 %s를 거부한다', (page) => {
    const urls = buildPrskRemoteModelUrls(catalog, 'sd_01ichika_normal')
    expect(() => resolvePrskRemoteAtlasPages(urls, [page])).toThrowError(
      expect.objectContaining({ code: 'REMOTE_ATLAS_PAGE_UNSAFE' }),
    )
  })

  it('정규화 후 중복 페이지와 32개 초과 페이지를 거부한다', () => {
    const urls = buildPrskRemoteModelUrls(catalog, 'sd_01ichika_normal')
    expect(() =>
      resolvePrskRemoteAtlasPages(urls, ['page.png', './page.png']),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_ATLAS_PAGE_UNSAFE' }),
    )
    expect(() =>
      resolvePrskRemoteAtlasPages(
        urls,
        Array.from(
          { length: PRSK_REMOTE_LIMITS.pngPages + 1 },
          (_, index) => `page-${index}.png`,
        ),
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_ATLAS_PAGE_LIMIT_EXCEEDED' }),
    )
  })
})
