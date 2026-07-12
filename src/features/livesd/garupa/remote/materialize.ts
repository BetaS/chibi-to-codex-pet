import { readAtlasPageReferences } from '../../model/atlasPages'
import type { LiveSDAtlasBundle } from '../../model/types'
import { readSpine40SkeletonHeaderFields } from '../../runtime/skeletonRuntimeHeader'
import type { GarupaCanonicalSource } from '../importer'
import {
  decodeGarupaRemoteText,
  findGarupaBuildDataFile,
  findUniqueCatalogFile,
  parseGarupaBuildData,
  parseGarupaSnapshotIndex,
} from './catalog'
import { GarupaRemoteError, normalizeGarupaRemoteError } from './errors'
import {
  fetchGarupaPinnedBytes,
  type FetchGarupaPinnedBytesOptions,
  type GarupaPinnedResponse,
} from './network'
import { GARUPA_PINNED_PROVIDER_MANIFEST } from './providerManifest'

const MIB = 1024 * 1024
const MAX_TOTAL_ASSET_BYTES = 64 * MIB
const MAX_SKELETON_BYTES = 32 * MIB
const MAX_ATLAS_BYTES = 2 * MIB
const MAX_PAGE_BYTES = 32 * MIB
const MAX_PAGE_COUNT = 29
const SAFE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

type GarupaPinnedFetcher = (
  relativePath: string,
  options: FetchGarupaPinnedBytesOptions,
) => Promise<GarupaPinnedResponse>

export interface GarupaImageDimensions {
  readonly width: number
  readonly height: number
}

export type GarupaRemotePngDecoder = (
  blob: Blob,
) => Promise<GarupaImageDimensions>

export interface MaterializeGarupaPinnedOptions {
  readonly signal: AbortSignal
  readonly fetchBytes?: GarupaPinnedFetcher
  readonly decodePng?: GarupaRemotePngDecoder
  readonly acquiredAt?: string
}

export interface GarupaCanonicalFileMetadata {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

function inspectGarupaSkeleton(bytes: Uint8Array): {
  hash: string | null
  version: string
  compatibility: 'experimental' | 'verified'
} {
  try {
    const { hash, version } = readSpine40SkeletonHeaderFields(
      toArrayBuffer(bytes),
    )
    if (!version) throw new Error('Missing Spine version.')
    if (!(version === '4.0' || version.startsWith('4.0.'))) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_SNAPSHOT_INVALID',
        'Garupa pinned skeleton은 Spine 4.0이어야 합니다.',
        { actualVersion: version },
      )
    }
    return {
      hash,
      version,
      compatibility: version === '4.0.64' ? 'verified' : 'experimental',
    }
  } catch (error) {
    if (error instanceof GarupaRemoteError) throw error
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      'Garupa pinned skeleton header가 손상되었습니다.',
    )
  }
}

function assertSafeAtlasPage(page: string): void {
  if (
    !page.toLowerCase().endsWith('.png') ||
    page.includes('\\') ||
    page.includes('\0') ||
    page.startsWith('/') ||
    /^[A-Za-z]:/u.test(page) ||
    page.split('/').some((segment) => !SAFE_SEGMENT.test(segment))
  ) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      'Garupa atlas가 안전하지 않은 PNG page를 참조합니다.',
    )
  }
}

function readStraightAtlasPages(atlasText: string): readonly string[] {
  const pmaValues = Array.from(
    atlasText.matchAll(/^\s*pma\s*:\s*([^\s]+)\s*$/gimu),
    (match) => match[1]?.toLowerCase(),
  )
  if (pmaValues.some((value) => value !== 'false')) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      'Garupa pinned atlas는 straight-alpha여야 합니다.',
    )
  }
  let pages: readonly string[]
  try {
    pages = readAtlasPageReferences(atlasText)
  } catch {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      'Garupa pinned atlas page graph가 올바르지 않습니다.',
    )
  }
  if (
    pages.length > MAX_PAGE_COUNT ||
    new Set(pages.map((page) => page.toLowerCase())).size !== pages.length
  ) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      'Garupa pinned atlas page 수 또는 고유성이 올바르지 않습니다.',
    )
  }
  for (const page of pages) assertSafeAtlasPage(page)
  return pages
}

function assertPngSignature(bytes: Uint8Array): void {
  if (
    bytes.byteLength < PNG_SIGNATURE.byteLength ||
    PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)
  ) {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      'Garupa pinned texture가 PNG signature를 갖지 않습니다.',
    )
  }
}

