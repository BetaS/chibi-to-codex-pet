import {
  TextReader,
  Uint8ArrayWriter,
  ZipWriter,
} from '@zip.js/zip.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createSpine40SkeletonHeader,
  SPINE_40_FIXTURE_HASH,
} from '../../../../test/skeletonFixtures'
import {
  createMetadataOnlyZipFile,
  createZipFile,
  type ZipFixtureEntry,
} from '../../../../test/zipFixtures'
import {
  decodeGarupaPngInBrowser,
  GARUPA_SPINE_PACK_LIMITS,
  GarupaSpinePackImporter,
  parseGarupaSpinePackManifest,
} from './index'

const MODEL_NAME = 's000_templete'
const SKELETON_PATH = `model/${MODEL_NAME}.skel`
const ATLAS_PATH = 'costume/u000_templete.atlas'
const PAGE_PATH = 'costume/u000_templete.png'
const SOURCE_REVISION = '15b3e023cfdc576212f8b3a6b001c9f26e755f23'
const PNG_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1,
])

interface FixtureOptions {
  readonly atlas?: string | Uint8Array
  readonly extraEntries?: readonly ZipFixtureEntry[]
  readonly manifestPath?: string
  readonly mutateManifest?: (manifest: Record<string, unknown>) => void
  readonly omitPaths?: readonly string[]
  readonly pages?: Readonly<Record<string, Uint8Array>>
  readonly skeleton?: Uint8Array
  readonly version?: string
}

