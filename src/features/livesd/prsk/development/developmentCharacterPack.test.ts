import { describe, expect, it, vi } from 'vitest'

import { VALID_ATLAS } from '../../../../test/zipFixtures'
import {
  DEVELOPMENT_CHARACTER_ATLAS_URL,
  DEVELOPMENT_CHARACTER_ROOT,
  DEVELOPMENT_SKELETON_PATH,
  loadDevelopmentCharacterPack,
  loadDevelopmentSharedSkeleton,
} from './developmentCharacterPack'

function response(data: string, type: 'blob' | 'text'): Response {
  return {
    ok: true,
    status: 200,
    text: async () => data,
    blob: async () => new Blob([data], { type: type === 'blob' ? 'image/png' : '' }),
  } as Response
}

describe('loadDevelopmentCharacterPack', () => {
  it('public/assets symlink의 atlas와 PNG를 기본 pack으로 읽는다', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      return url === DEVELOPMENT_CHARACTER_ATLAS_URL
        ? response(VALID_ATLAS, 'text')
        : response('png', 'blob')
    }) as unknown as typeof fetch

    const result = await loadDevelopmentCharacterPack({ fetcher })

    expect(result.sourceName).toBe('sd_mob003 (기본 링크)')
    expect([...result.atlasPages.keys()]).toEqual(['page.png'])
    expect(fetcher).toHaveBeenNthCalledWith(1, DEVELOPMENT_CHARACTER_ATLAS_URL, {
      cache: 'no-store',
    })
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      `${DEVELOPMENT_CHARACTER_ROOT}/page.png`,
      { cache: 'no-store' },
    )
  })

  it('기본 atlas가 없으면 구분된 오류를 반환한다', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as
      typeof fetch

    await expect(
      loadDevelopmentCharacterPack({ fetcher }),
    ).rejects.toMatchObject({ code: 'DEVELOPMENT_CHARACTER_LOAD_FAILED' })
  })

  it('PRSK development 공통 skeleton을 고정 same-origin 경로에서 읽는다', async () => {
    const expected = new Uint8Array([1, 2, 3]).buffer
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => expected,
    })) as unknown as typeof fetch

    await expect(loadDevelopmentSharedSkeleton({ fetcher })).resolves.toBe(
      expected,
    )
    expect(fetcher).toHaveBeenCalledWith(DEVELOPMENT_SKELETON_PATH, {
      cache: 'no-store',
    })
  })
})
