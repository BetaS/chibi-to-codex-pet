import { describe, expect, it } from 'vitest'

import {
  calculateLiveSDLookWorldDelta,
  calculateLiveSDLookWorldDeltaFromTarget,
  convertLiveSDWorldDeltaToLocal,
  normalizeLiveSDLookTarget,
} from './lookTarget'

const projection = { x: -96, y: -104, width: 192, height: 208 }

describe('LiveSD look target rendering', () => {
  it('pointer target을 단위 원으로 제한하고 screen right/world up 축을 보존한다', () => {
    expect(normalizeLiveSDLookTarget(0.5, -0.25)).toEqual({
      x: 0.5,
      y: -0.25,
    })
    const diagonal = normalizeLiveSDLookTarget(2, 2)
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1)
    expect(diagonal.x).toBeCloseTo(diagonal.y)

    expect(
      calculateLiveSDLookWorldDeltaFromTarget(projection, { x: 1, y: 1 }),
    ).toEqual({ x: 2, y: 1.5 })
  })

  it('16방향 degree와 실시간 target이 같은 world delta를 만든다', () => {
    const degrees = calculateLiveSDLookWorldDelta(projection, 45)
    const target = calculateLiveSDLookWorldDeltaFromTarget(projection, {
      x: Math.SQRT1_2,
      y: Math.SQRT1_2,
    })

    expect(target.x).toBeCloseTo(degrees.x)
    expect(target.y).toBeCloseTo(degrees.y)
  })

  it('animated parent의 world delta를 local delta로 역변환한다', () => {
    expect(
      convertLiveSDWorldDeltaToLocal(
        { a: 0, b: -1, c: 1, d: 0 },
        { x: 2, y: 0 },
      ),
    ).toEqual(expect.objectContaining({ x: expect.closeTo(0), y: -2 }))

    expect(() =>
      convertLiveSDWorldDeltaToLocal(
        { a: 1, b: 2, c: 2, d: 4 },
        { x: 1, y: 1 },
      ),
    ).toThrow(RangeError)
  })
})
