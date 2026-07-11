import { describe, expect, it } from 'vitest'

import {
  calculateLiveSDFinalProjection,
  convertLiveSDAlphaPixelBoundsToWorld,
  findLiveSDAlphaPixelBounds,
  mergeLiveSDWorldBounds,
} from './alphaBounds'

function createRgba(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4)
}

function setAlpha(
  rgba: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  alpha: number,
): void {
  rgba[(y * width + x) * 4 + 3] = alpha
}

describe('LiveSD alpha bounds', () => {
  it('top-down RGBA의 minimum alpha 이상인 inclusive bbox를 찾는다', () => {
    const rgba = createRgba(5, 4)
    setAlpha(rgba, 5, 4, 0, 1)
    setAlpha(rgba, 5, 3, 1, 2)
    setAlpha(rgba, 5, 1, 3, 255)

    expect(findLiveSDAlphaPixelBounds(rgba, 5, 4)).toEqual({
      left: 1,
      top: 0,
      right: 4,
      bottom: 3,
    })
    expect(findLiveSDAlphaPixelBounds(rgba, 5, 4, 2)).toEqual({
      left: 1,
      top: 1,
      right: 3,
      bottom: 3,
    })
  })

  it('완전 투명한 RGBA는 null을 반환한다', () => {
    expect(findLiveSDAlphaPixelBounds(createRgba(3, 2), 3, 2)).toBeNull()
  })

  it('inclusive right/bottom edge, top-down Y flip과 1px world guard를 보존한다', () => {
    expect(
      convertLiveSDAlphaPixelBoundsToWorld(
        { left: 10, top: 20, right: 29, bottom: 59 },
        { x: -100, y: -200, width: 384, height: 416 },
        192,
        208,
      ),
    ).toEqual({
      minX: -82,
      minY: 94,
      maxX: -38,
      maxY: 178,
    })
  })

  it('world bounds 합집합을 계산한다', () => {
    expect(
      mergeLiveSDWorldBounds(
        { minX: -10, minY: -20, maxX: 10, maxY: 20 },
        { minX: -15, minY: -5, maxX: 25, maxY: 30 },
      ),
    ).toEqual({ minX: -15, minY: -20, maxX: 25, maxY: 30 })
  })

  it('가로 제한 pose를 8px inset에 맞추고 bottom baseline을 고정한다', () => {
    const projection = calculateLiveSDFinalProjection(
      { minX: -63, minY: -59, maxX: 63, maxY: 59 },
      192,
      208,
    )
    const scale = 176 / 126

    expect(projection.width).toBeCloseTo(192 / scale)
    expect(projection.height).toBeCloseTo(208 / scale)
    expect(projection.x).toBeCloseTo(-projection.width / 2)
    expect(((-59 - projection.y) / projection.height) * 208).toBeCloseTo(8)
    expect((126 / projection.width) * 192).toBeCloseTo(176)
  })

  it('세로 제한 pose도 aspect를 유지하고 최소 8px inset을 확보한다', () => {
    const projection = calculateLiveSDFinalProjection(
      { minX: -43.5, minY: -52, maxX: 43.5, maxY: 52 },
      192,
      208,
    )
    const scale = 192 / 104

    expect(projection.width / projection.height).toBeCloseTo(192 / 208)
    expect((104 / projection.height) * 208).toBeCloseTo(192)
    expect((87 / projection.width) * 192).toBeLessThanOrEqual(176)
    expect(((projection.x + projection.width / 2) * scale)).toBeCloseTo(0)
  })

  it('80% framing scale에서 중심과 8px baseline을 유지하며 view를 1.25배 넓힌다', () => {
    const bounds = { minX: -63, minY: -59, maxX: 63, maxY: 59 }
    const automatic = calculateLiveSDFinalProjection(bounds, 192, 208)
    const scaled = calculateLiveSDFinalProjection(bounds, 192, 208, 8, 0.8)

    expect(scaled.width).toBeCloseTo(automatic.width / 0.8)
    expect(scaled.height).toBeCloseTo(automatic.height / 0.8)
    expect(scaled.x + scaled.width / 2).toBeCloseTo(
      automatic.x + automatic.width / 2,
    )
    expect(((bounds.minY - scaled.y) / scaled.height) * 208).toBeCloseTo(8)
    expect((126 / scaled.width) * 192).toBeCloseTo(176 * 0.8)
  })

  it('150% scale과 cell pixel offset을 screen 좌표로 적용한다', () => {
    const bounds = { minX: -63, minY: -59, maxX: 63, maxY: 59 }
    const automatic = calculateLiveSDFinalProjection(bounds, 192, 208)
    const scaled = calculateLiveSDFinalProjection(bounds, 192, 208, 8, 1.5)
    const moved = calculateLiveSDFinalProjection(
      bounds,
      192,
      208,
      8,
      1.5,
      { x: 12, y: 8 },
    )
    const mirrored = calculateLiveSDFinalProjection(
      bounds,
      192,
      208,
      8,
      1.5,
      { x: 12, y: 8 },
      true,
    )

    expect(moved.width).toBeCloseTo(automatic.width / 1.5)
    expect(((scaled.x - moved.x) / moved.width) * 192).toBeCloseTo(12)
    expect(((moved.y - scaled.y) / moved.height) * 208).toBeCloseTo(8)
    expect(mirrored.x - scaled.x).toBeCloseTo(
      (12 / 192) * moved.width,
    )
  })

  it('잘못된 RGBA, bounds와 inset 입력을 거부한다', () => {
    expect(() => findLiveSDAlphaPixelBounds(new Uint8Array(3), 1, 1)).toThrow(
      RangeError,
    )
    expect(() =>
      convertLiveSDAlphaPixelBoundsToWorld(
        { left: 0, top: 0, right: 3, bottom: 0 },
        { x: 0, y: 0, width: 1, height: 1 },
        3,
        1,
      ),
    ).toThrow(RangeError)
    expect(() =>
      calculateLiveSDFinalProjection(
        { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        16,
        16,
        8,
      ),
    ).toThrow(RangeError)
    expect(() =>
      calculateLiveSDFinalProjection(
        { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        192,
        208,
        8,
        1.51,
      ),
    ).toThrow(RangeError)
  })
})
