import { CODEX_PET_LOOK_DIRECTIONS } from './contract'

const FULL_CIRCLE_RADIANS = Math.PI * 2
const LOOK_DIRECTION_STEP_RADIANS =
  FULL_CIRCLE_RADIANS / CODEX_PET_LOOK_DIRECTIONS.length

/**
 * Resolves a pointer delta to Codex's clockwise 16-direction look index.
 * Index 0 points up; indices 4, 8 and 12 point right, down and left.
 */
export function calculateCodexPetLookDirectionIndex(
  dx: number,
  dy: number,
  deadZone = 1,
): number | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    throw new TypeError('pointer delta는 유한한 숫자여야 합니다.')
  }
  if (!Number.isFinite(deadZone) || deadZone < 0) {
    throw new RangeError('dead zone은 0 이상의 유한한 숫자여야 합니다.')
  }
  if (Math.hypot(dx, dy) <= deadZone) {
    return null
  }

  const clockwiseRadians = Math.atan2(dx, -dy)
  const normalizedRadians =
    clockwiseRadians < 0
      ? clockwiseRadians + FULL_CIRCLE_RADIANS
      : clockwiseRadians

  return (
    Math.round(normalizedRadians / LOOK_DIRECTION_STEP_RADIANS) %
    CODEX_PET_LOOK_DIRECTIONS.length
  )
}
