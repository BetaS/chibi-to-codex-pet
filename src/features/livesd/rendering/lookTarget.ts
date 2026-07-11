import type { LiveSDProjection } from './alphaBounds'

export const LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX = 2
export const LIVE_SD_LOOK_VERTICAL_RADIUS_PX = 1.5
export const LIVE_SD_LOOK_REFERENCE_WIDTH = 192
export const LIVE_SD_LOOK_REFERENCE_HEIGHT = 208

const MATRIX_DETERMINANT_EPSILON = 1e-8

/** A normalized gaze vector where positive x is right and positive y is up. */
export interface LiveSDLookTarget {
  readonly x: number
  readonly y: number
}

export interface LiveSDLookParentMatrix {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
}

export interface LiveSDLookDelta {
  readonly x: number
  readonly y: number
}

export function normalizeLiveSDLookTarget(
  x: number,
  y: number,
): LiveSDLookTarget {
  if (![x, y].every(Number.isFinite)) {
    throw new RangeError('LiveSD look target must be finite.')
  }

  const magnitude = Math.hypot(x, y)
  if (magnitude <= 1) {
    return { x, y }
  }

  return { x: x / magnitude, y: y / magnitude }
}

export function calculateLiveSDLookWorldDeltaFromTarget(
  projection: LiveSDProjection,
  target: LiveSDLookTarget,
  horizontalRadiusPx = LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX,
  verticalRadiusPx = LIVE_SD_LOOK_VERTICAL_RADIUS_PX,
  referenceWidth = LIVE_SD_LOOK_REFERENCE_WIDTH,
  referenceHeight = LIVE_SD_LOOK_REFERENCE_HEIGHT,
): LiveSDLookDelta {
  if (
    ![
      projection.x,
      projection.y,
      projection.width,
      projection.height,
      target.x,
      target.y,
      horizontalRadiusPx,
      verticalRadiusPx,
      referenceWidth,
      referenceHeight,
    ].every(Number.isFinite) ||
    projection.width <= 0 ||
    projection.height <= 0 ||
    horizontalRadiusPx < 0 ||
    verticalRadiusPx < 0 ||
    referenceWidth <= 0 ||
    referenceHeight <= 0
  ) {
    throw new RangeError('Look projection, target and radii must be finite and valid.')
  }

  return {
    x: target.x * horizontalRadiusPx * (projection.width / referenceWidth),
    y: target.y * verticalRadiusPx * (projection.height / referenceHeight),
  }
}

export function calculateLiveSDLookWorldDelta(
  projection: LiveSDProjection,
  directionDegrees: number,
  horizontalRadiusPx = LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX,
  verticalRadiusPx = LIVE_SD_LOOK_VERTICAL_RADIUS_PX,
  referenceWidth = LIVE_SD_LOOK_REFERENCE_WIDTH,
  referenceHeight = LIVE_SD_LOOK_REFERENCE_HEIGHT,
): LiveSDLookDelta {
  if (!Number.isFinite(directionDegrees)) {
    throw new RangeError('LiveSD look direction must be finite.')
  }

  const radians = (directionDegrees * Math.PI) / 180
  return calculateLiveSDLookWorldDeltaFromTarget(
    projection,
    { x: Math.sin(radians), y: Math.cos(radians) },
    horizontalRadiusPx,
    verticalRadiusPx,
    referenceWidth,
    referenceHeight,
  )
}

export function convertLiveSDWorldDeltaToLocal(
  parentMatrix: LiveSDLookParentMatrix,
  worldDelta: LiveSDLookDelta,
  determinantEpsilon = MATRIX_DETERMINANT_EPSILON,
): LiveSDLookDelta {
  const { a, b, c, d } = parentMatrix
  const { x: worldX, y: worldY } = worldDelta
  const determinant = a * d - b * c
  if (
    ![a, b, c, d, worldX, worldY, determinantEpsilon].every(
      Number.isFinite,
    ) ||
    determinantEpsilon <= 0 ||
    Math.abs(determinant) < determinantEpsilon
  ) {
    throw new RangeError('LiveSD eye parent matrix must be finite and invertible.')
  }

  return {
    x: (d * worldX - b * worldY) / determinant,
    y: (-c * worldX + a * worldY) / determinant,
  }
}
