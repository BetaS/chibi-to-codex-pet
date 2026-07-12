import {
  BlobReader,
  ZipReader,
  type Entry,
  type FileEntry,
} from '@zip.js/zip.js'

import type { LiveSDAtlasBundle } from '../../model'

import { parseGarupaAtlas } from './atlas'
import {
  GarupaPackImportError,
  isGarupaPackImportError,
} from './errors'
import { parseGarupaSpinePackManifest } from './manifest'
import {
  garupaPathBasename,
  garupaPathCollisionKey,
  normalizeGarupaPackPath,
} from './path'
import {
  assertGarupaPngSignature,
  decodeGarupaPngInBrowser,
} from './png'
import { inspectGarupaSpineSkeleton } from './skeleton'
import {
  GARUPA_SPINE_PACK_LIMITS,
  GARUPA_SPINE_PACK_MANIFEST_PATH,
  type GarupaCanonicalSource,
  type GarupaSha256Digest,
  type GarupaSpinePackImporterContract,
  type GarupaSpinePackImporterOptions,
} from './types'

const UNIX_FILE_TYPE_MASK = 0o170000
const UNIX_DIRECTORY = 0o040000
const UNIX_REGULAR_FILE = 0o100000
const UNIX_SYMLINK = 0o120000
const SHA256 = /^[a-f0-9]{64}$/u

interface NormalizedEntry {
  readonly directory: boolean
  readonly entry: Entry
  readonly path: string
}

interface NormalizedFileEntry extends NormalizedEntry {
  readonly directory: false
  readonly entry: FileEntry
}

function isNormalizedFileEntry(
  entry: NormalizedEntry,
): entry is NormalizedFileEntry {
  return !entry.directory
}

function assertSafeSize(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new GarupaPackImportError(
      'GARUPA_PACK_CORRUPT',
      `ZIP ${label} metadata가 유효하지 않습니다.`,
    )
  }
}

function addSize(total: number, value: number): number {
  const result = total + value
  if (!Number.isSafeInteger(result)) {
    throw new GarupaPackImportError(
      'GARUPA_PACK_TOO_LARGE',
      'ZIP size metadata 합계가 안전한 범위를 벗어났습니다.',
    )
  }
  return result
}

function unixMode(entry: Entry): number {
  return (
    entry.unixMode ??
    ((entry.externalFileAttributes >>> 16) & 0xffff)
  )
}

function assertNotSymlink(entry: Entry, path: string): void {
  const fileType = unixMode(entry) & UNIX_FILE_TYPE_MASK
  const expectedType = entry.directory ? UNIX_DIRECTORY : UNIX_REGULAR_FILE

  if (
    fileType === UNIX_SYMLINK ||
    (fileType !== 0 && fileType !== expectedType)
  ) {
    throw new GarupaPackImportError(
      'GARUPA_PACK_UNSAFE_PATH',
      'ZIP symlink 또는 특수 파일 entry는 지원하지 않습니다.',
      { path },
    )
  }
}

function assertNoPrefixCollision(entries: readonly NormalizedEntry[]): void {
  const fileKeys = new Map(
    entries
      .filter(isNormalizedFileEntry)
      .map((entry) => [garupaPathCollisionKey(entry.path), entry.path]),
  )

  for (const entry of entries) {
    const segments = garupaPathCollisionKey(entry.path).split('/')
    for (let index = 1; index < segments.length; index += 1) {
      const prefix = segments.slice(0, index).join('/')
      const blockingFile = fileKeys.get(prefix)
      if (blockingFile !== undefined) {
        throw new GarupaPackImportError(
          'GARUPA_PACK_PATH_COLLISION',
          'ZIP file path가 다른 entry의 parent directory와 충돌합니다.',
          { path: blockingFile },
        )
      }
    }
  }
}