function bytesOf(value: string | Uint8Array): Uint8Array {
  return typeof value === 'string' ? new TextEncoder().encode(value) : value
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = bytesOf(value)
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    bytes.slice().buffer,
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function atlasFor(
  references: readonly string[],
  pma: readonly ('false' | 'omit' | 'true')[] = references.map(() => 'false'),
): string {
  return references
    .map((reference, index) => {
      const pmaLine = pma[index] === 'omit' ? '' : `pma: ${pma[index]}`
      return `${reference}
size: 1,1
format: RGBA8888
filter: Linear,Linear
repeat: none
${pmaLine}
region_${index}
  rotate: false
  xy: 0,0
  size: 1,1
  orig: 1,1
  offset: 0,0
  index: -1`
    })
    .join('\n\n')
}

async function createCanonicalFixture(
  options: FixtureOptions = {},
): Promise<{ file: File; skeleton: Uint8Array }> {
  const skeleton =
    options.skeleton ??
    new Uint8Array(createSpine40SkeletonHeader(options.version ?? '4.0.64'))
  const pages = options.pages ?? { [PAGE_PATH]: PNG_BYTES }
  const atlas =
    options.atlas ??
    atlasFor(
      Object.keys(pages).map((path) => path.slice('costume/'.length)),
    )
  const filePayloads = [
    [SKELETON_PATH, skeleton],
    [ATLAS_PATH, bytesOf(atlas)],
    ...Object.entries(pages),
  ] as const
  const files = Object.fromEntries(
    await Promise.all(
      filePayloads.map(
        async ([path, bytes]) => [path, await sha256(bytes)] as const,
      ),
    ),
  )
  const manifest: Record<string, unknown> = {
    schemaVersion: 1,
    gameId: 'garupa',
    assetFamily: 'sdchara',
    sdAssetBundleName: '00001',
    modelName: MODEL_NAME,
    skeletonPath: SKELETON_PATH,
    atlasPath: ATLAS_PATH,
    files,
    provenance: {
      sourceKind: 'github-mirror',
      sourceRevision: SOURCE_REVISION,
      acquiredAt: '2026-07-11T00:00:00Z',
    },
  }
  options.mutateManifest?.(manifest)

  const omitted = new Set(options.omitPaths ?? [])
  const entries: ZipFixtureEntry[] = [
    {
      name: options.manifestPath ?? 'garupa-spine-pack.json',
      content: JSON.stringify(manifest),
    },
    { name: SKELETON_PATH, content: skeleton },
    { name: ATLAS_PATH, content: atlas },
    ...Object.entries(pages).map(([name, content]) => ({ name, content })),
    ...(options.extraEntries ?? []),
  ].filter((entry) => !omitted.has(entry.name))

  return { file: await createZipFile(entries, 'garupa.zip'), skeleton }
}

function importerWithDecoder(
  decodePng = vi.fn(async () => undefined),
): GarupaSpinePackImporter {
  return new GarupaSpinePackImporter({ decodePng })
}

async function expectImportError(
  file: File,
  code: string,
  importer = importerWithDecoder(),
): Promise<void> {
  await expect(importer.import(file)).rejects.toMatchObject({ code })
}

async function createSymlinkZip(): Promise<File> {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
  })
  await writer.add('link.skel', new TextReader('model/real.skel'), {
    externalFileAttributes: (0o120777 << 16) >>> 0,
    level: 0,
    useWebWorkers: false,
    versionMadeBy: 0x0314,
  })
  return new File([await writer.close()], 'symlink.zip', {
    type: 'application/zip',
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GarupaSpinePackImporter canonical success', () => {
  it('returns an atomic provider-independent handoff and preserves Spine bytes', async () => {
    const decodePng = vi.fn(async () => undefined)
    const { file, skeleton } = await createCanonicalFixture({
      extraEntries: [{ name: 'notes.txt', content: 'ignored but bounded' }],
    })

    const source = await importerWithDecoder(decodePng).import(file)

    expect(new Uint8Array(source.skeletonData)).toEqual(skeleton)
    expect(source.skeletonData.byteLength).toBe(skeleton.byteLength)
    expect(source.atlasBundle).toMatchObject({
      sourceName: '00001-s000_templete',
      atlasPath: ATLAS_PATH,
    })
    expect([...source.atlasBundle.atlasPages.keys()]).toEqual([PAGE_PATH])
    expect(source.metadata).toMatchObject({
      gameId: 'garupa',
      assetFamily: 'sdchara',
      sdAssetBundleName: '00001',
      modelName: MODEL_NAME,
      runtimeKey: 'spine-4.0',
      skeletonVersion: '4.0.64',
      skeletonHeaderHash: SPINE_40_FIXTURE_HASH,
      compatibility: 'verified',
      alphaMode: 'straight',
      lookRigProfile: 'garupa-dual-eye-v1',
      provenance: {
        sourceKind: 'github-mirror',
        sourceRevision: SOURCE_REVISION,
      },
    })
    expect(Object.keys(source.metadata.fileSha256).sort()).toEqual(
      [SKELETON_PATH, ATLAS_PATH, PAGE_PATH].sort(),
    )
    expect(
      Object.values(source.metadata.fileSha256).every(
        (hash) => hash.length === 64,
      ),
    ).toBe(true)
    expect(decodePng).toHaveBeenCalledOnce()
    expect(JSON.stringify(source)).not.toContain('bestdori')
    expect(JSON.stringify(source)).not.toContain('buildData')
    expect(Object.keys(source)).not.toContain('objectUrl')
  })

  it('preserves multi-page atlas order and accepts omitted or false pma', async () => {
    const pages = {
      'costume/page-a.png': PNG_BYTES,
      'costume/nested/page-b.png': Uint8Array.from(PNG_BYTES),
    }
    const { file } = await createCanonicalFixture({
      pages,
      atlas: atlasFor(['page-a.png', 'nested/page-b.png'], ['omit', 'false']),
    })

    const source = await importerWithDecoder().import(file)

    expect([...source.atlasBundle.atlasPages.keys()]).toEqual([
      'costume/page-a.png',
      'costume/nested/page-b.png',
    ])
    expect(source.metadata.alphaMode).toBe('straight')
  })
})

