import { GarupaPackImportError } from './errors'
import { normalizeGarupaPackPath } from './path'
import type {
  GarupaSpinePackManifest,
  GarupaSpinePackProvenance,
} from './types'

const IDENTITY = /^[A-Za-z0-9_-]{1,128}$/u
const IMMUTABLE_REVISION = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u
const SHA256 = /^[a-f0-9]{64}$/u
const SOURCE_KIND = /^[a-z0-9][a-z0-9._-]{0,63}$/u
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/u

const ROOT_KEYS = [
  'schemaVersion',
  'gameId',
  'assetFamily',
  'sdAssetBundleName',
  'modelName',
  'skeletonPath',
  'atlasPath',
  'files',
  'provenance',
] as const

const PROVENANCE_KEYS = [
  'sourceKind',
  'sourceRevision',
  'acquiredAt',
] as const

type JsonObject = Record<string, unknown>

function invalid(message: string, path?: string): never {
  throw new GarupaPackImportError('GARUPA_MANIFEST_INVALID', message, {
    path,
  })
}

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${label}는 object여야 합니다.`)
  }
  return value as JsonObject
}

function assertExactKeys(
  object: JsonObject,
  keys: readonly string[],
  label: string,
): void {
  const expected = new Set(keys)
  if (
    Object.keys(object).length !== keys.length ||
    Object.keys(object).some((key) => !expected.has(key))
  ) {
    invalid(`${label}의 key가 schema 1과 일치하지 않습니다.`)
  }
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    invalid(`${label}는 비어 있지 않은 문자열이어야 합니다.`)
  }
  return value
}

function assertRfc3339(value: string): void {
  const match = RFC3339.exec(value)
  if (!match) invalid('provenance.acquiredAt은 RFC 3339 timestamp여야 합니다.')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = match[8] === undefined ? 0 : Number(match[8])
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9])
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59 ||
    !Number.isFinite(Date.parse(value))
  ) {
    invalid('provenance.acquiredAt은 유효한 RFC 3339 timestamp여야 합니다.')
  }
}

function parseProvenance(value: unknown): GarupaSpinePackProvenance {
  const provenance = asObject(value, 'provenance')
  assertExactKeys(provenance, PROVENANCE_KEYS, 'provenance')

  const sourceKind = asString(provenance.sourceKind, 'provenance.sourceKind')
  const sourceRevision = asString(
    provenance.sourceRevision,
    'provenance.sourceRevision',
  )
  const acquiredAt = asString(
    provenance.acquiredAt,
    'provenance.acquiredAt',
  )

  if (!SOURCE_KIND.test(sourceKind)) {
    invalid('provenance.sourceKind 형식이 유효하지 않습니다.')
  }
  if (!IMMUTABLE_REVISION.test(sourceRevision)) {
    invalid(
      'provenance.sourceRevision은 lowercase immutable commit 또는 object hash여야 합니다.',
    )
  }
  assertRfc3339(acquiredAt)

  return Object.freeze({ sourceKind, sourceRevision, acquiredAt })
}

function parseCanonicalFilePath(rawPath: string): string {
  const path = normalizeGarupaPackPath(rawPath)
  if (path !== rawPath) {
    invalid('manifest files 경로는 NFC canonical path여야 합니다.', rawPath)
  }
  return path
}

function parseFiles(value: unknown): Readonly<Record<string, string>> {
  const files = asObject(value, 'files')
  const entries = Object.entries(files)
  if (entries.length < 3) {
    invalid('files에는 skeleton, atlas와 하나 이상의 PNG가 필요합니다.')
  }

  const parsedEntries = entries.map(([rawPath, rawHash]) => {
    const path = parseCanonicalFilePath(rawPath)
    const isModel = path.startsWith('model/') && path.endsWith('.skel')
    const isCostumeAsset =
      path.startsWith('costume/') &&
      (path.endsWith('.atlas') || path.endsWith('.png'))

    if (!isModel && !isCostumeAsset) {
      invalid('files에는 canonical skeleton, atlas와 PNG 경로만 허용됩니다.', path)
    }
    if (typeof rawHash !== 'string' || !SHA256.test(rawHash)) {
      invalid('files 값은 lowercase 64자리 SHA-256이어야 합니다.', path)
    }
    return [path, rawHash] as const
  })

  parsedEntries.sort(([left], [right]) => left.localeCompare(right, 'en-US'))
  return Object.freeze(Object.fromEntries(parsedEntries))
}

function classifyUnsupportedAssetFamily(assetFamily: unknown): never {
  if (
    assetFamily === 'characters/livesd' ||
    assetFamily === 'live-sprite' ||
    assetFamily === 'livesd-sprite'
  ) {
    throw new GarupaPackImportError(
      'GARUPA_LIVE_SPRITE_UNSUPPORTED',
      'characters/livesd 4-frame sprite는 Spine sdchara pack이 아닙니다.',
    )
  }

  throw new GarupaPackImportError(
    'GARUPA_ASSET_FAMILY_UNSUPPORTED',
    '이 importer는 Garupa Spine sdchara 자산군만 지원합니다.',
  )
}

export function parseGarupaSpinePackManifest(
  value: unknown,
): GarupaSpinePackManifest {
  const manifest = asObject(value, 'manifest')

  if (typeof manifest.assetFamily !== 'string') {
    invalid('assetFamily은 문자열이어야 합니다.')
  }
  if (manifest.assetFamily !== 'sdchara') {
    classifyUnsupportedAssetFamily(manifest.assetFamily)
  }

  assertExactKeys(manifest, ROOT_KEYS, 'manifest')
  if (manifest.schemaVersion !== 1) invalid('schemaVersion은 1이어야 합니다.')
  if (manifest.gameId !== 'garupa') invalid('gameId는 garupa여야 합니다.')

  const sdAssetBundleName = asString(
    manifest.sdAssetBundleName,
    'sdAssetBundleName',
  )
  const modelName = asString(manifest.modelName, 'modelName')
  if (!IDENTITY.test(sdAssetBundleName) || !IDENTITY.test(modelName)) {
    invalid(
      'sdAssetBundleName과 modelName은 1–128자의 ASCII single-segment 이름이어야 합니다.',
    )
  }

  const skeletonPath = parseCanonicalFilePath(
    asString(manifest.skeletonPath, 'skeletonPath'),
  )
  const atlasPath = parseCanonicalFilePath(
    asString(manifest.atlasPath, 'atlasPath'),
  )
  if (skeletonPath !== `model/${modelName}.skel`) {
    invalid('skeletonPath는 model/<modelName>.skel이어야 합니다.', skeletonPath)
  }
  if (!/^costume\/[A-Za-z0-9_-]{1,128}\.atlas$/u.test(atlasPath)) {
    invalid('atlasPath는 costume/<atlasName>.atlas이어야 합니다.', atlasPath)
  }

  const files = parseFiles(manifest.files)
  if (!(skeletonPath in files) || !(atlasPath in files)) {
    invalid('files에는 skeletonPath와 atlasPath가 모두 있어야 합니다.')
  }
  if (!Object.keys(files).some((path) => path.endsWith('.png'))) {
    invalid('files에는 하나 이상의 costume PNG가 있어야 합니다.')
  }

  return Object.freeze({
    schemaVersion: 1,
    gameId: 'garupa',
    assetFamily: 'sdchara',
    sdAssetBundleName,
    modelName,
    skeletonPath,
    atlasPath,
    files,
    provenance: parseProvenance(manifest.provenance),
  })
}
