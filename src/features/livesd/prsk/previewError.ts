import type { PreviewUiNotice } from '../ui/previewError'
import { isPrskArchiveImportError } from './archive'
import { DevelopmentCharacterAssetError } from './development'
import { isPrskRemoteError } from './remote'

export function toPrskPreviewUiNotice(
  error: unknown,
): PreviewUiNotice | null {
  if (
    isPrskArchiveImportError(error) ||
    isPrskRemoteError(error) ||
    error instanceof DevelopmentCharacterAssetError
  ) {
    const details: Record<string, string | number> = {}
    for (const key of ['path', 'resource', 'status', 'url'] as const) {
      const value = Reflect.get(error, key)
      if (typeof value === 'string' || typeof value === 'number') {
        details[key] = value
      }
    }
    return {
      code: error.code,
      details: Object.keys(details).length > 0 ? details : undefined,
      message: error.message,
    }
  }
  return null
}
