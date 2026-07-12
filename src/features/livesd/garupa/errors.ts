import type { MessageKey, TranslationValues } from '../../../i18n'

const PACK_ERROR_CODES = new Set([
  'GARUPA_PACK_CORRUPT',
  'GARUPA_PACK_ENCRYPTED',
  'GARUPA_PACK_TOO_LARGE',
  'GARUPA_PACK_UNSAFE_PATH',
  'GARUPA_PACK_PATH_COLLISION',
  'GARUPA_PACK_HASH_MISMATCH',
  'GARUPA_MANIFEST_MISSING',
  'GARUPA_MANIFEST_INVALID',
  'GARUPA_MODEL_AMBIGUOUS',
  'GARUPA_ATLAS_INVALID',
  'GARUPA_ATLAS_PAGE_MISSING',
  'GARUPA_TEXTURE_INVALID',
  'GARUPA_ALPHA_MODE_UNSUPPORTED',
  'GARUPA_SKELETON_CORRUPT',
  'GARUPA_SKELETON_UNSUPPORTED_VERSION',
])
const RENDERING_ERROR_CODES = new Set([
  'GARUPA_ANIMATION_MISSING',
  'GARUPA_ATLAS_RUNTIME_PARSE_FAILED',
  'GARUPA_SKELETON_PARSE_FAILED',
  'GARUPA_PREVIEW_RENDER_FAILED',
  'GARUPA_LOOK_RIG_UNSUPPORTED',
  'GARUPA_FRAME_RENDER_FAILED',
  'GARUPA_FRAME_READBACK_FAILED',
  'GARUPA_RENDERING_FAILED',
])
const RUNTIME_ERROR_CODES = new Set([
  'RUNTIME_PROFILE_UNSUPPORTED',
  'RUNTIME_PROFILE_MISMATCH',
  'RUNTIME_PROFILE_LOAD_FAILED',
  'RUNTIME_PROFILE_API_INVALID',
  'RUNTIME_PROFILE_PARSE_FAILED',
])
const REMOTE_ERROR_CODES = new Set([
  'GARUPA_REMOTE_MANIFEST_INVALID',
  'GARUPA_REMOTE_URL_INVALID',
  'GARUPA_REMOTE_NETWORK_OR_CORS',
  'GARUPA_REMOTE_TIMEOUT',
  'GARUPA_REMOTE_ABORTED',
  'GARUPA_REMOTE_RESPONSE_TOO_LARGE',
  'GARUPA_REMOTE_CATALOG_INVALID',
  'GARUPA_REMOTE_BUILDDATA_INVALID',
  'GARUPA_REMOTE_SNAPSHOT_INVALID',
  'GARUPA_REMOTE_FAILED',
])
const KNOWN_CODES = new Set([
  ...PACK_ERROR_CODES,
  ...RENDERING_ERROR_CODES,
  ...RUNTIME_ERROR_CODES,
  ...REMOTE_ERROR_CODES,
  'GARUPA_ASSET_FAMILY_UNSUPPORTED',
  'GARUPA_LIVE_SPRITE_UNSUPPORTED',
])
const SAFE_DETAIL_KEYS = new Set([
  'actualVersion',
  'bytes',
  'compatibility',
  'maxBytes',
  'requestedRuntimeKey',
  'runtimeKey',
  'sdAssetBundleName',
  'status',
])

export interface GarupaDiagnostic {
  readonly code: string
  readonly generation: number
  readonly messageKey: MessageKey
  readonly values: TranslationValues
}

function messageKeyForCode(code: string): MessageKey {
  if (code === 'GARUPA_LIVE_SPRITE_UNSUPPORTED') {
    return 'garupa.error.liveSpriteUnsupported'
  }
  if (code === 'GARUPA_ASSET_FAMILY_UNSUPPORTED') {
    return 'garupa.error.assetFamilyUnsupported'
  }
  if (PACK_ERROR_CODES.has(code)) return 'garupa.error.pack'
  if (RENDERING_ERROR_CODES.has(code)) return 'garupa.error.rendering'
  if (RUNTIME_ERROR_CODES.has(code)) return 'garupa.error.runtime'
  if (REMOTE_ERROR_CODES.has(code)) return 'garupa.error.remote'
  return 'garupa.error.generic'
}

function safeDetails(value: unknown): TranslationValues {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const details: Record<string, string | number> = {}
  for (const [key, detail] of Object.entries(value)) {
    if (!SAFE_DETAIL_KEYS.has(key)) continue
    if (typeof detail === 'number' && Number.isFinite(detail)) {
      details[key] = detail
    } else if (typeof detail === 'string' && detail.length <= 128) {
      details[key] = detail
    }
  }
  return Object.freeze(details)
}

export function toGarupaDiagnostic(
  error: unknown,
  generation: number,
): GarupaDiagnostic {
  const candidate = error as { readonly code?: unknown; readonly details?: unknown }
  const candidateCode =
    typeof candidate?.code === 'string' ? candidate.code : 'GARUPA_FAILED'
  const code = KNOWN_CODES.has(candidateCode) ? candidateCode : 'GARUPA_FAILED'
  return Object.freeze({
    code,
    generation,
    messageKey: messageKeyForCode(code),
    values: safeDetails(candidate?.details),
  })
}
