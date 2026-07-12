import { GarupaRemoteError } from './errors'

const SAFE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/
const MAX_CATALOG_FILES = 8_192

export interface GarupaSnapshotIndexEntry {
  readonly assetPath: string
  readonly saveDir: string
  readonly fileCount: number
  readonly files: readonly string[]
}

export type GarupaSnapshotIndex = Readonly<
  Record<string, GarupaSnapshotIndexEntry>
>

export interface GarupaBuildData {
  readonly modelBundleName: string
  readonly modelFileName: string
  readonly textureBundleName: string
  readonly textureFileName: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.includes('\\') &&
    value.split('/').every((segment) => SAFE_SEGMENT.test(segment))
  )
}

function invalidCatalog(message: string): never {
  throw new GarupaRemoteError('GARUPA_REMOTE_CATALOG_INVALID', message)
}

export function decodeGarupaRemoteText(
  bytes: Uint8Array,
  code:
    | 'GARUPA_REMOTE_CATALOG_INVALID'
    | 'GARUPA_REMOTE_BUILDDATA_INVALID'
    | 'GARUPA_REMOTE_SNAPSHOT_INVALID',
): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new GarupaRemoteError(
      code,
      'Garupa pinned text가 올바른 UTF-8이 아닙니다.',
    )
  }
}

export function parseGarupaSnapshotIndex(
  bytes: Uint8Array,
): GarupaSnapshotIndex {
  let parsed: unknown
  try {
    parsed = JSON.parse(
      decodeGarupaRemoteText(bytes, 'GARUPA_REMOTE_CATALOG_INVALID'),
    )
  } catch (error) {
    if (error instanceof GarupaRemoteError) throw error
    invalidCatalog('Garupa asset index가 올바른 JSON이 아닙니다.')
  }
  if (!isRecord(parsed)) invalidCatalog('Garupa asset index는 object여야 합니다.')

  const entries: Record<string, GarupaSnapshotIndexEntry> = {}
  for (const [key, rawEntry] of Object.entries(parsed)) {
    if (!safePath(key) || !isRecord(rawEntry)) {
      invalidCatalog('Garupa asset index entry가 올바르지 않습니다.')
    }
    const keys = Object.keys(rawEntry).sort()
    if (keys.join(',') !== 'assetPath,fileCount,files,saveDir') {
      invalidCatalog('Garupa asset index entry에는 승인된 필드만 허용됩니다.')
    }
    if (
      !safePath(rawEntry.assetPath) ||
      !safePath(rawEntry.saveDir) ||
      rawEntry.assetPath !== rawEntry.saveDir ||
      !Number.isSafeInteger(rawEntry.fileCount) ||
      Number(rawEntry.fileCount) < 1 ||
      !Array.isArray(rawEntry.files) ||
      rawEntry.files.length !== rawEntry.fileCount ||
      rawEntry.files.length > MAX_CATALOG_FILES ||
      rawEntry.files.some(
        (file) => typeof file !== 'string' || !SAFE_SEGMENT.test(file),
      ) ||
      new Set(rawEntry.files.map((file) => file.toLowerCase())).size !==
        rawEntry.files.length
    ) {
      invalidCatalog('Garupa asset index entry의 path 또는 file 목록이 올바르지 않습니다.')
    }
    entries[key] = Object.freeze({
      assetPath: rawEntry.assetPath,
      saveDir: rawEntry.saveDir,
      fileCount: rawEntry.fileCount as number,
      files: Object.freeze([...(rawEntry.files as string[])]),
    })
  }
  if (!entries.builddata) {
    invalidCatalog('Garupa asset index에 builddata entry가 없습니다.')
  }
  return Object.freeze(entries)
}

function safeBundlePath(value: unknown): value is string {
  return safePath(value) && value.startsWith('sdchara/')
}

export function parseGarupaBuildData(bytes: Uint8Array): GarupaBuildData {
  let parsed: unknown
  try {
    parsed = JSON.parse(
      decodeGarupaRemoteText(bytes, 'GARUPA_REMOTE_BUILDDATA_INVALID'),
    )
  } catch (error) {
    if (error instanceof GarupaRemoteError) throw error
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_BUILDDATA_INVALID',
      'Garupa buildData가 올바른 JSON이 아닙니다.',
    )
  }
  if (!isRecord(parsed) || !isRecord(parsed.Base)) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_BUILDDATA_INVALID',
      'Garupa buildData root가 올바르지 않습니다.',
    )
  }
  const { model, textures } = parsed.Base
  if (
    !isRecord(model) ||
    !safeBundlePath(model.bundleName) ||
    !model.bundleName.startsWith('sdchara/model/') ||
    typeof model.fileName !== 'string' ||
    !SAFE_SEGMENT.test(model.fileName) ||
    !model.fileName.endsWith('_SkeletonData.asset') ||
    !Array.isArray(textures) ||
    textures.length !== 1 ||
    !isRecord(textures[0]) ||
    !safeBundlePath(textures[0].bundleName) ||
    typeof textures[0].fileName !== 'string' ||
    !SAFE_SEGMENT.test(textures[0].fileName) ||
    !/_Atlas\.asset$/u.test(textures[0].fileName)
  ) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_BUILDDATA_INVALID',
      'Garupa buildData model 또는 texture graph가 올바르지 않습니다.',
    )
  }
  return Object.freeze({
    modelBundleName: model.bundleName,
    modelFileName: model.fileName,
    textureBundleName: textures[0].bundleName,
    textureFileName: textures[0].fileName,
  })
}

export function findUniqueCatalogFile(
  entry: GarupaSnapshotIndexEntry,
  expectedFileName: string,
): string {
  const normalized = expectedFileName.toLowerCase()
  const matches = entry.files.filter(
    (candidate) => candidate.toLowerCase() === normalized,
  )
  if (matches.length !== 1) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      'Garupa snapshot에서 유일한 file graph 대응값을 찾지 못했습니다.',
    )
  }
  return matches[0] as string
}

export function findGarupaBuildDataFile(
  index: GarupaSnapshotIndex,
  sdAssetBundleName: string,
): string {
  if (
    sdAssetBundleName.length < 1 ||
    sdAssetBundleName.length > 128 ||
    !/^[A-Za-z0-9_-]+$/u.test(sdAssetBundleName)
  ) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_BUILDDATA_INVALID',
      'Garupa sdAssetBundleName이 올바르지 않습니다.',
    )
  }
  const suffix = `-builddata-${sdAssetBundleName}-builddata.asset`.toLowerCase()
  const matches = index.builddata?.files.filter((candidate) =>
    candidate.toLowerCase().endsWith(suffix),
  ) ?? []
  if (matches.length !== 1) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_BUILDDATA_INVALID',
      '선택한 Garupa buildData를 유일하게 찾지 못했습니다.',
      { sdAssetBundleName },
    )
  }
  return matches[0] as string
}
