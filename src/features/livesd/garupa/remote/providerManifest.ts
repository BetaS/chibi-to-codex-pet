import rawManifest from './provider-manifest.v1.json'
import type {
  GarupaPinnedProviderManifest,
  GarupaSnapshotCatalogDescriptor,
  GarupaSnapshotFileDescriptor,
  GarupaSnapshotFileRole,
} from './types'

export type GarupaProviderManifestErrorCode =
  | 'GARUPA_REMOTE_MANIFEST_INVALID'
  | 'GARUPA_REMOTE_URL_INVALID'

export class GarupaProviderManifestError extends Error {
  readonly code: GarupaProviderManifestErrorCode

  constructor(code: GarupaProviderManifestErrorCode, message: string) {
    super(message)
    this.name = 'GarupaProviderManifestError'
    this.code = code
  }
}

export const GARUPA_PROVIDER_PUBLIC_PATH =
  `${import.meta.env.BASE_URL}manifests/garupa/bangdream-live2d.v1.json`

const SHA256 = /^[0-9a-f]{64}$/
const REVISION = /^[0-9a-f]{40}$/
const SAFE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/
const APPROVED_REVISION = '15b3e023cfdc576212f8b3a6b001c9f26e755f23'
const FILE_ROLES = new Set<GarupaSnapshotFileRole>([
  'atlas',
  'buildData',
  'png',
  'skeleton',
])

function invalid(message: string): never {
  throw new GarupaProviderManifestError(
    'GARUPA_REMOTE_MANIFEST_INVALID',
    message,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    invalid(`${label}에는 정의된 필드만 있어야 합니다.`)
  }
}

function assertSafeRelativePath(path: unknown, label: string): asserts path is string {
  if (typeof path !== 'string' || path.length === 0 || path.includes('\\')) {
    invalid(`${label}은 안전한 상대 경로여야 합니다.`)
  }
  const segments = path.split('/')
  if (
    segments.some(
      (segment) =>
        segment === '' ||
        segment === '.' ||
        segment === '..' ||
        !SAFE_SEGMENT.test(segment),
    )
  ) {
    invalid(`${label}에 안전하지 않은 경로 segment가 있습니다.`)
  }
}

function assertSafeSingleSegment(
  value: unknown,
  label: string,
): asserts value is string {
  assertSafeRelativePath(value, label)
  if (value.includes('/')) {
    invalid(`${label}은 single path segment여야 합니다.`)
  }
}

function assertHashAndSize(
  value: Record<string, unknown>,
  label: string,
): void {
  if (
    !Number.isSafeInteger(value.bytes) ||
    Number(value.bytes) <= 0 ||
    typeof value.sha256 !== 'string' ||
    !SHA256.test(value.sha256)
  ) {
    invalid(`${label}에는 양의 byte length와 lowercase SHA-256이 필요합니다.`)
  }
}

function parseCatalog(
  value: unknown,
  label: string,
): GarupaSnapshotCatalogDescriptor {
  if (!isRecord(value)) invalid(`${label} catalog가 올바르지 않습니다.`)
  assertExactKeys(value, ['bytes', 'path', 'sha256'], label)
  assertSafeRelativePath(value.path, `${label}.path`)
  assertHashAndSize(value, label)
  return value as unknown as GarupaSnapshotCatalogDescriptor
}

function parseFile(value: unknown, index: number): GarupaSnapshotFileDescriptor {
  if (!isRecord(value)) invalid(`debugFixture.files[${index}]가 올바르지 않습니다.`)
  assertExactKeys(
    value,
    ['bytes', 'canonicalPath', 'role', 'sha256', 'sourcePath'],
    `debugFixture.files[${index}]`,
  )
  if (typeof value.role !== 'string' || !FILE_ROLES.has(value.role as GarupaSnapshotFileRole)) {
    invalid(`debugFixture.files[${index}].role이 올바르지 않습니다.`)
  }
  assertSafeRelativePath(value.sourcePath, `debugFixture.files[${index}].sourcePath`)
  if (value.canonicalPath !== null) {
    assertSafeRelativePath(
      value.canonicalPath,
      `debugFixture.files[${index}].canonicalPath`,
    )
  }
  assertHashAndSize(value, `debugFixture.files[${index}]`)
  return value as unknown as GarupaSnapshotFileDescriptor
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}

