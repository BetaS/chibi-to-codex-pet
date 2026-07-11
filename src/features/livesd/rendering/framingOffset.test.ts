import { describe, expect, it } from 'vitest'

import {
  assertLiveSDFramingOffset,
  isDefaultLiveSDFramingOffset,
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  LIVE_SD_FRAMING_OFFSET_STEP,
  LIVE_SD_FRAMING_OFFSET_X_MAX,
  LIVE_SD_FRAMING_OFFSET_X_MIN,
  LIVE_SD_FRAMING_OFFSET_Y_MAX,
  LIVE_SD_FRAMING_OFFSET_Y_MIN,
} from './framingOffset'

describe('LiveSD framing offset', () => {
  it('192×208 cell의 반폭 범위와 1px 기본 계약을 제공한다', () => {
    expect(LIVE_SD_FRAMING_OFFSET_X_MIN).toBe(-96)
    expect(LIVE_SD_FRAMING_OFFSET_X_MAX).toBe(96)
    expect(LIVE_SD_FRAMING_OFFSET_Y_MIN).toBe(-104)
    expect(LIVE_SD_FRAMING_OFFSET_Y_MAX).toBe(104)
    expect(LIVE_SD_FRAMING_OFFSET_STEP).toBe(1)
    expect(LIVE_SD_FRAMING_OFFSET_DEFAULT).toEqual({ x: 0, y: 0 })
    expect(isDefaultLiveSDFramingOffset({ x: 0, y: 0 })).toBe(true)
    expect(isDefaultLiveSDFramingOffset({ x: 1, y: 0 })).toBe(false)
  })

  it.each([
    { x: -96, y: -104 },
    { x: 0, y: 0 },
    { x: 96, y: 104 },
  ])('유효한 integer offset $x,$y를 허용한다', (offset) => {
    expect(() => assertLiveSDFramingOffset(offset)).not.toThrow()
  })

  it.each([
    { x: -97, y: 0 },
    { x: 97, y: 0 },
    { x: 0, y: -105 },
    { x: 0, y: 105 },
    { x: 0.5, y: 0 },
    { x: Number.NaN, y: 0 },
  ])('잘못된 offset $x,$y를 거부한다', (offset) => {
    expect(() => assertLiveSDFramingOffset(offset)).toThrow(RangeError)
  })
})
