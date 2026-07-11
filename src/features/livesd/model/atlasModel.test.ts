import { describe, expect, it } from 'vitest'

import { readAtlasPageReferences, resolveAtlasPagePath } from './index'

describe('LiveSD model atlas contract', () => {
  it('page header와 source-relative page 경로를 PRSK와 무관하게 해석한다', () => {
    expect(
      readAtlasPageReferences('page.png\nsize: 16,16\nformat: RGBA8888\n'),
    ).toEqual(['page.png'])
    expect(resolveAtlasPagePath('nested/model.atlas', 'images\\page.png')).toBe(
      'nested/images/page.png',
    )
  })

  it('빈 page 목록과 source root 탈출을 범용 오류로 거부한다', () => {
    expect(() => readAtlasPageReferences('')).toThrowError(
      expect.objectContaining({ code: 'ATLAS_PAGE_LIST_EMPTY' }),
    )
    expect(() =>
      resolveAtlasPagePath('nested/model.atlas', '../../page.png'),
    ).toThrowError(
      expect.objectContaining({ code: 'ATLAS_PAGE_PATH_INVALID' }),
    )
  })
})
