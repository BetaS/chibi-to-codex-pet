import { SpineRuntimeProfileError } from './versionedRuntimeError'
import type {
  SpineRuntimeBounds,
  SpineRuntimeKey,
  SpineRuntimeProjection,
} from './versionedRuntimeTypes'

export function assertRuntimeProjection(
  projection: SpineRuntimeProjection,
  runtimeKey: SpineRuntimeKey,
): void {
  if (
    ![
      projection.x,
      projection.y,
      projection.width,
      projection.height,
    ].every(Number.isFinite) ||
    projection.width === 0 ||
    projection.height <= 0
  ) {
    throw new SpineRuntimeProfileError(
      'RUNTIME_PROFILE_PARSE_FAILED',
      'Spine runtime projection은 유한한 non-zero 영역이어야 합니다.',
      { runtimeKey },
    )
  }
}

export function normalizeRuntimeBounds(
  offset: { readonly x: number; readonly y: number },
  size: { readonly x: number; readonly y: number },
  runtimeKey: SpineRuntimeKey,
): SpineRuntimeBounds {
  const minX = Math.min(offset.x, offset.x + size.x)
  const minY = Math.min(offset.y, offset.y + size.y)
  const maxX = Math.max(offset.x, offset.x + size.x)
  const maxY = Math.max(offset.y, offset.y + size.y)
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    throw new SpineRuntimeProfileError(
      'RUNTIME_PROFILE_PARSE_FAILED',
      'Spine skeleton bounds에 유한하지 않은 값이 있습니다.',
      { runtimeKey },
    )
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function safelyDispose(dispose: () => void): void {
  try {
    dispose()
  } catch {
    // Disposal is best effort and remains idempotent at the facade boundary.
  }
}
