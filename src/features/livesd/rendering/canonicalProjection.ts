import type { LiveSDProjection, LiveSDWorldBounds } from './alphaBounds'

export const LIVE_SD_CANONICAL_BOUNDS_PADDING_RATIO = 0.1

export function calculateLiveSDCanonicalCoarseProjection(
  bounds: LiveSDWorldBounds,
  targetWidth: number,
  targetHeight: number,
  paddingRatio = LIVE_SD_CANONICAL_BOUNDS_PADDING_RATIO,
): LiveSDProjection {
  const boundsWidth = bounds.maxX - bounds.minX
  const boundsHeight = bounds.maxY - bounds.minY
  if (
    ![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(
      Number.isFinite,
    ) ||
    !Number.isFinite(boundsWidth) ||
    !Number.isFinite(boundsHeight) ||
    boundsWidth <= 0 ||
    boundsHeight <= 0 ||
    !Number.isFinite(paddingRatio) ||
    paddingRatio < 0 ||
    !Number.isFinite(targetWidth) ||
    !Number.isFinite(targetHeight) ||
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    throw new RangeError(
      'Canonical LiveSD bounds and target geometry must be finite and positive.',
    )
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  let width = boundsWidth * (1 + paddingRatio * 2)
  let height = boundsHeight * (1 + paddingRatio * 2)
  const targetAspect = targetWidth / targetHeight

  if (width / height < targetAspect) {
    width = height * targetAspect
  } else {
    height = width / targetAspect
  }

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  }
}
