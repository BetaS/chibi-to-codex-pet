import { describe, expect, it } from 'vitest'

import { CODEX_PET_LOOK_DIRECTIONS } from './contract'
import { calculateCodexPetLookDirectionIndex } from './lookDirection'

describe('Codex Pet look direction', () => {
  it.each([
    ['위', 0, -10, 0],
    ['오른쪽', 10, 0, 4],
    ['아래', 0, 10, 8],
    ['왼쪽', -10, 0, 12],
    ['오른쪽 위 대각선', 10, -10, 2],
    ['오른쪽 아래 대각선', 10, 10, 6],
    ['왼쪽 아래 대각선', -10, 10, 10],
    ['왼쪽 위 대각선', -10, -10, 14],
  ])('%s pointer를 시계 방향 index로 계산한다', (_label, dx, dy, expected) => {
    expect(calculateCodexPetLookDirectionIndex(dx, dy)).toBe(expected)
  })

  it('가장 가까운 22.5도 방향으로 반올림하고 360도를 index 0으로 감싼다', () => {
    const vector = (degrees: number) => {
      const radians = (degrees * Math.PI) / 180
      return {
        dx: Math.sin(radians) * 10,
        dy: -Math.cos(radians) * 10,
      }
    }

    const justBeforeFirstBoundary = vector(11.24)
    const justAfterFirstBoundary = vector(11.26)
    const justBeforeWrap = vector(348.74)
    const justAfterWrap = vector(348.76)

    expect(calculateCodexPetLookDirectionIndex(
      justBeforeFirstBoundary.dx,
      justBeforeFirstBoundary.dy,
    )).toBe(0)
    expect(calculateCodexPetLookDirectionIndex(
      justAfterFirstBoundary.dx,
      justAfterFirstBoundary.dy,
    )).toBe(1)
    expect(calculateCodexPetLookDirectionIndex(
      justBeforeWrap.dx,
      justBeforeWrap.dy,
    )).toBe(15)
    expect(calculateCodexPetLookDirectionIndex(
      justAfterWrap.dx,
      justAfterWrap.dy,
    )).toBe(0)
  })

  it('중심 dead zone 안과 경계에서는 look frame을 선택하지 않는다', () => {
    expect(calculateCodexPetLookDirectionIndex(0, 0)).toBeNull()
    expect(calculateCodexPetLookDirectionIndex(0.6, 0.8)).toBeNull()
    expect(calculateCodexPetLookDirectionIndex(1.01, 0)).toBe(4)
    expect(calculateCodexPetLookDirectionIndex(2, 0, 2)).toBeNull()
    expect(calculateCodexPetLookDirectionIndex(2.01, 0, 2)).toBe(4)
  })

  it('계산 index가 고정 row와 column을 가리킨다', () => {
    const index = calculateCodexPetLookDirectionIndex(-10, 10)

    expect(index).toBe(10)
    expect(CODEX_PET_LOOK_DIRECTIONS[index!]).toEqual({
      index: 10,
      angleDegrees: 225,
      row: 10,
      column: 2,
    })
  })

  it('유효하지 않은 pointer delta와 dead zone을 거부한다', () => {
    expect(() =>
      calculateCodexPetLookDirectionIndex(Number.NaN, 0),
    ).toThrow(TypeError)
    expect(() => calculateCodexPetLookDirectionIndex(0, 2, -1)).toThrow(
      RangeError,
    )
  })
})
