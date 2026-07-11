import type { PrskRemoteResourceKind } from './types'

export type PrskRemoteErrorCode =
  | 'REMOTE_ABORTED'
  | 'REMOTE_ASSET_URL_INVALID'
  | 'REMOTE_ATLAS_PAGE_LIMIT_EXCEEDED'
  | 'REMOTE_ATLAS_PAGE_UNSAFE'
  | 'REMOTE_CATALOG_EMPTY'
  | 'REMOTE_CATALOG_ENTRY_LIMIT_EXCEEDED'
  | 'REMOTE_CATALOG_HTTP'
  | 'REMOTE_CATALOG_INVALID'
  | 'REMOTE_CATALOG_ORIGIN_INVALID'
  | 'REMOTE_CATALOG_TOO_LARGE'
  | 'REMOTE_CATALOG_VERSION_UNSUPPORTED'
  | 'REMOTE_CONTENT_INVALID'
  | 'REMOTE_MODEL_HTTP'
  | 'REMOTE_NETWORK_OR_CORS'
  | 'REMOTE_REDIRECT'
  | 'REMOTE_RESOURCE_TOO_LARGE'
  | 'REMOTE_SELECTION_INVALID'
  | 'REMOTE_TIMEOUT'

export interface PrskRemoteErrorOptions extends ErrorOptions {
  readonly path?: string
  readonly resource?: PrskRemoteResourceKind
  readonly status?: number
  readonly url?: string
}

export class PrskRemoteError extends Error {
  readonly code: PrskRemoteErrorCode
  readonly path?: string
  readonly resource?: PrskRemoteResourceKind
  readonly status?: number
  readonly url?: string

  constructor(
    code: PrskRemoteErrorCode,
    message: string,
    options: PrskRemoteErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'PrskRemoteError'
    this.code = code
    this.path = options.path
    this.resource = options.resource
    this.status = options.status
    this.url = options.url
  }
}

export function isPrskRemoteError(error: unknown): error is PrskRemoteError {
  return error instanceof PrskRemoteError
}
