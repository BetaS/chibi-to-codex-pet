import { describe, expect, it } from 'vitest'

import {
  assertLiveSDFramingScale,
  LIVE_SD_FRAMING_SCALE_DEFAULT,
  LIVE_SD_FRAMING_SCALE_MAX,
  LIVE_SD_FRAMING_SCALE_MIN,
  LIVE_SD_FRAMING_SCALE_STEP,
} from './framingScale'

describe('LiveSD framing scale', () => {
  it('80–150% 범위와 1% step의 기본값을 제공한다', () => {
    expect(LIVE_SD_FRAMING_SCALE_MIN).toBe(0.8)
    expect(LIVE_SD_FRAMING_SCALE_MAX).toBe(1.5)
    expect(LIVE_SD_FRAMING_SCALE_DEFAULT).toBe(1)
    expect(LIVE_SD_FRAMING_SCALE_STEP).toBe(0.01)
  })

  it.each([0.8, 0.81, 0.9, 0.99, 1, 1.01, 1.5])(
    '유효한 framing scale %s를 허용한다',
    (value) => {
      expect(() => assertLiveSDFramingScale(value)).not.toThrow()
    },
  )

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, 0.79, 1.51, Infinity])(
    '범위를 벗어난 framing scale %s를 거부한다',
    (value) => {
      expect(() => assertLiveSDFramingScale(value)).toThrow(RangeError)
    },
  )
})
