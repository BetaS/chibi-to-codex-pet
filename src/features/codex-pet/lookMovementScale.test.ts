import { describe, expect, it } from 'vitest'

import {
  assertCodexPetLookMovementScale,
  CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
  CODEX_PET_LOOK_MOVEMENT_SCALE_MAX,
  CODEX_PET_LOOK_MOVEMENT_SCALE_MIN,
  CODEX_PET_LOOK_MOVEMENT_SCALE_STEP,
} from './lookMovementScale'

describe('Codex Pet look movement scale', () => {
  it('50–150% 범위와 5% step의 기본값을 제공한다', () => {
    expect(CODEX_PET_LOOK_MOVEMENT_SCALE_MIN).toBe(0.5)
    expect(CODEX_PET_LOOK_MOVEMENT_SCALE_MAX).toBe(1.5)
    expect(CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT).toBe(1)
    expect(CODEX_PET_LOOK_MOVEMENT_SCALE_STEP).toBe(0.05)
  })

  it.each([0.5, 0.55, 1, 1.45, 1.5])(
    '유효한 눈 이동 배율 %s를 허용한다',
    (value) => {
      expect(() => assertCodexPetLookMovementScale(value)).not.toThrow()
    },
  )

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, 0.49, 1.51, Infinity])(
    '범위를 벗어난 눈 이동 배율 %s를 거부한다',
    (value) => {
      expect(() => assertCodexPetLookMovementScale(value)).toThrow(RangeError)
    },
  )
})
