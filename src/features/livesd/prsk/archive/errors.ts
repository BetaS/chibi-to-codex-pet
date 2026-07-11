export type PrskArchiveImportErrorCode =
  | 'ARCHIVE_CORRUPT'
  | 'ARCHIVE_ENCRYPTED_ENTRY'
  | 'ARCHIVE_ENTRY_LIMIT_EXCEEDED'
  | 'ARCHIVE_PATH_COLLISION'
  | 'ARCHIVE_SKEL_FORBIDDEN'
  | 'ARCHIVE_TOO_LARGE'
  | 'ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED'
  | 'ARCHIVE_UNSAFE_PATH'
  | 'ATLAS_DUPLICATE_PAGE'
  | 'ATLAS_INVALID_TEXT'
  | 'ATLAS_MISSING'
  | 'ATLAS_MULTIPLE'
  | 'ATLAS_PAGE_LIST_EMPTY'
  | 'ATLAS_PAGE_MISSING'
  | 'ATLAS_UNSUPPORTED_PAGE_FORMAT'

export interface PrskArchiveImportErrorOptions extends ErrorOptions {
  readonly path?: string
}

export class PrskArchiveImportError extends Error {
  readonly code: PrskArchiveImportErrorCode
  readonly path?: string

  constructor(
    code: PrskArchiveImportErrorCode,
    message: string,
    options: PrskArchiveImportErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'PrskArchiveImportError'
    this.code = code
    this.path = options.path
  }
}

export function isPrskArchiveImportError(
  error: unknown,
): error is PrskArchiveImportError {
  return error instanceof PrskArchiveImportError
}
