export type LiveSDFrameSamplingErrorCode =
  | 'ABORTED'
  | 'ANIMATION_MISSING'
  | 'ATLAS_IMAGE_DECODE_FAILED'
  | 'ATLAS_RUNTIME_PARSE_FAILED'
  | 'CANVAS_UNSUPPORTED'
  | 'FRAME_BOUNDS_FAILED'
  | 'FRAMING_OFFSET_INVALID'
  | 'FRAMING_SCALE_INVALID'
  | 'FRAME_READBACK_FAILED'
  | 'FRAME_RENDER_FAILED'
  | 'LOOK_MOVEMENT_SCALE_INVALID'
  | 'LOOK_RIG_MISSING'
  | 'PNG_ENCODING_FAILED'
  | 'RUNTIME_LOAD_FAILED'
  | 'SAMPLING_FAILED'
  | 'SKELETON_PARSE_FAILED'
  | 'WEBGL_UNSUPPORTED'

export class LiveSDFrameSamplingError extends Error {
  readonly code: LiveSDFrameSamplingErrorCode

  constructor(
    code: LiveSDFrameSamplingErrorCode,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'LiveSDFrameSamplingError'
    this.code = code
  }
}

export function isLiveSDFrameSamplingError(
  error: unknown,
): error is LiveSDFrameSamplingError {
  return error instanceof LiveSDFrameSamplingError
}

export function throwIfSamplingAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return
  }

  throw new LiveSDFrameSamplingError(
    'ABORTED',
    'Codex Pet 프레임 생성을 취소했습니다.',
    { cause: signal.reason },
  )
}
