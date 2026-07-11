import { describe, expect, it } from 'vitest'

import {
  CodexPetAnimationMappingError,
  recommendCodexPetMappings,
  resolveCodexPetMirrorX,
} from './animationMapping'

describe('recommendCodexPetMappings', () => {
  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, false],
  ])('전체 %s와 상태 %s 반전을 XOR로 %s에 합성한다', (
    globalMirrorX,
    stateMirrorX,
    expected,
  ) => {
    expect(resolveCodexPetMirrorX(globalMirrorX, stateMirrorX)).toBe(expected)
  })

  it('상태와 직접 일치하는 action 이름을 일반 fallback보다 우선한다', () => {
    const animations = [
      'pose_default',
      'joy_fallback',
      'surprise_fallback',
      'idle',
      'walk',
      'wave',
      'jump',
      'failed',
      'wait',
      'run',
      'review',
    ]

    const mappings = recommendCodexPetMappings(animations)

    expect(mappings).toMatchObject({
      idle: { animationName: 'idle', mirrorX: false },
      'running-right': { animationName: 'walk', mirrorX: false },
      'running-left': { animationName: 'walk', mirrorX: true },
      waving: { animationName: 'wave', mirrorX: false },
      jumping: { animationName: 'jump', mirrorX: false },
      failed: { animationName: 'failed', mirrorX: false },
      waiting: { animationName: 'wait', mirrorX: false },
      running: { animationName: 'run', mirrorX: false },
      review: { animationName: 'review', mirrorX: false },
    })
  })

  it('wave와 jump가 없으면 joy와 surprise 의미 fallback을 사용한다', () => {
    const mappings = recommendCodexPetMappings([
      'neutral_idle',
      'friendly_joy01',
      'happy_surprise01',
    ])

    expect(mappings.waving.animationName).toBe('friendly_joy01')
    expect(mappings.jumping.animationName).toBe('happy_surprise01')
  })

  it('후보가 부족하면 pose_default, idle, 첫 animation 순서로 실제 이름을 fallback한다', () => {
    const withPoseDefault = recommendCodexPetMappings([
      'first_animation',
      'idle_loop',
      'pose_default',
    ])
    expect(withPoseDefault.failed.animationName).toBe('pose_default')

    const withIdle = recommendCodexPetMappings(['idle_loop', 'other_pose'])
    expect(withIdle.failed.animationName).toBe('idle_loop')

    const withFirstOnly = recommendCodexPetMappings(['only_animation'])
    expect(withFirstOnly.failed.animationName).toBe('only_animation')
  })

  it('running-left만 동일 source를 mirror하고 _b를 left 의미로 취급하지 않는다', () => {
    const mappings = recommendCodexPetMappings([
      'pose_default',
      'w_normal_walk01_b',
      'w_normal_walk01_f',
    ])

    expect(mappings['running-right']).toEqual({
      animationName: 'w_normal_walk01_f',
      mirrorX: false,
    })
    expect(mappings['running-left']).toEqual({
      animationName: 'w_normal_walk01_f',
      mirrorX: true,
    })
    expect(
      Object.entries(mappings)
        .filter(([state]) => state !== 'running-left')
        .every(([, mapping]) => !mapping.mirrorX),
    ).toBe(true)
  })

  it('Airi 공통 스켈레톤에서 설계된 여성형 animation을 추천한다', () => {
    const airiAnimations = [
      'm_happy_idle01_f',
      'w_adult_idle01_f',
      'w_happy_idle01_f',
      'm_normal_walk01_f',
      'w_normal_walk01_b',
      'w_normal_walk01_f',
      'w_happy_joy01_f',
      'w_cute_joy01_f',
      'w_pure_surprise01_f',
      'w_happy_surprise01_f',
      'z_test_F_negi01',
      'w_cute_sad01_f',
      'w_happy_sad01_f',
      'n_general_wait_01_f',
      'w_cute_listen01_f',
      'w_happy_listen01_f',
      'w_happy_doubt03_f',
      'w_happy_doubt01_f',
      'w_happy_doubt02_f',
    ]

    expect(recommendCodexPetMappings(airiAnimations)).toEqual({
      idle: { animationName: 'w_happy_idle01_f', mirrorX: false },
      'running-right': {
        animationName: 'w_normal_walk01_f',
        mirrorX: false,
      },
      'running-left': {
        animationName: 'w_normal_walk01_f',
        mirrorX: true,
      },
      waving: { animationName: 'w_cute_joy01_f', mirrorX: false },
      jumping: { animationName: 'z_test_F_negi01', mirrorX: false },
      failed: { animationName: 'w_happy_sad01_f', mirrorX: false },
      waiting: { animationName: 'w_happy_listen01_f', mirrorX: false },
      running: { animationName: 'w_happy_doubt01_f', mirrorX: false },
      review: { animationName: 'w_happy_doubt02_f', mirrorX: false },
    })
  })

  it('Codex hover인 jumping에는 z_test_F_negi01을 의미 후보보다 우선한다', () => {
    const mappings = recommendCodexPetMappings([
      'idle',
      'jump',
      'w_happy_surprise01_f',
      'z_test_F_negi01',
    ])

    expect(mappings.jumping).toEqual({
      animationName: 'z_test_F_negi01',
      mirrorX: false,
    })
  })

  it('반환된 모든 이름이 입력 animation 목록에 실제로 존재한다', () => {
    const animations = ['original-idle', 'original-action']
    const mappings = recommendCodexPetMappings(animations)

    for (const mapping of Object.values(mappings)) {
      expect(animations).toContain(mapping.animationName)
    }
  })

  it('빈 animation 목록을 ANIMATION_MISSING으로 거부한다', () => {
    expect(() => recommendCodexPetMappings([])).toThrow(
      CodexPetAnimationMappingError,
    )
    expect(() => recommendCodexPetMappings(['', '   '])).toThrowError(
      expect.objectContaining({ code: 'ANIMATION_MISSING' }),
    )
  })
})
