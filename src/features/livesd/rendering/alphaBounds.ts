import {
  assertLiveSDFramingScale,
  LIVE_SD_FRAMING_SCALE_DEFAULT,
} from './framingScale'
import {
  assertLiveSDFramingOffset,
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  LIVE_SD_FRAMING_OFFSET_REFERENCE_HEIGHT,
  LIVE_SD_FRAMING_OFFSET_REFERENCE_WIDTH,
  type LiveSDFramingOffset,
} from './framingOffset'

export const LIVE_SD_ALPHA_GUARD_PIXELS = 1
export const LIVE_SD_FRAME_INSET_PIXELS = 8

export interface LiveSDAlphaPixelBounds {
  /** Inclusive left-most pixel with alpha at or above the threshold. */
  readonly left: number
  /** Inclusive top-most pixel in top-down RGBA order. */
  readonly top: number
  /** Inclusive right-most pixel with alpha at or above the threshold. */
  readonly right: number
  /** Inclusive bottom-most pixel in top-down RGBA order. */
  readonly bottom: number
}

export interface LiveSDWorldBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface LiveSDProjection {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer.`)
  }
}

function assertFiniteWorldBounds(bounds: LiveSDWorldBounds): void {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  if (
    ![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(
      Number.isFinite,
    ) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('World bounds must have finite positive dimensions.')
  }
}

export function findLiveSDAlphaPixelBounds(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  minimumAlpha = 1,
): LiveSDAlphaPixelBounds | null {
  assertPositiveInteger(width, 'RGBA width')
  assertPositiveInteger(height, 'RGBA height')
  if (rgba.length !== width * height * 4) {
    throw new RangeError('RGBA data does not match the requested geometry.')
  }
  if (
    !Number.isInteger(minimumAlpha) ||
    minimumAlpha < 1 ||
    minimumAlpha > 255
  ) {
    throw new RangeError('Minimum alpha must be an integer from 1 through 255.')
  }

  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    let alphaOffset = (y * width) * 4 + 3
    for (let x = 0; x < width; x += 1, alphaOffset += 4) {
      if ((rgba[alphaOffset] ?? 0) < minimumAlpha) {
        continue
      }
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  return right < 0 ? null : { left, top, right, bottom }
}

export function convertLiveSDAlphaPixelBoundsToWorld(
  bounds: LiveSDAlphaPixelBounds,
  projection: LiveSDProjection,
  pixelWidth: number,
  pixelHeight: number,
  guardPixels = LIVE_SD_ALPHA_GUARD_PIXELS,
): LiveSDWorldBounds {
  assertPositiveInteger(pixelWidth, 'Projection pixel width')
  assertPositiveInteger(pixelHeight, 'Projection pixel height')
  if (
    !Number.isInteger(bounds.left) ||
    !Number.isInteger(bounds.top) ||
    !Number.isInteger(bounds.right) ||
    !Number.isInteger(bounds.bottom) ||
    bounds.left < 0 ||
    bounds.top < 0 ||
    bounds.right < bounds.left ||
    bounds.bottom < bounds.top ||
    bounds.right >= pixelWidth ||
    bounds.bottom >= pixelHeight
  ) {
    throw new RangeError('Alpha pixel bounds are outside the source geometry.')
  }
  if (
    ![
      projection.x,
      projection.y,
      projection.width,
      projection.height,
      guardPixels,
    ].every(Number.isFinite) ||
    projection.width <= 0 ||
    projection.height <= 0 ||
    guardPixels < 0
  ) {
    throw new RangeError('Projection and alpha guard must be finite and valid.')
  }

  const worldPerPixelX = projection.width / pixelWidth
  const worldPerPixelY = projection.height / pixelHeight
  const guardX = guardPixels * worldPerPixelX
  const guardY = guardPixels * worldPerPixelY

  // readWebGLFrame returns top-down rows. Include the complete inclusive
  // right/bottom pixels, then invert the top-down Y axis back into world space.
  return {
    minX:
      projection.x + bounds.left * worldPerPixelX - guardX,
    minY:
      projection.y +
      (1 - (bounds.bottom + 1) / pixelHeight) * projection.height -
      guardY,
    maxX:
      projection.x + (bounds.right + 1) * worldPerPixelX + guardX,
    maxY:
      projection.y +
      (1 - bounds.top / pixelHeight) * projection.height +
      guardY,
  }
}

export function mergeLiveSDWorldBounds(
  current: LiveSDWorldBounds | null,
  next: LiveSDWorldBounds,
): LiveSDWorldBounds {
  assertFiniteWorldBounds(next)
  if (!current) {
    return { ...next }
  }
  assertFiniteWorldBounds(current)
  return {
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
  }
}

export function calculateLiveSDFinalProjection(
  visibleBounds: LiveSDWorldBounds,
  targetWidth: number,
  targetHeight: number,
  insetPixels = LIVE_SD_FRAME_INSET_PIXELS,
  framingScale = LIVE_SD_FRAMING_SCALE_DEFAULT,
  framingOffset: LiveSDFramingOffset = LIVE_SD_FRAMING_OFFSET_DEFAULT,
  mirrorX = false,
): LiveSDProjection {
  assertFiniteWorldBounds(visibleBounds)
  assertLiveSDFramingScale(framingScale)
  assertLiveSDFramingOffset(framingOffset)
  if (
    !Number.isFinite(targetWidth) ||
    !Number.isFinite(targetHeight) ||
    targetWidth <= 0 ||
    targetHeight <= 0 ||
    !Number.isFinite(insetPixels) ||
    insetPixels < 0 ||
    insetPixels * 2 >= targetWidth ||
    insetPixels * 2 >= targetHeight
  ) {
    throw new RangeError('Target geometry and inset must be finite and valid.')
  }

  const visibleWidth = visibleBounds.maxX - visibleBounds.minX
  const visibleHeight = visibleBounds.maxY - visibleBounds.minY
  const availableWidth = targetWidth - insetPixels * 2
  const availableHeight = targetHeight - insetPixels * 2
  const autoPixelsPerWorldUnit = Math.min(
    availableWidth / visibleWidth,
    availableHeight / visibleHeight,
  )
  const pixelsPerWorldUnit = autoPixelsPerWorldUnit * framingScale
  const width = targetWidth / pixelsPerWorldUnit
  const height = targetHeight / pixelsPerWorldUnit
  const centerX = (visibleBounds.minX + visibleBounds.maxX) / 2
  const offsetWorldX =
    (framingOffset.x / LIVE_SD_FRAMING_OFFSET_REFERENCE_WIDTH) * width
  const offsetWorldY =
    (framingOffset.y / LIVE_SD_FRAMING_OFFSET_REFERENCE_HEIGHT) * height

  return {
    // Mirrored cells are flipped after WebGL readback. Invert the camera-space
    // X offset first so positive X still means screen-right in the final cell.
    x: centerX - width / 2 + (mirrorX ? offsetWorldX : -offsetWorldX),
    // Keep the pet grounded: the visible world minimum sits exactly one fixed
    // inset above the bottom of every 192x208 cell.
    y:
      visibleBounds.minY -
      insetPixels / pixelsPerWorldUnit +
      offsetWorldY,
    width,
    height,
  }
}
