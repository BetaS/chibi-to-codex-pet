export type LiveSDModelErrorCode =
  | 'ATLAS_PAGE_LIST_EMPTY'
  | 'ATLAS_PAGE_PATH_INVALID'

export interface LiveSDModelErrorOptions extends ErrorOptions {
  readonly path?: string
}

export class LiveSDModelError extends Error {
  readonly code: LiveSDModelErrorCode
  readonly path?: string

  constructor(
    code: LiveSDModelErrorCode,
    message: string,
    options: LiveSDModelErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'LiveSDModelError'
    this.code = code
    this.path = options.path
  }
}

export function isLiveSDModelError(error: unknown): error is LiveSDModelError {
  return error instanceof LiveSDModelError
}
