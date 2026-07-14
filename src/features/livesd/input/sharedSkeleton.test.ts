import { describe, expect, it } from 'vitest'

import { loadSharedSkeleton } from './sharedSkeleton'

describe('loadSharedSkeleton', () => {
  it('production에서 사용자 파일이 없으면 선택을 요구한다', async () => {
    await expect(
      loadSharedSkeleton(null),
    ).rejects.toMatchObject({ code: 'SHARED_SKELETON_REQUIRED' })
  })

  it('.skel이 아닌 사용자 파일을 구분된 오류로 거부한다', async () => {
    await expect(
      loadSharedSkeleton(new File(['data'], 'skeleton.json')),
    ).rejects.toMatchObject({ code: 'SHARED_SKELETON_INVALID_TYPE' })
  })

  it('대문자 .SKEL 확장자를 사용자 스켈레톤으로 허용한다', async () => {
    const file = new File(['data'], 'SKELETON.SKEL')

    await expect(loadSharedSkeleton(file)).resolves.toEqual(
      await file.arrayBuffer(),
    )
  })
})
