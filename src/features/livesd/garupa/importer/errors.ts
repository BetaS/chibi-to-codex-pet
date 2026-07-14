export const GARUPA_PACK_ERROR_CODES = [
  'GARUPA_PACK_CORRUPT',
  'GARUPA_PACK_ENCRYPTED',
  'GARUPA_PACK_TOO_LARGE',
  'GARUPA_PACK_UNSAFE_PATH',
  'GARUPA_PACK_PATH_COLLISION',
  'GARUPA_PACK_HASH_MISMATCH',
  'GARUPA_MANIFEST_MISSING',
  'GARUPA_MANIFEST_INVALID',
  'GARUPA_ASSET_FAMILY_UNSUPPORTED',
  'GARUPA_LIVE_SPRITE_UNSUPPORTED',
  'GARUPA_MODEL_AMBIGUOUS',
  'GARUPA_ATLAS_INVALID',
  'GARUPA_ATLAS_PAGE_MISSING',
  'GARUPA_TEXTURE_INVALID',
  'GARUPA_ALPHA_MODE_UNSUPPORTED',
  'GARUPA_SKELETON_CORRUPT',
  'GARUPA_SKELETON_UNSUPPORTED_VERSION',
] as const

export type GarupaPackImportErrorCode =
  (typeof GARUPA_PACK_ERROR_CODES)[number]

export interface GarupaPackImportErrorOptions extends ErrorOptions {
  readonly actualVersion?: string
  readonly path?: string
}

export class GarupaPackImportError extends Error {
  readonly code: GarupaPackImportErrorCode
  readonly actualVersion?: string
  readonly path?: string

  constructor(
    code: GarupaPackImportErrorCode,
    message: string,
    options: GarupaPackImportErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'GarupaPackImportError'
    this.code = code
    this.actualVersion = options.actualVersion
    this.path = options.path
  }
}

export function isGarupaPackImportError(
  error: unknown,
): error is GarupaPackImportError {
  return error instanceof GarupaPackImportError
}
