import { describe, expect, it } from 'vitest'

import {
  GARUPA_PROVIDER_PUBLIC_PATH,
  GARUPA_PINNED_PROVIDER_MANIFEST,
  GarupaProviderManifestError,
  parseGarupaPinnedProviderManifest,
  resolveGarupaPinnedUrl,
  serializeGarupaPinnedProviderManifest,
} from './providerManifest'

describe('Garupa pinned provider manifest', () => {
  it('pins the approved bangdream-live2d commit and catalog integrity', () => {
    expect(GARUPA_PINNED_PROVIDER_MANIFEST).toMatchObject({
      schemaVersion: 1,
      status: 'experimental',
      repository: {
        sourceRevision: '15b3e023cfdc576212f8b3a6b001c9f26e755f23',
      },
      delivery: {
        baseUrl:
          'https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@15b3e023cfdc576212f8b3a6b001c9f26e755f23',
      },
      catalogs: {
        assetIndex: {
          bytes: 264288,
          sha256:
            'bbbfa18d864c80b6d4464b3ec0f15cafad1a327e1bf265db474b80274567bea9',
        },
      },
      licenseStatus: 'not-declared',
    })
    expect(Object.isFrozen(GARUPA_PINNED_PROVIDER_MANIFEST)).toBe(true)
    expect(Object.isFrozen(GARUPA_PINNED_PROVIDER_MANIFEST.delivery)).toBe(true)
    expect(Object.isFrozen(GARUPA_PINNED_PROVIDER_MANIFEST.debugFixture.files)).toBe(true)
  })

  it('resolves only safe paths below the exact commit base', () => {
    expect(GARUPA_PROVIDER_PUBLIC_PATH).toBe(
      `${import.meta.env.BASE_URL}manifests/garupa/bangdream-live2d.v1.json`,
    )
    expect(resolveGarupaPinnedUrl('sdchara/_info.json')).toBe(
      'https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@15b3e023cfdc576212f8b3a6b001c9f26e755f23/sdchara/_info.json',
    )
    for (const path of [
      '../secret',
      'https://bestdori.com/assets/jp/sdchara',
      '/absolute',
      'sdchara\\model',
    ]) {
      expect(() => resolveGarupaPinnedUrl(path)).toThrowError(
        expect.objectContaining<Partial<GarupaProviderManifestError>>({
          code: 'GARUPA_REMOTE_URL_INVALID',
        }),
      )
    }
  })

  it('rejects a mutable or forged delivery revision', () => {
    const mutable = structuredClone(GARUPA_PINNED_PROVIDER_MANIFEST) as unknown as {
      delivery: { baseUrl: string }
    }
    mutable.delivery.baseUrl =
      'https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@live2d'
    expect(() => parseGarupaPinnedProviderManifest(mutable)).toThrowError(
      expect.objectContaining<Partial<GarupaProviderManifestError>>({
        code: 'GARUPA_REMOTE_MANIFEST_INVALID',
      }),
    )

    const forged = structuredClone(GARUPA_PINNED_PROVIDER_MANIFEST) as unknown as {
      repository: { commitUrl: string; sourceRevision: string }
      delivery: { baseUrl: string }
    }
    const forgedRevision = '0000000000000000000000000000000000000000'
    forged.repository.sourceRevision = forgedRevision
    forged.repository.commitUrl =
      `https://github.com/panxuc/bangdream-live2d/commit/${forgedRevision}`
    forged.delivery.baseUrl =
      `https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@${forgedRevision}`
    expect(() => parseGarupaPinnedProviderManifest(forged)).toThrowError(
      expect.objectContaining<Partial<GarupaProviderManifestError>>({
        code: 'GARUPA_REMOTE_MANIFEST_INVALID',
      }),
    )
  })

  it('rejects unsafe fixture identities and duplicate canonical paths', () => {
    const unsafeIdentity = structuredClone(
      GARUPA_PINNED_PROVIDER_MANIFEST,
    ) as unknown as { debugFixture: { id: string } }
    unsafeIdentity.debugFixture.id = '../fixture'
    expect(() => parseGarupaPinnedProviderManifest(unsafeIdentity)).toThrowError(
      expect.objectContaining<Partial<GarupaProviderManifestError>>({
        code: 'GARUPA_REMOTE_MANIFEST_INVALID',
      }),
    )

    const duplicatePath = structuredClone(
      GARUPA_PINNED_PROVIDER_MANIFEST,
    ) as unknown as {
      debugFixture: { files: Array<{ canonicalPath: string | null }> }
    }
    duplicatePath.debugFixture.files[3].canonicalPath =
      duplicatePath.debugFixture.files[2].canonicalPath
    expect(() => parseGarupaPinnedProviderManifest(duplicatePath)).toThrowError(
      expect.objectContaining<Partial<GarupaProviderManifestError>>({
        code: 'GARUPA_REMOTE_MANIFEST_INVALID',
      }),
    )
  })

  it('serializes the exact frozen manifest for user delivery', () => {
    const serialized = serializeGarupaPinnedProviderManifest()
    expect(serialized.endsWith('\n')).toBe(true)
    expect(JSON.parse(serialized)).toEqual(GARUPA_PINNED_PROVIDER_MANIFEST)
  })
})
