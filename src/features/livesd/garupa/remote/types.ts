export type GarupaPinnedProviderStatus = 'experimental'
export type GarupaSnapshotFileRole =
  | 'atlas'
  | 'buildData'
  | 'png'
  | 'skeleton'

export interface GarupaSnapshotFileDescriptor {
  readonly role: GarupaSnapshotFileRole
  readonly sourcePath: string
  readonly canonicalPath: string | null
  readonly bytes: number
  readonly sha256: string
}

export interface GarupaSnapshotCatalogDescriptor {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

export interface GarupaPinnedProviderManifest {
  readonly schemaVersion: 1
  readonly id: 'panxuc-bangdream-live2d'
  readonly status: GarupaPinnedProviderStatus
  readonly gameId: 'garupa'
  readonly assetFamily: 'sdchara'
  readonly label: string
  readonly repository: {
    readonly url: string
    readonly branch: string
    readonly sourceRevision: string
    readonly commitUrl: string
  }
  readonly delivery: {
    readonly kind: 'jsdelivr-github'
    readonly baseUrl: string
    readonly requestOrigin: string
    readonly requestPolicy: {
      readonly mode: 'cors'
      readonly credentials: 'omit'
      readonly referrerPolicy: 'no-referrer'
      readonly redirect: 'error'
      readonly range: 'forbidden'
    }
  }
  readonly catalogs: {
    readonly assetIndex: GarupaSnapshotCatalogDescriptor
    readonly characters: GarupaSnapshotCatalogDescriptor
    readonly costumes: GarupaSnapshotCatalogDescriptor
  }
  readonly sourceRegions: readonly ['jp', 'cn']
  readonly supportedRegion: 'jp'
  readonly regionSemantics: 'jp-preferred-union'
  readonly expectedRuntimeProfile: 'spine-4.0'
  readonly licenseStatus: 'not-declared'
  readonly upstream: 'Bestdori'
  readonly approvedAt: string
  readonly debugFixture: {
    readonly id: string
    readonly sdAssetBundleName: string
    readonly modelName: string
    readonly files: readonly GarupaSnapshotFileDescriptor[]
  }
}