describe('Garupa schema, identity and integrity', () => {
  it.each([
    ['missing asset family', (manifest: Record<string, unknown>) => {
      delete manifest.assetFamily
    }],
    ['schema version', (manifest: Record<string, unknown>) => {
      manifest.schemaVersion = 2
    }],
    ['game id', (manifest: Record<string, unknown>) => {
      manifest.gameId = 'other'
    }],
    ['single-segment identity', (manifest: Record<string, unknown>) => {
      manifest.modelName = '../model'
    }],
    ['canonical skeleton path', (manifest: Record<string, unknown>) => {
      manifest.skeletonPath = 'model/other.skel'
    }],
    ['mutable revision', (manifest: Record<string, unknown>) => {
      ;(manifest.provenance as Record<string, unknown>).sourceRevision = 'main'
    }],
    ['invalid acquiredAt', (manifest: Record<string, unknown>) => {
      ;(manifest.provenance as Record<string, unknown>).acquiredAt =
        '2026-02-30T00:00:00Z'
    }],
    ['uppercase SHA-256', (manifest: Record<string, unknown>) => {
      const files = manifest.files as Record<string, string>
      files[PAGE_PATH] = files[PAGE_PATH]?.toUpperCase() ?? ''
    }],
  ])('rejects invalid %s', async (_name, mutateManifest) => {
    const { file } = await createCanonicalFixture({ mutateManifest })
    await expectImportError(file, 'GARUPA_MANIFEST_INVALID')
  })

  it('requires exactly one root manifest', async () => {
    await expectImportError(
      (await createCanonicalFixture({ manifestPath: 'nested/garupa-spine-pack.json' }))
        .file,
      'GARUPA_MANIFEST_INVALID',
    )
    await expectImportError(
      await createZipFile([{ name: 'readme.txt', content: 'none' }]),
      'GARUPA_MANIFEST_MISSING',
    )
  })

  it('distinguishes hash mismatch, missing identity and extra model files', async () => {
    const hashMismatch = await createCanonicalFixture({
      mutateManifest(manifest) {
        ;(manifest.files as Record<string, string>)[PAGE_PATH] = '0'.repeat(64)
      },
    })
    await expectImportError(hashMismatch.file, 'GARUPA_PACK_HASH_MISMATCH')

    const missingSkeleton = await createCanonicalFixture({
      omitPaths: [SKELETON_PATH],
    })
    await expectImportError(missingSkeleton.file, 'GARUPA_MANIFEST_INVALID')

    const ambiguous = await createCanonicalFixture({
      extraEntries: [{ name: 'model/other.skel', content: 'other' }],
    })
    await expectImportError(ambiguous.file, 'GARUPA_MODEL_AMBIGUOUS')
  })

  it('validates the standalone manifest parser without a ZIP', () => {
    const hash = 'a'.repeat(64)
    expect(
      parseGarupaSpinePackManifest({
        schemaVersion: 1,
        gameId: 'garupa',
        assetFamily: 'sdchara',
        sdAssetBundleName: 'bundle-1',
        modelName: 'model_1',
        skeletonPath: 'model/model_1.skel',
        atlasPath: 'costume/atlas-1.atlas',
        files: {
          'model/model_1.skel': hash,
          'costume/atlas-1.atlas': hash,
          'costume/page.png': hash,
        },
        provenance: {
          sourceKind: 'device-export',
          sourceRevision: 'b'.repeat(64),
          acquiredAt: '2026-07-11T09:00:00+09:00',
        },
      }),
    ).toMatchObject({ schemaVersion: 1, assetFamily: 'sdchara' })
  })
})

