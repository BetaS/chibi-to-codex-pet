export type LiveSDPreviewErrorCode =
  | 'ANIMATION_MISSING'
  | 'ANIMATION_UNKNOWN'
  | 'ATLAS_IMAGE_DECODE_FAILED'
  | 'ATLAS_RUNTIME_PARSE_FAILED'
  | 'LOOK_RIG_MISSING'
  | 'PREVIEW_RENDER_FAILED'
  | 'PREVIEW_RENDERER_CREATE_FAILED'
  | 'SKELETON_HEADER_CORRUPT'
  | 'SKELETON_PARSE_FAILED'
  | 'WEBGL_UNSUPPORTED'

export class LiveSDPreviewError extends Error {
  readonly code: LiveSDPreviewErrorCode

  constructor(
    code: LiveSDPreviewErrorCode,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'LiveSDPreviewError'
    this.code = code
  }
}

export function isLiveSDPreviewError(
  error: unknown,
): error is LiveSDPreviewError {
  return error instanceof LiveSDPreviewError
}
