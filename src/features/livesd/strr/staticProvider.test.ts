import { describe, expect, it, vi } from 'vitest'

import {
  loadStrrCatalog,
  loadStrrModel,
  localizeStrrLabels,
  parseStrrCatalog,
  STRR_DEFAULT_ASSET_ROOT,
  STRR_MIRROR_COMMIT,
} from './staticProvider'

const CATALOG = {
  version: 1,
  gameId: 'strr',
  characters: [
    {
      id: '101',
      labels: { en: 'Karen Aijo', ko: '아이조 카렌' },
      editions: [
        {
          id: '1010001',
          labels: { en: 'Seisho Music Academy', ko: '세이쇼 음악학교' },
          metadataSource: 'karth',
          side: 'right',
        },
      ],
    },
  ],
} as const

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])
const SKELETON = new Uint8Array([1, 2, 3, 4])
const ATLAS = `model_right.png
size: 1,1
format: RGBA8888
filter: Linear,Linear
repeat: none
region
  rotate: false
  xy: 0, 0
  size: 1, 1
`

describe('STRR static provider', () => {
  it('기본 mirror를 검증한 immutable commit에 고정한다', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(CATALOG)))
    const catalog = await loadStrrCatalog({
      fetcher: fetcher as unknown as typeof fetch,
      signal: new AbortController().signal,
    })

    expect(catalog.characters).toHaveLength(1)
    expect(STRR_MIRROR_COMMIT).toBe(
      '866b72570450d6e38d0d441d387d0a230d2cb70e',
    )
    expect(STRR_DEFAULT_ASSET_ROOT).toBe(
      `https://raw.githubusercontent.com/clyerick/res-pak/${STRR_MIRROR_COMMIT}/strr`,
    )
    expect(STRR_DEFAULT_ASSET_ROOT).not.toContain('/refs/heads/')
    expect(fetcher).toHaveBeenCalledWith(
      `${STRR_DEFAULT_ASSET_ROOT}/catalog.json`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('character→edition catalog를 strict schema로 정규화한다', () => {
    const catalog = parseStrrCatalog(CATALOG)
    expect(catalog.characters[0]).toMatchObject({
      id: '101',
      editions: [{ id: '1010001', metadataSource: 'karth', side: 'right' }],
    })
    expect(localizeStrrLabels(catalog.characters[0]!.labels, 'ko', '101'))
      .toBe('아이조 카렌')
    expect(localizeStrrLabels({ ja: '愛城華恋' }, 'en', '101'))
      .toBe('愛城華恋')
  })

  it('중복 ID, 잘못된 prefix와 빈 label을 거부한다', () => {
    expect(() => parseStrrCatalog({
      ...CATALOG,
      characters: [...CATALOG.characters, CATALOG.characters[0]],
    })).toThrowError(expect.objectContaining({ code: 'STRR_CATALOG_INVALID' }))
    expect(() => parseStrrCatalog({
      ...CATALOG,
      characters: [{
        ...CATALOG.characters[0],
        editions: [{
          ...CATALOG.characters[0].editions[0],
          id: '2020001',
        }],
      }],
    })).toThrowError(expect.objectContaining({ code: 'STRR_CATALOG_INVALID' }))
    expect(() => parseStrrCatalog({
      ...CATALOG,
      characters: [{ ...CATALOG.characters[0], labels: {} }],
    })).toThrowError(expect.objectContaining({ code: 'STRR_CATALOG_INVALID' }))
  })

  it('고정 mirror에서 선택한 character skeleton·edition atlas·PNG만 읽는다', async () => {
    const fetcherMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('catalog.json')) {
        return new Response(JSON.stringify(CATALOG))
      }
      if (url.endsWith('.skel')) return new Response(SKELETON)
      if (url.endsWith('.atlas')) return new Response(ATLAS)
      return new Response(PNG)
    })
    const fetcher = fetcherMock as unknown as typeof fetch
    const signal = new AbortController().signal
    const catalog = await loadStrrCatalog({
      fetcher,
      signal,
    })
    const model = await loadStrrModel({
      catalog,
      characterId: '101',
      editionId: '1010001',
      fetcher,
      signal,
    })

    expect(fetcherMock.mock.calls.map(([url]) => String(url))).toEqual([
      `${STRR_DEFAULT_ASSET_ROOT}/catalog.json`,
      `${STRR_DEFAULT_ASSET_ROOT}/characters/101/model_right.skel`,
      `${STRR_DEFAULT_ASSET_ROOT}/editions/1010001/model_right.atlas`,
      `${STRR_DEFAULT_ASSET_ROOT}/editions/1010001/model_right.png`,
    ])
    expect([...new Uint8Array(model.skeletonData)]).toEqual([...SKELETON])
    expect(model.atlasBundle).toMatchObject({
      atlasPath: 'model_right.atlas',
      sourceName: '101:1010001',
    })
    expect([...model.atlasBundle.atlasPages.keys()]).toEqual([
      'model_right.png',
    ])
  })

  it('catalog에 없는 선택은 요청 전에 거부한다', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch
    await expect(loadStrrModel({
      catalog: parseStrrCatalog(CATALOG),
      characterId: '101',
      editionId: '1019999',
      fetcher,
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'STRR_SELECTION_INVALID' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
