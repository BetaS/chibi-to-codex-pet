import type { SpineRuntimeKey } from './versionedRuntimeTypes'

export type SpineRuntimeProfileErrorCode =
  | 'RUNTIME_PROFILE_UNSUPPORTED'
  | 'RUNTIME_PROFILE_MISMATCH'
  | 'RUNTIME_PROFILE_LOAD_FAILED'
  | 'RUNTIME_PROFILE_API_INVALID'
  | 'RUNTIME_PROFILE_PARSE_FAILED'

export interface SpineRuntimeProfileErrorContext {
  readonly actualVersion?: string | null
  readonly requestedRuntimeKey?: SpineRuntimeKey | null
  readonly runtimeKey?: SpineRuntimeKey | null
}

export class SpineRuntimeProfileError extends Error {
  readonly code: SpineRuntimeProfileErrorCode
  readonly context: Readonly<SpineRuntimeProfileErrorContext>

  constructor(
    code: SpineRuntimeProfileErrorCode,
    message: string,
    context: SpineRuntimeProfileErrorContext = {},
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'SpineRuntimeProfileError'
    this.code = code
    this.context = Object.freeze({ ...context })
  }
}

export function isSpineRuntimeProfileError(
  error: unknown,
): error is SpineRuntimeProfileError {
  return error instanceof SpineRuntimeProfileError
}

export function normalizeSpineRuntimeProfileError(
  error: unknown,
  fallbackCode: SpineRuntimeProfileErrorCode,
  message: string,
  context: SpineRuntimeProfileErrorContext = {},
): SpineRuntimeProfileError {
  if (isSpineRuntimeProfileError(error)) {
    return error
  }
  return new SpineRuntimeProfileError(fallbackCode, message, context, error)
}