export function parseGarupaPinnedProviderManifest(
  value: unknown,
): GarupaPinnedProviderManifest {
  if (!isRecord(value)) invalid('Garupa provider manifest는 object여야 합니다.')
  assertExactKeys(
    value,
    [
      'approvedAt',
      'assetFamily',
      'catalogs',
      'debugFixture',
      'delivery',
      'expectedRuntimeProfile',
      'gameId',
      'id',
      'label',
      'regionSemantics',
      'repository',
      'schemaVersion',
      'sourceRegions',
      'status',
      'supportedRegion',
      'upstream',
    ],
    'manifest',
  )
  if (
    value.schemaVersion !== 1 ||
    value.id !== 'panxuc-bangdream-live2d' ||
    value.status !== 'experimental' ||
    value.gameId !== 'garupa' ||
    value.assetFamily !== 'sdchara' ||
    typeof value.label !== 'string' ||
    value.label.length === 0 ||
    value.expectedRuntimeProfile !== 'spine-4.0' ||
    value.upstream !== 'Bestdori' ||
    value.supportedRegion !== 'jp' ||
    value.regionSemantics !== 'jp-preferred-union' ||
    !Array.isArray(value.sourceRegions) ||
    value.sourceRegions.length !== 2 ||
    value.sourceRegions[0] !== 'jp' ||
    value.sourceRegions[1] !== 'cn' ||
    typeof value.approvedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.approvedAt))
  ) {
    invalid('Garupa provider manifest identity 또는 상태가 올바르지 않습니다.')
  }

  if (!isRecord(value.repository)) invalid('repository가 올바르지 않습니다.')
  assertExactKeys(
    value.repository,
    ['branch', 'commitUrl', 'sourceRevision', 'url'],
    'repository',
  )
  const revision = value.repository.sourceRevision
  if (
    typeof revision !== 'string' ||
    !REVISION.test(revision) ||
    revision !== APPROVED_REVISION
  ) {
    invalid('repository.sourceRevision은 승인된 full commit SHA여야 합니다.')
  }
  const repositoryUrl = 'https://github.com/panxuc/bangdream-live2d'
  if (
    value.repository.url !== repositoryUrl ||
    value.repository.branch !== 'live2d' ||
    value.repository.commitUrl !== `${repositoryUrl}/commit/${revision}`
  ) {
    invalid('repository URL과 commit pin이 승인값과 일치하지 않습니다.')
  }

  if (!isRecord(value.delivery)) invalid('delivery가 올바르지 않습니다.')
  assertExactKeys(
    value.delivery,
    ['baseUrl', 'kind', 'requestOrigin', 'requestPolicy'],
    'delivery',
  )
  const expectedBase =
    `https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@${revision}`
  if (
    value.delivery.kind !== 'jsdelivr-github' ||
    value.delivery.baseUrl !== expectedBase ||
    value.delivery.requestOrigin !== 'https://cdn.jsdelivr.net'
  ) {
    invalid('delivery는 승인된 jsDelivr exact-commit base여야 합니다.')
  }
  if (!isRecord(value.delivery.requestPolicy)) {
    invalid('delivery.requestPolicy가 올바르지 않습니다.')
  }
  assertExactKeys(
    value.delivery.requestPolicy,
    ['credentials', 'mode', 'range', 'redirect', 'referrerPolicy'],
    'delivery.requestPolicy',
  )
  if (
    value.delivery.requestPolicy.mode !== 'cors' ||
    value.delivery.requestPolicy.credentials !== 'omit' ||
    value.delivery.requestPolicy.referrerPolicy !== 'no-referrer' ||
    value.delivery.requestPolicy.redirect !== 'error' ||
    value.delivery.requestPolicy.range !== 'forbidden'
  ) {
    invalid('delivery.requestPolicy가 승인된 browser 정책과 다릅니다.')
  }

  if (!isRecord(value.catalogs)) invalid('catalogs가 올바르지 않습니다.')
  assertExactKeys(value.catalogs, ['assetIndex', 'characters', 'costumes'], 'catalogs')
  parseCatalog(value.catalogs.assetIndex, 'catalogs.assetIndex')
  parseCatalog(value.catalogs.characters, 'catalogs.characters')
  parseCatalog(value.catalogs.costumes, 'catalogs.costumes')

  if (!isRecord(value.debugFixture)) invalid('debugFixture가 올바르지 않습니다.')
  assertExactKeys(
    value.debugFixture,
    ['files', 'id', 'modelName', 'sdAssetBundleName'],
    'debugFixture',
  )
  if (!Array.isArray(value.debugFixture.files) || value.debugFixture.files.length < 4) {
    invalid('debugFixture identity 또는 file 목록이 올바르지 않습니다.')
  }
  assertSafeSingleSegment(value.debugFixture.id, 'debugFixture.id')
  assertSafeSingleSegment(value.debugFixture.modelName, 'debugFixture.modelName')
  assertSafeSingleSegment(
    value.debugFixture.sdAssetBundleName,
    'debugFixture.sdAssetBundleName',
  )
  const files = value.debugFixture.files.map(parseFile)
  const sourcePaths = new Set<string>()
  const canonicalPaths = new Set<string>()
  for (const requiredRole of FILE_ROLES) {
    const count = files.filter((file) => file.role === requiredRole).length
    if (count < 1 || (requiredRole !== 'png' && count !== 1)) {
      invalid(`debugFixture에 ${requiredRole} file이 필요합니다.`)
    }
  }
  for (const file of files) {
    if (sourcePaths.has(file.sourcePath)) {
      invalid('debugFixture sourcePath는 중복될 수 없습니다.')
    }
    sourcePaths.add(file.sourcePath)
    if (file.role === 'buildData') {
      if (file.canonicalPath !== null) {
        invalid('debugFixture buildData는 canonical pack에 포함하지 않습니다.')
      }
      continue
    }
    if (file.canonicalPath === null || canonicalPaths.has(file.canonicalPath)) {
      invalid('debugFixture canonical asset path가 누락되었거나 중복되었습니다.')
    }
    canonicalPaths.add(file.canonicalPath)
  }

  return deepFreeze(value) as unknown as GarupaPinnedProviderManifest
}

export const GARUPA_PINNED_PROVIDER_MANIFEST =
  parseGarupaPinnedProviderManifest(rawManifest)

export function resolveGarupaPinnedUrl(relativePath: string): string {
  try {
    assertSafeRelativePath(relativePath, 'relativePath')
  } catch (error) {
    throw new GarupaProviderManifestError(
      'GARUPA_REMOTE_URL_INVALID',
      error instanceof Error ? error.message : 'Garupa snapshot path가 올바르지 않습니다.',
    )
  }
  const encodedPath = relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${GARUPA_PINNED_PROVIDER_MANIFEST.delivery.baseUrl}/${encodedPath}`
}

export function serializeGarupaPinnedProviderManifest(): string {
  return JSON.stringify(GARUPA_PINNED_PROVIDER_MANIFEST, null, 2) + '\n'
}
