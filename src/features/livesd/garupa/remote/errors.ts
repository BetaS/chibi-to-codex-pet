export type GarupaRemoteErrorCode =
  | 'GARUPA_REMOTE_MANIFEST_INVALID'
  | 'GARUPA_REMOTE_URL_INVALID'
  | 'GARUPA_REMOTE_NETWORK_OR_CORS'
  | 'GARUPA_REMOTE_TIMEOUT'
  | 'GARUPA_REMOTE_ABORTED'
  | 'GARUPA_REMOTE_RESPONSE_TOO_LARGE'
  | 'GARUPA_REMOTE_CATALOG_INVALID'
  | 'GARUPA_REMOTE_BUILDDATA_INVALID'
  | 'GARUPA_REMOTE_SNAPSHOT_INVALID'
  | 'GARUPA_REMOTE_FAILED'

export type GarupaRemoteErrorDetails = Readonly<
  Record<string, string | number | boolean | undefined>
>

export class GarupaRemoteError extends Error {
  readonly code: GarupaRemoteErrorCode
  readonly details: GarupaRemoteErrorDetails

  constructor(
    code: GarupaRemoteErrorCode,
    message: string,
    details: GarupaRemoteErrorDetails = {},
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'GarupaRemoteError'
    this.code = code
    this.details = Object.freeze({ ...details })
  }
}

export function isGarupaRemoteError(
  value: unknown,
): value is GarupaRemoteError {
  return value instanceof GarupaRemoteError
}

export function normalizeGarupaRemoteError(
  value: unknown,
): GarupaRemoteError {
  if (isGarupaRemoteError(value)) return value
  return new GarupaRemoteError(
    'GARUPA_REMOTE_FAILED',
    'Garupa pinned snapshot을 처리하지 못했습니다.',
  )
}