describe('Garupa ZIP safety and limits', () => {
  it.each([
    '../escape.txt',
    '/absolute.txt',
    'C:/drive.txt',
    'bad\\path.txt',
    'empty//segment.txt',
    'dot/./segment.txt',
    'dot/../segment.txt',
    'nul\0path.txt',
  ])('rejects unsafe path %s', async (path) => {
    await expectImportError(
      createMetadataOnlyZipFile([{ name: path }]),
      'GARUPA_PACK_UNSAFE_PATH',
    )
  })

  it('rejects case-fold and file/directory prefix collisions', async () => {
    await expectImportError(
      createMetadataOnlyZipFile([
        { name: 'Costume/Page.png' },
        { name: 'costume/page.PNG' },
      ]),
      'GARUPA_PACK_PATH_COLLISION',
    )
    await expectImportError(
      createMetadataOnlyZipFile([
        { name: 'model' },
        { name: 'model/file.skel' },
      ]),
      'GARUPA_PACK_PATH_COLLISION',
    )
  })

  it('rejects encryption and Unix symlink metadata before extraction', async () => {
    await expectImportError(
      await createZipFile([
        { name: 'secret.txt', content: 'secret', password: 'password' },
      ]),
      'GARUPA_PACK_ENCRYPTED',
    )
    await expectImportError(
      await createSymlinkZip(),
      'GARUPA_PACK_UNSAFE_PATH',
    )
  })

  it('prevalidates compressed, expanded and file-count limits including unused entries', async () => {
    const oversized = {
      name: 'large.zip',
      size: GARUPA_SPINE_PACK_LIMITS.compressedBytes + 1,
    } as File
    await expectImportError(oversized, 'GARUPA_PACK_TOO_LARGE')

    await expectImportError(
      createMetadataOnlyZipFile([
        {
          name: 'unused.bin',
          uncompressedSize: GARUPA_SPINE_PACK_LIMITS.uncompressedBytes + 1,
        },
      ]),
      'GARUPA_PACK_TOO_LARGE',
    )
    await expectImportError(
      createMetadataOnlyZipFile(
        Array.from(
          { length: GARUPA_SPINE_PACK_LIMITS.fileEntries + 1 },
          (_, index) => ({ name: `unused-${index}.txt` }),
        ),
      ),
      'GARUPA_PACK_TOO_LARGE',
    )
  })
})

describe('Garupa asset family distinctions', () => {
  it('rejects characters/livesd sprite input explicitly', async () => {
    await expectImportError(
      await createZipFile([
        {
          name: 'characters/livesd/001/sdchara.png',
          content: PNG_BYTES,
        },
        {
          name: 'characters/livesd/001/sprites.json',
          content: JSON.stringify({ anim001: {}, anim002: {}, anim003: {}, anim004: {} }),
        },
      ]),
      'GARUPA_LIVE_SPRITE_UNSUPPORTED',
    )
  })

  it('rejects Cubism files and manifest families explicitly', async () => {
    await expectImportError(
      await createZipFile([{ name: 'model/character.moc3', content: 'cubism' }]),
      'GARUPA_ASSET_FAMILY_UNSUPPORTED',
    )

    const live2dManifest = await createCanonicalFixture({
      mutateManifest(manifest) {
        manifest.assetFamily = 'live2d'
      },
    })
    await expectImportError(
      live2dManifest.file,
      'GARUPA_ASSET_FAMILY_UNSUPPORTED',
    )
  })
})

