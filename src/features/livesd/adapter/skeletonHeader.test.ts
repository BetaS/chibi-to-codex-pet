import { describe, expect, it } from 'vitest'

import { createSkeletonHeader } from '../../../test/skeletonFixtures'
import { inspectLiveSD36Skeleton } from './skeletonHeader'

describe('inspectLiveSD36Skeleton', () => {
  it.each(['3.6.53', '3.6.53D4'])(
    '검증된 D4 프로필 표기 %s를 읽는다',
    (version) => {
      expect(inspectLiveSD36Skeleton(createSkeletonHeader(version))).toEqual({
        hash: 'fixture-hash',
        version,
        compatibility: 'verified',
      })
    },
  )

  it('다른 3.6.x를 실험적 호환으로 허용한다', () => {
    const result = inspectLiveSD36Skeleton(createSkeletonHeader('3.6.99'))

    expect(result.compatibility).toBe('experimental')
    expect(Object.keys(result)).not.toContain('warnings')
  })

  it.each(['3.3', '3.7.0', '4.2.1']) (
    '다른 version %s를 best_effort로 허용한다',
    (version) => {
      expect(
        inspectLiveSD36Skeleton(createSkeletonHeader(version)),
      ).toMatchObject({ version, compatibility: 'best_effort' })
    },
  )

  it('1024 byte보다 긴 정상 header 문자열을 입력 경계 안에서 읽는다', () => {
    const hash = 'h'.repeat(2048)

    expect(
      inspectLiveSD36Skeleton(createSkeletonHeader('3.6.53', hash)),
    ).toMatchObject({ hash, compatibility: 'verified' })
  })

  it('잘린 헤더를 손상 오류로 구분한다', () => {
    expect(() => inspectLiveSD36Skeleton(new Uint8Array([8, 1]).buffer)).toThrowError(
      expect.objectContaining({ code: 'SKELETON_HEADER_CORRUPT' }),
    )
  })

  it.each([
    new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x80]).buffer,
    new Uint8Array([2, 0xff, 0]).buffer,
    new Uint8Array([0, 0]).buffer,
  ])('잘못된 varint, UTF-8 또는 빈 version을 손상 오류로 구분한다', (data) => {
    expect(() => inspectLiveSD36Skeleton(data)).toThrowError(
      expect.objectContaining({ code: 'SKELETON_HEADER_CORRUPT' }),
    )
  })
})