function normalizeEntries(entries: readonly Entry[]): readonly NormalizedEntry[] {
  const normalized: NormalizedEntry[] = []
  const paths = new Map<string, string>()
  let compressedBytes = 0
  let uncompressedBytes = 0
  let fileEntries = 0

  for (const entry of entries) {
    const path = normalizeGarupaPackPath(entry.filename, {
      directory: entry.directory,
    })
    const collisionKey = garupaPathCollisionKey(path)
    const existing = paths.get(collisionKey)
    if (existing !== undefined) {
      throw new GarupaPackImportError(
        'GARUPA_PACK_PATH_COLLISION',
        'ZIP 경로가 Unicode normalization 또는 대소문자 정규화 후 충돌합니다.',
        { path },
      )
    }
    paths.set(collisionKey, path)

    if (entry.encrypted) {
      throw new GarupaPackImportError(
        'GARUPA_PACK_ENCRYPTED',
        '암호화된 ZIP entry는 지원하지 않습니다.',
        { path },
      )
    }
    assertNotSymlink(entry, path)
    assertSafeSize(entry.compressedSize, 'compressed size')
    assertSafeSize(entry.uncompressedSize, 'uncompressed size')

    if (!entry.directory) {
      fileEntries += 1
      compressedBytes = addSize(compressedBytes, entry.compressedSize)
      uncompressedBytes = addSize(uncompressedBytes, entry.uncompressedSize)
    }
    normalized.push({ directory: entry.directory, entry, path })
  }

  if (
    fileEntries > GARUPA_SPINE_PACK_LIMITS.fileEntries ||
    compressedBytes > GARUPA_SPINE_PACK_LIMITS.compressedBytes ||
    uncompressedBytes > GARUPA_SPINE_PACK_LIMITS.uncompressedBytes
  ) {
    throw new GarupaPackImportError(
      'GARUPA_PACK_TOO_LARGE',
      'ZIP은 32 files, 32MiB compressed, 64MiB expanded 제한을 초과할 수 없습니다.',
    )
  }

  assertNoPrefixCollision(normalized)
  return normalized
}

function hasExtension(path: string, extension: string): boolean {
  return path.toLocaleLowerCase('en-US').endsWith(extension)
}

function detectUnsupportedAssetEntries(
  files: readonly NormalizedFileEntry[],
): void {
  const paths = files.map(({ path }) => path.toLocaleLowerCase('en-US'))
  const hasLive2d = paths.some(
    (path) =>
      path.endsWith('.moc') ||
      path.endsWith('.moc3') ||
      path.endsWith('.model.json') ||
      path.endsWith('.model3.json'),
  )
  if (hasLive2d) {
    throw new GarupaPackImportError(
      'GARUPA_ASSET_FAMILY_UNSUPPORTED',
      'Live2D Cubism entry는 Garupa Spine sdchara pack에서 지원하지 않습니다.',
    )
  }

  const hasSpineModel = paths.some(
    (path) => path.endsWith('.skel') || path.endsWith('.atlas'),
  )
  const hasLiveSprite = paths.some(
    (path) =>
      path.includes('characters/livesd/') ||
      garupaPathBasename(path) === 'sdchara.png',
  )
  if (!hasSpineModel && hasLiveSprite) {
    throw new GarupaPackImportError(
      'GARUPA_LIVE_SPRITE_UNSUPPORTED',
      'characters/livesd의 4-frame sdchara.png는 Spine pack이 아닙니다.',
    )
  }
}

function decodeUtf8(
  data: ArrayBuffer,
  code: 'GARUPA_ATLAS_INVALID' | 'GARUPA_MANIFEST_INVALID',
  path: string,
): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch (error) {
    throw new GarupaPackImportError(
      code,
      '파일은 strict UTF-8 텍스트여야 합니다.',
      { cause: error, path },
    )
  }
}

async function readEntry(entry: NormalizedFileEntry): Promise<ArrayBuffer> {
  const data = await entry.entry.arrayBuffer({ useWebWorkers: false })
  if (data.byteLength !== entry.entry.uncompressedSize) {
    throw new GarupaPackImportError(
      'GARUPA_PACK_CORRUPT',
      'ZIP entry의 실제 크기가 metadata와 일치하지 않습니다.',
      { path: entry.path },
    )
  }
  return data
}