describe('Garupa atlas and PNG validation', () => {
  it('rejects non-UTF-8 atlas, duplicate pages and unsafe page paths', async () => {
    await expectImportError(
      (await createCanonicalFixture({ atlas: new Uint8Array([0xc3, 0x28]) })).file,
      'GARUPA_ATLAS_INVALID',
    )
    await expectImportError(
      (
        await createCanonicalFixture({
          atlas: atlasFor(['u000_templete.png', 'u000_templete.png']),
        })
      ).file,
      'GARUPA_ATLAS_INVALID',
    )
    await expectImportError(
      (await createCanonicalFixture({ atlas: atlasFor(['../escape.png']) })).file,
      'GARUPA_PACK_UNSAFE_PATH',
    )
  })

  it('rejects pma true, including mixed multi-page alpha modes', async () => {
    await expectImportError(
      (
        await createCanonicalFixture({
          atlas: atlasFor(['u000_templete.png'], ['true']),
        })
      ).file,
      'GARUPA_ALPHA_MODE_UNSUPPORTED',
    )

    const pages = {
      'costume/a.png': PNG_BYTES,
      'costume/b.png': Uint8Array.from(PNG_BYTES),
    }
    await expectImportError(
      (
        await createCanonicalFixture({
          pages,
          atlas: atlasFor(['a.png', 'b.png'], ['false', 'true']),
        })
      ).file,
      'GARUPA_ALPHA_MODE_UNSUPPORTED',
    )
  })

  it('distinguishes missing page, invalid signature and decode failure', async () => {
    await expectImportError(
      (await createCanonicalFixture({ omitPaths: [PAGE_PATH] })).file,
      'GARUPA_ATLAS_PAGE_MISSING',
    )

    await expectImportError(
      (
        await createCanonicalFixture({
          pages: { [PAGE_PATH]: new Uint8Array([1, 2, 3]) },
        })
      ).file,
      'GARUPA_TEXTURE_INVALID',
    )

    const decodeFailure = vi.fn(async () => {
      throw new Error('synthetic decoder failure')
    })
    await expectImportError(
      (await createCanonicalFixture()).file,
      'GARUPA_TEXTURE_INVALID',
      importerWithDecoder(decodeFailure),
    )
    expect(decodeFailure).toHaveBeenCalledOnce()
  })

  it('closes the browser ImageBitmap decode resource', async () => {
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ close, width: 1, height: 1 })),
    )

    await decodeGarupaPngInBrowser(
      new Blob([PNG_BYTES], { type: 'image/png' }),
      PAGE_PATH,
    )

    expect(close).toHaveBeenCalledOnce()
  })

  it('revokes fallback object URLs when image decode fails', async () => {
    const NativeUrl = URL
    const createObjectURL = vi.fn(() => 'blob:synthetic-png')
    const revokeObjectURL = vi.fn()
    class FailingImage {
      naturalHeight = 0
      naturalWidth = 0
      src = ''

      async decode(): Promise<void> {
        throw new Error('synthetic image failure')
      }
    }
    class ObjectUrl extends NativeUrl {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    }
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal('Image', FailingImage)
    vi.stubGlobal('URL', ObjectUrl)

    await expect(
      decodeGarupaPngInBrowser(
        new Blob([PNG_BYTES], { type: 'image/png' }),
        PAGE_PATH,
      ),
    ).rejects.toThrow('synthetic image failure')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-png')
  })
})

describe('Garupa Spine 4.0 header compatibility', () => {
  it.each([
    ['4.0.64', 'verified'],
    ['4.0.65', 'experimental'],
    ['4.0.1', 'experimental'],
    ['4.0', 'experimental'],
  ] as const)('classifies %s as %s', async (version, compatibility) => {
    const { file } = await createCanonicalFixture({ version })
    const source = await importerWithDecoder().import(file)

    expect(source.metadata.compatibility).toBe(compatibility)
    expect(source.metadata.skeletonVersion).toBe(version)
  })

  it.each(['3.6.53', '3.8.99', '4.1.0'])('rejects unsupported %s', async (version) => {
    const { file } = await createCanonicalFixture({ version })
    await expect(
      importerWithDecoder().import(file),
    ).rejects.toMatchObject({
      code: 'GARUPA_SKELETON_UNSUPPORTED_VERSION',
      actualVersion: version,
    })
  })

  it('rejects a bounded corrupt header before runtime load', async () => {
    const { file } = await createCanonicalFixture({
      skeleton: new Uint8Array([0x80]),
    })
    await expectImportError(file, 'GARUPA_SKELETON_CORRUPT')
  })
})
