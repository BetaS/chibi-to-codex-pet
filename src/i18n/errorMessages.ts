import type { I18nContextValue } from './I18nContext'
import type { AppLocale } from './locale'
import type { MessageKey } from './messages'

export interface LocalizableErrorNotice {
  readonly code: string
  readonly message: string
  readonly details?: Readonly<Record<string, string | number | undefined>>
}

function errorMessageKey(code: string): MessageKey {
  if (code === 'PREVIEW_UNKNOWN_ERROR') return 'error.previewUnknown'
  if (code === 'ABORTED' || code === 'REMOTE_ABORTED') return 'error.aborted'
  if (code.includes('WEBGL') || code.includes('CANVAS')) return 'error.webgl'
  if (code.startsWith('RUNTIME_')) return 'error.runtime'
  if (code.startsWith('SHARED_SKELETON_')) return 'error.sharedSkeleton'
  if (code.includes('SKELETON')) return 'error.skeleton'
  if (code.includes('ANIMATION')) return 'error.animation'
  if (code.includes('LOOK_RIG')) return 'error.lookRig'
  if (code.startsWith('ARCHIVE_')) return 'error.archive'
  if (code.includes('ATLAS')) return 'error.atlas'
  if (code.startsWith('REMOTE_CATALOG_')) return 'error.remoteCatalog'
  if (
    code === 'REMOTE_ASSET_URL_INVALID' ||
    code === 'REMOTE_SELECTION_INVALID'
  ) return 'error.remoteSelection'
  if (
    code === 'REMOTE_NETWORK_OR_CORS' ||
    code === 'REMOTE_REDIRECT' ||
    code === 'REMOTE_TIMEOUT' ||
    code.endsWith('_HTTP')
  ) return 'error.remoteNetwork'
  if (code.startsWith('REMOTE_')) return 'error.remoteResource'
  if (code.includes('FRAME_') || code === 'SAMPLING_FAILED') return 'error.frame'
  if (code.includes('PNG_')) return 'error.png'
  if (
    code.includes('PACKAGE') ||
    code.includes('MANIFEST') ||
    code.includes('SPRITESHEET') ||
    code === 'DISPLAY_NAME_REQUIRED' ||
    code === 'PET_ID_INVALID' ||
    code === 'CODEX_PET_EXPORT_FAILED'
  ) return 'error.package'
  return 'error.generic'
}

function collectTechnicalDetails(
  notice: LocalizableErrorNotice,
): readonly string[] {
  const details = new Set<string>()
  for (const value of Object.values(notice.details ?? {})) {
    if (value !== undefined && String(value).trim()) {
      details.add(String(value))
    }
  }

  if (notice.code.includes('SKELETON')) {
    const versions = notice.message.match(/\b\d+\.\d+(?:\.\d+)?(?:D\d+)?\b/gu)
    if (versions?.[0] && versions[0] !== '3.6') {
      details.add(versions[0])
    }
  }
  return [...details]
}

export function localizeErrorNotice(
  locale: AppLocale,
  t: I18nContextValue['t'],
  notice: LocalizableErrorNotice,
): string {
  if (locale === 'ko' && notice.message.trim()) {
    return notice.message
  }

  const base = t(errorMessageKey(notice.code))
  const details = collectTechnicalDetails(notice)
  return details.length > 0 ? `${base} (${details.join(' · ')})` : base
}
