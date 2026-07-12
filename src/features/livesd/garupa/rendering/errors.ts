export type GarupaRenderingErrorCode =
  | 'GARUPA_ANIMATION_MISSING'
  | 'GARUPA_ATLAS_RUNTIME_PARSE_FAILED'
  | 'GARUPA_FRAME_READBACK_FAILED'
  | 'GARUPA_FRAME_RENDER_FAILED'
  | 'GARUPA_LOOK_RIG_UNSUPPORTED'
  | 'GARUPA_PREVIEW_RENDER_FAILED'
  | 'GARUPA_RENDERING_FAILED'
  | 'GARUPA_SKELETON_PARSE_FAILED'

export type GarupaRenderingErrorContextValue =
  | boolean
  | null
  | number
  | string

export type GarupaRenderingErrorContext = Readonly<
  Record<string, GarupaRenderingErrorContextValue>
>

export class GarupaRenderingError extends Error {
  readonly code: GarupaRenderingErrorCode
  readonly context: GarupaRenderingErrorContext

  constructor(
    code: GarupaRenderingErrorCode,
    message: string,
    context: GarupaRenderingErrorContext = {},
    options: ErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'GarupaRenderingError'
    this.code = code
    this.context = Object.freeze({ ...context })
  }
}

export function isGarupaRenderingError(
  error: unknown,
): error is GarupaRenderingError {
  return error instanceof GarupaRenderingError
}

export function normalizeGarupaRenderingError(
  error: unknown,
  code: GarupaRenderingErrorCode,
  message: string,
  context: GarupaRenderingErrorContext = {},
): GarupaRenderingError {
  return isGarupaRenderingError(error)
    ? error
    : new GarupaRenderingError(code, message, context, { cause: error })
}

export function throwIfGarupaSamplingAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return

  throw new GarupaRenderingError(
    'GARUPA_RENDERING_FAILED',
    'Garupa frame sampling was cancelled.',
    { stage: 'aborted' },
    { cause: signal.reason },
  )
}
