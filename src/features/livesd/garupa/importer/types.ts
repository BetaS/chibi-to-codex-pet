import type { LiveSDAtlasBundle } from '../../model'

export const GARUPA_SPINE_PACK_MANIFEST_PATH =
  'garupa-spine-pack.json' as const

export const GARUPA_SPINE_PACK_LIMITS = Object.freeze({
  compressedBytes: 32 * 1024 * 1024,
  fileEntries: 32,
  uncompressedBytes: 64 * 1024 * 1024,
})

export interface GarupaSpinePackProvenance {
  readonly sourceKind: string
  readonly sourceRevision: string
  readonly acquiredAt: string
}

export interface GarupaSpinePackManifest {
  readonly schemaVersion: 1
  readonly gameId: 'garupa'
  readonly assetFamily: 'sdchara'
  readonly sdAssetBundleName: string
  readonly modelName: string
  readonly skeletonPath: string
  readonly atlasPath: string
  readonly files: Readonly<Record<string, string>>
  readonly provenance: GarupaSpinePackProvenance
}

export type GarupaSpine40Compatibility = 'experimental' | 'verified'

export interface GarupaSpineSkeletonHeader {
  readonly hash: string | null
  readonly version: string
  readonly compatibility: GarupaSpine40Compatibility
}

export interface GarupaCanonicalSourceMetadata {
  readonly gameId: 'garupa'
  readonly assetFamily: 'sdchara'
  readonly sdAssetBundleName: string
  readonly modelName: string
  readonly runtimeKey: 'spine-4.0'
  readonly skeletonVersion: string
  readonly skeletonHeaderHash: string | null
  readonly compatibility: GarupaSpine40Compatibility
  readonly fileSha256: Readonly<Record<string, string>>
  readonly provenance: GarupaSpinePackProvenance
  readonly alphaMode: 'straight'
  readonly lookRigProfile: 'garupa-dual-eye-v1'
}

export interface GarupaCanonicalSource {
  readonly skeletonData: ArrayBuffer
  readonly atlasBundle: LiveSDAtlasBundle
  readonly metadata: GarupaCanonicalSourceMetadata
}

export type GarupaPngDecoder = (
  blob: Blob,
  path: string,
) => Promise<void>

export type GarupaSha256Digest = (data: ArrayBuffer) => Promise<string>

export interface GarupaSpinePackImporterOptions {
  readonly decodePng?: GarupaPngDecoder
  readonly sha256?: GarupaSha256Digest
}

export interface GarupaSpinePackImporterContract {
  import(file: File): Promise<GarupaCanonicalSource>
}