async function defaultSha256(data: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-256 is unavailable')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function parseManifestJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new GarupaPackImportError(
      'GARUPA_MANIFEST_INVALID',
      'garupa-spine-pack.json을 JSON으로 해석할 수 없습니다.',
      { cause: error, path: GARUPA_SPINE_PACK_MANIFEST_PATH },
    )
  }
}

function requireEntry(
  fileByPath: ReadonlyMap<string, NormalizedFileEntry>,
  path: string,
): NormalizedFileEntry {
  const entry = fileByPath.get(path)
  if (!entry) {
    throw new GarupaPackImportError(
      'GARUPA_MANIFEST_INVALID',
      'manifest가 가리키는 entry가 ZIP에 없습니다.',
      { path },
    )
  }
  return entry
}

function assertModelIdentity(
  files: readonly NormalizedFileEntry[],
  skeletonPath: string,
  atlasPath: string,
): void {
  const skeletons = files.filter(({ path }) => hasExtension(path, '.skel'))
  const atlases = files.filter(({ path }) => hasExtension(path, '.atlas'))
  if (skeletons.length > 1 || atlases.length > 1) {
    throw new GarupaPackImportError(
      'GARUPA_MODEL_AMBIGUOUS',
      'ZIP에는 manifest가 가리키는 skeleton과 atlas만 있어야 합니다.',
    )
  }
  if (
    skeletons.length !== 1 ||
    atlases.length !== 1 ||
    skeletons[0]?.path !== skeletonPath ||
    atlases[0]?.path !== atlasPath
  ) {
    throw new GarupaPackImportError(
      'GARUPA_MANIFEST_INVALID',
      'manifest skeletonPath 또는 atlasPath가 실제 ZIP entry와 일치하지 않습니다.',
    )
  }
}

function assertAssetFileMapping(
  files: readonly NormalizedFileEntry[],
  manifestFiles: Readonly<Record<string, string>>,
): void {
  const manifestPaths = new Set(Object.keys(manifestFiles))
  const archiveAssetPaths = files
    .map(({ path }) => path)
    .filter(
      (path) =>
        hasExtension(path, '.skel') ||
        hasExtension(path, '.atlas') ||
        hasExtension(path, '.png'),
    )

  const unlisted = archiveAssetPaths.find((path) => !manifestPaths.has(path))
  if (unlisted !== undefined) {
    throw new GarupaPackImportError(
      'GARUPA_MANIFEST_INVALID',
      'ZIP asset entry는 manifest files와 1:1로 대응해야 합니다.',
      { path: unlisted },
    )
  }
}

async function verifyHashes(
  paths: readonly string[],
  dataByPath: ReadonlyMap<string, ArrayBuffer>,
  expected: Readonly<Record<string, string>>,
  sha256: GarupaSha256Digest,
): Promise<Readonly<Record<string, string>>> {
  const verified: [string, string][] = []
  for (const path of paths) {
    const data = dataByPath.get(path)
    if (!data) {
      throw new GarupaPackImportError(
        'GARUPA_MANIFEST_INVALID',
        'manifest file entry가 ZIP에 없습니다.',
        { path },
      )
    }
    const actual = await sha256(data)
    if (!SHA256.test(actual)) {
      throw new GarupaPackImportError(
        'GARUPA_PACK_CORRUPT',
        'SHA-256 verifier가 유효하지 않은 digest를 반환했습니다.',
        { path },
      )
    }
    if (actual !== expected[path]) {
      throw new GarupaPackImportError(
        'GARUPA_PACK_HASH_MISMATCH',
        'manifest SHA-256이 ZIP entry와 일치하지 않습니다.',
        { path },
      )
    }
    verified.push([path, actual])
  }
  return Object.freeze(Object.fromEntries(verified))
}