async function defaultDecodePng(blob: Blob): Promise<GarupaImageDimensions> {
  if (typeof createImageBitmap !== 'function') {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      '현재 browser에서 Garupa PNG decode를 검증할 수 없습니다.',
    )
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
  } catch {
    throw new GarupaRemoteError(
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
      'Garupa pinned texture를 PNG로 decode하지 못했습니다.',
    )
  }
  try {
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_SNAPSHOT_INVALID',
        'Garupa pinned texture 크기가 올바르지 않습니다.',
      )
    }
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

function expectedFixtureIntegrity(relativePath: string): {
  expectedBytes?: number
  expectedSha256?: string
} {
  const descriptor = GARUPA_PINNED_PROVIDER_MANIFEST.debugFixture.files.find(
    (file) => file.sourcePath === relativePath,
  )
  return descriptor
    ? { expectedBytes: descriptor.bytes, expectedSha256: descriptor.sha256 }
    : {}
}

function canonicalFile(
  path: string,
  response: GarupaPinnedResponse,
): GarupaCanonicalFileMetadata {
  return Object.freeze({
    path,
    bytes: response.bytes.byteLength,
    sha256: response.sha256,
  })
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}

export async function materializeGarupaPinnedSnapshot(
  sdAssetBundleName: string,
  options: MaterializeGarupaPinnedOptions,
): Promise<GarupaCanonicalSource> {
  const fetchBytes = options.fetchBytes ?? fetchGarupaPinnedBytes
  const decodePng = options.decodePng ?? defaultDecodePng
  const manifest = GARUPA_PINNED_PROVIDER_MANIFEST
  try {
    const catalogDescriptor = manifest.catalogs.assetIndex
    const catalog = await fetchBytes(catalogDescriptor.path, {
      signal: options.signal,
      maxBytes: catalogDescriptor.bytes,
      expectedBytes: catalogDescriptor.bytes,
      expectedSha256: catalogDescriptor.sha256,
      expectedContentTypes: ['application/json', 'text/plain'],
      integrityErrorCode: 'GARUPA_REMOTE_CATALOG_INVALID',
    })
    const index = parseGarupaSnapshotIndex(catalog.bytes)
    const buildDataFile = findGarupaBuildDataFile(index, sdAssetBundleName)
    const buildDataPath = `${index.builddata!.assetPath}/${buildDataFile}`
    const buildDataResponse = await fetchBytes(buildDataPath, {
      signal: options.signal,
      maxBytes: MIB,
      expectedContentTypes: [
        'application/json',
        'application/octet-stream',
        'text/plain',
      ],
      integrityErrorCode: 'GARUPA_REMOTE_SNAPSHOT_INVALID',
      ...expectedFixtureIntegrity(buildDataPath),
    })
    const buildData = parseGarupaBuildData(buildDataResponse.bytes)
    if (
      buildData.textureBundleName !== `sdchara/${sdAssetBundleName}` ||
      !buildData.modelBundleName.startsWith('sdchara/model/')
    ) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_BUILDDATA_INVALID',
        'Garupa buildData가 선택한 costume과 일치하지 않습니다.',
      )
    }

    const modelKey = buildData.modelBundleName.slice('sdchara/'.length)
    const modelEntry = index[modelKey]
    if (!modelEntry) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_SNAPSHOT_INVALID',
        'Garupa shared skeleton entry가 snapshot index에 없습니다.',
      )
    }
    const modelName = buildData.modelFileName.replace(
      /_SkeletonData\.asset$/u,
      '',
    )
    if (
      !SAFE_SEGMENT.test(modelName) ||
      modelKey.split('/').at(-1)?.toLowerCase() !== modelName.toLowerCase()
    ) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_BUILDDATA_INVALID',
        'Garupa shared skeleton identity가 일치하지 않습니다.',
      )
    }
    const skeletonFile = findUniqueCatalogFile(
      modelEntry,
      `${modelName}.skel`,
    )
    const skeletonPath = `${modelEntry.assetPath}/${skeletonFile}`
    const skeleton = await fetchBytes(skeletonPath, {
      signal: options.signal,
      maxBytes: MAX_SKELETON_BYTES,
      expectedContentTypes: ['application/octet-stream'],
      integrityErrorCode: 'GARUPA_REMOTE_SNAPSHOT_INVALID',
      ...expectedFixtureIntegrity(skeletonPath),
    })
    const skeletonHeader = inspectGarupaSkeleton(skeleton.bytes)

    const atlasName = buildData.textureFileName.replace(/_Atlas\.asset$/u, '')
    if (!SAFE_SEGMENT.test(atlasName)) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_BUILDDATA_INVALID',
        'Garupa costume atlas identity가 올바르지 않습니다.',
      )
    }
    const buildDataStem = buildDataFile.replace(/-builddata\.asset$/u, '')
    const atlasFile = findUniqueCatalogFile(
      index.builddata!,
      `${buildDataStem}-${atlasName}.atlas.txt`,
    )
    const atlasSourcePath = `${index.builddata!.assetPath}/${atlasFile}`
    const atlas = await fetchBytes(atlasSourcePath, {
      signal: options.signal,
      maxBytes: MAX_ATLAS_BYTES,
      expectedContentTypes: ['application/octet-stream', 'text/plain'],
      integrityErrorCode: 'GARUPA_REMOTE_SNAPSHOT_INVALID',
      ...expectedFixtureIntegrity(atlasSourcePath),
    })
    const atlasText = decodeGarupaRemoteText(
      atlas.bytes,
      'GARUPA_REMOTE_SNAPSHOT_INVALID',
    )
    const atlasPages = readStraightAtlasPages(atlasText)

    const downloadedBytes = skeleton.bytes.byteLength + atlas.bytes.byteLength
    if (downloadedBytes > MAX_TOTAL_ASSET_BYTES) {
      throw new GarupaRemoteError(
        'GARUPA_REMOTE_RESPONSE_TOO_LARGE',
        'Garupa snapshot asset graph가 허용 크기를 초과했습니다.',
      )
    }
    let totalAssetBytes = downloadedBytes
    const pageBlobs = new Map<string, Blob>()
    const fileMetadata: GarupaCanonicalFileMetadata[] = [
      canonicalFile(`model/${modelName}.skel`, skeleton),
      canonicalFile(`costume/${atlasName}.atlas`, atlas),
    ]
    for (const page of atlasPages) {
      const flattenedPage = page.replaceAll('/', '-')
      const pageFile = findUniqueCatalogFile(
        index.builddata!,
        `${buildDataStem}-${flattenedPage}`,
      )
      const pageSourcePath = `${index.builddata!.assetPath}/${pageFile}`
      const remainingBytes = MAX_TOTAL_ASSET_BYTES - totalAssetBytes
      if (remainingBytes < 1) {
        throw new GarupaRemoteError(
          'GARUPA_REMOTE_RESPONSE_TOO_LARGE',
          'Garupa snapshot asset graph가 허용 크기를 초과했습니다.',
        )
      }
      const pageResponse = await fetchBytes(pageSourcePath, {
        signal: options.signal,
        maxBytes: Math.min(MAX_PAGE_BYTES, remainingBytes),
        expectedContentTypes: ['application/octet-stream', 'image/png'],
        integrityErrorCode: 'GARUPA_REMOTE_SNAPSHOT_INVALID',
        ...expectedFixtureIntegrity(pageSourcePath),
      })
      assertPngSignature(pageResponse.bytes)
      const blob = new Blob([toArrayBuffer(pageResponse.bytes)], {
        type: 'image/png',
      })
      const dimensions = await decodePng(blob)
      if (dimensions.width < 1 || dimensions.height < 1) {
        throw new GarupaRemoteError(
          'GARUPA_REMOTE_SNAPSHOT_INVALID',
          'Garupa pinned texture decode 결과가 올바르지 않습니다.',
        )
      }
      totalAssetBytes += pageResponse.bytes.byteLength
      const canonicalPath = `costume/${page}`
      pageBlobs.set(canonicalPath, blob)
      fileMetadata.push(canonicalFile(canonicalPath, pageResponse))
    }

    const acquiredAt = options.acquiredAt ?? new Date().toISOString()
    if (!Number.isFinite(Date.parse(acquiredAt))) {
      throw new TypeError('acquiredAt must be an RFC 3339 timestamp.')
    }
    const atlasBundle: LiveSDAtlasBundle = Object.freeze({
      sourceName: `${sdAssetBundleName}-${modelName}`,
      atlasPath: `costume/${atlasName}.atlas`,
      atlasText,
      atlasPages: pageBlobs,
    })
    return Object.freeze({
      skeletonData: toArrayBuffer(skeleton.bytes),
      atlasBundle,
      metadata: Object.freeze({
        gameId: 'garupa',
        assetFamily: 'sdchara',
        sdAssetBundleName,
        modelName,
        runtimeKey: 'spine-4.0',
        skeletonVersion: skeletonHeader.version,
        skeletonHeaderHash: skeletonHeader.hash,
        compatibility: skeletonHeader.compatibility,
        alphaMode: 'straight',
        lookRigProfile: 'garupa-dual-eye-v1',
        fileSha256: Object.freeze(
          Object.fromEntries(fileMetadata.map((file) => [file.path, file.sha256])),
        ),
        provenance: Object.freeze({
          sourceKind: 'github-mirror',
          sourceRevision: manifest.repository.sourceRevision,
          acquiredAt,
        }),
      }),
    })
  } catch (error) {
    throw normalizeGarupaRemoteError(error)
  }
}