export class GarupaSpinePackImporter
  implements GarupaSpinePackImporterContract
{
  readonly #decodePng
  readonly #sha256

  constructor(options: GarupaSpinePackImporterOptions = {}) {
    this.#decodePng = options.decodePng ?? decodeGarupaPngInBrowser
    this.#sha256 = options.sha256 ?? defaultSha256
  }

  async import(file: File): Promise<GarupaCanonicalSource> {
    if (
      !Number.isSafeInteger(file?.size) ||
      file.size < 0 ||
      file.size > GARUPA_SPINE_PACK_LIMITS.compressedBytes
    ) {
      throw new GarupaPackImportError(
        'GARUPA_PACK_TOO_LARGE',
        'Garupa canonical ZIP은 32MiB 이하여야 합니다.',
      )
    }

    const zipReader = new ZipReader(new BlobReader(file), {
      useWebWorkers: false,
    })

    try {
      const normalized = normalizeEntries(await zipReader.getEntries())
      const files = normalized.filter(isNormalizedFileEntry)
      detectUnsupportedAssetEntries(files)

      const manifestNamedEntries = files.filter(
        ({ path }) =>
          garupaPathBasename(path).toLocaleLowerCase('en-US') ===
          GARUPA_SPINE_PACK_MANIFEST_PATH,
      )
      const manifestEntry = manifestNamedEntries.find(
        ({ path }) => path === GARUPA_SPINE_PACK_MANIFEST_PATH,
      )
      if (!manifestEntry) {
        if (manifestNamedEntries.length > 0) {
          throw new GarupaPackImportError(
            'GARUPA_MANIFEST_INVALID',
            'garupa-spine-pack.json은 ZIP root에 정확한 이름으로 있어야 합니다.',
          )
        }
        throw new GarupaPackImportError(
          'GARUPA_MANIFEST_MISSING',
          'ZIP root에 garupa-spine-pack.json이 없습니다.',
        )
      }
      if (manifestNamedEntries.length !== 1) {
        throw new GarupaPackImportError(
          'GARUPA_MANIFEST_INVALID',
          'garupa-spine-pack.json은 ZIP root에 정확히 하나만 있어야 합니다.',
        )
      }

      const manifestData = await readEntry(manifestEntry)
      const manifest = parseGarupaSpinePackManifest(
        parseManifestJson(
          decodeUtf8(
            manifestData,
            'GARUPA_MANIFEST_INVALID',
            GARUPA_SPINE_PACK_MANIFEST_PATH,
          ),
        ),
      )
      assertModelIdentity(files, manifest.skeletonPath, manifest.atlasPath)
      assertAssetFileMapping(files, manifest.files)

      const fileByPath = new Map(files.map((entry) => [entry.path, entry]))
      const skeletonEntry = requireEntry(fileByPath, manifest.skeletonPath)
      const atlasEntry = requireEntry(fileByPath, manifest.atlasPath)
      const skeletonData = await readEntry(skeletonEntry)
      const atlasData = await readEntry(atlasEntry)
      const atlasText = decodeUtf8(
        atlasData,
        'GARUPA_ATLAS_INVALID',
        manifest.atlasPath,
      )
      const atlas = parseGarupaAtlas(atlasText, manifest.atlasPath)
      const atlasPagePaths = atlas.pages.map(({ path }) => path)
      const atlasPageSet = new Set(atlasPagePaths)
      const declaredPngPaths = Object.keys(manifest.files).filter((path) =>
        path.endsWith('.png'),
      )

      for (const pagePath of atlasPagePaths) {
        if (!fileByPath.has(pagePath) || !(pagePath in manifest.files)) {
          throw new GarupaPackImportError(
            'GARUPA_ATLAS_PAGE_MISSING',
            'atlas가 참조하는 PNG가 canonical pack에 없습니다.',
            { path: pagePath },
          )
        }
      }
      const missingManifestPath = Object.keys(manifest.files).find(
        (path) => !fileByPath.has(path),
      )
      if (missingManifestPath !== undefined) {
        throw new GarupaPackImportError(
          atlasPageSet.has(missingManifestPath)
            ? 'GARUPA_ATLAS_PAGE_MISSING'
            : 'GARUPA_MANIFEST_INVALID',
          'manifest가 가리키는 asset entry가 ZIP에 없습니다.',
          { path: missingManifestPath },
        )
      }
      if (
        declaredPngPaths.length !== atlasPagePaths.length ||
        declaredPngPaths.some((path) => !atlasPageSet.has(path))
      ) {
        throw new GarupaPackImportError(
          'GARUPA_ATLAS_INVALID',
          'manifest PNG와 atlas page graph가 1:1로 대응하지 않습니다.',
        )
      }

      const manifestPaths = Object.keys(manifest.files)
      const dataByPath = new Map<string, ArrayBuffer>([
        [manifest.skeletonPath, skeletonData],
        [manifest.atlasPath, atlasData],
      ])
      for (const path of manifestPaths) {
        if (dataByPath.has(path)) continue
        const entry = fileByPath.get(path)
        if (!entry) {
          throw new GarupaPackImportError(
            atlasPageSet.has(path)
              ? 'GARUPA_ATLAS_PAGE_MISSING'
              : 'GARUPA_MANIFEST_INVALID',
            'manifest가 가리키는 asset entry가 ZIP에 없습니다.',
            { path },
          )
        }
        dataByPath.set(path, await readEntry(entry))
      }

      const fileSha256 = await verifyHashes(
        manifestPaths,
        dataByPath,
        manifest.files,
        this.#sha256,
      )
      const skeletonHeader = inspectGarupaSpineSkeleton(skeletonData)
      const atlasPages = new Map<string, Blob>()
      for (const pagePath of atlasPagePaths) {
        const pageData = dataByPath.get(pagePath)
        if (!pageData) {
          throw new GarupaPackImportError(
            'GARUPA_ATLAS_PAGE_MISSING',
            'atlas page data가 없습니다.',
            { path: pagePath },
          )
        }
        assertGarupaPngSignature(pageData, pagePath)
        const blob = new Blob([pageData], { type: 'image/png' })
        try {
          await this.#decodePng(blob, pagePath)
        } catch (error) {
          if (isGarupaPackImportError(error)) throw error
          throw new GarupaPackImportError(
            'GARUPA_TEXTURE_INVALID',
            'atlas page를 PNG image로 decode할 수 없습니다.',
            { cause: error, path: pagePath },
          )
        }
        atlasPages.set(pagePath, blob)
      }

      const atlasBundle: LiveSDAtlasBundle = Object.freeze({
        sourceName: `${manifest.sdAssetBundleName}-${manifest.modelName}`,
        atlasPath: manifest.atlasPath,
        atlasText,
        atlasPages,
      })

      return Object.freeze({
        skeletonData,
        atlasBundle,
        metadata: Object.freeze({
          gameId: 'garupa',
          assetFamily: 'sdchara',
          sdAssetBundleName: manifest.sdAssetBundleName,
          modelName: manifest.modelName,
          runtimeKey: 'spine-4.0',
          skeletonVersion: skeletonHeader.version,
          skeletonHeaderHash: skeletonHeader.hash,
          compatibility: skeletonHeader.compatibility,
          fileSha256,
          provenance: manifest.provenance,
          alphaMode: atlas.alphaMode,
          lookRigProfile: 'garupa-dual-eye-v1',
        }),
      })
    } catch (error) {
      if (isGarupaPackImportError(error)) throw error
      throw new GarupaPackImportError(
        'GARUPA_PACK_CORRUPT',
        'Garupa canonical ZIP을 읽거나 검증할 수 없습니다.',
        { cause: error },
      )
    } finally {
      await zipReader.close().catch(() => undefined)
    }
  }
}

export const garupaSpinePackImporter = new GarupaSpinePackImporter()
