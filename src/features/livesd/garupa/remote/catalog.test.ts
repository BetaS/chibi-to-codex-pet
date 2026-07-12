import { describe, expect, it } from 'vitest'

import { GarupaRemoteError } from './errors'
import {
  findGarupaBuildDataFile,
  findUniqueCatalogFile,
  parseGarupaBuildData,
  parseGarupaSnapshotIndex,
} from './catalog'

const encodeJson = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value))

function validIndex() {
  return {
    builddata: {
      assetPath: 'sdchara/builddata_rip',
      saveDir: 'sdchara/builddata_rip',
      fileCount: 4,
      files: [
        'assets-star-builddata-00001-builddata.asset',
        'assets-star-builddata-00001-u000_templete.atlas.txt',
        'assets-star-builddata-00001-u000_templete.png',
        'assets-star-builddata-00002-builddata.asset',
      ],
    },
    'model/s000_templete': {
      assetPath: 'sdchara/model/s000_templete_rip',
      saveDir: 'sdchara/model/s000_templete_rip',
      fileCount: 2,
      files: ['s000_templete.skel', 's000_templete.png'],
    },
  }
}

describe('Garupa pinned catalog graph', () => {
  it('parses bounded safe entries and resolves exact unique files', () => {
    const index = parseGarupaSnapshotIndex(encodeJson(validIndex()))
    expect(findGarupaBuildDataFile(index, '00001')).toBe(
      'assets-star-builddata-00001-builddata.asset',
    )
    expect(
      findUniqueCatalogFile(
        index['model/s000_templete']!,
        'S000_TEMPLETE.SKEL',
      ),
    ).toBe('s000_templete.skel')
    expect(Object.isFrozen(index)).toBe(true)
  })

  it('parses only the model and single costume texture graph', () => {
    expect(
      parseGarupaBuildData(
        encodeJson({
          Base: {
            model: {
              bundleName: 'sdchara/model/s000_templete',
              fileName: 's000_templete_SkeletonData.asset',
            },
            textures: [
              {
                bundleName: 'sdchara/00001',
                fileName: 'u000_templete_Atlas.asset',
              },
            ],
          },
        }),
      ),
    ).toEqual({
      modelBundleName: 'sdchara/model/s000_templete',
      modelFileName: 's000_templete_SkeletonData.asset',
      textureBundleName: 'sdchara/00001',
      textureFileName: 'u000_templete_Atlas.asset',
    })
  })

  it('rejects unsafe, duplicate, ambiguous, and malformed graphs', () => {
    const unsafe = validIndex()
    unsafe.builddata.files[0] = '../builddata.asset'
    expect(() => parseGarupaSnapshotIndex(encodeJson(unsafe))).toThrowError(
      expect.objectContaining<Partial<GarupaRemoteError>>({
        code: 'GARUPA_REMOTE_CATALOG_INVALID',
      }),
    )

    const ambiguous = validIndex()
    ambiguous.builddata.files[3] =
      'duplicate-star-builddata-00001-builddata.asset'
    const parsed = parseGarupaSnapshotIndex(encodeJson(ambiguous))
    expect(() => findGarupaBuildDataFile(parsed, '00001')).toThrowError(
      expect.objectContaining<Partial<GarupaRemoteError>>({
        code: 'GARUPA_REMOTE_BUILDDATA_INVALID',
      }),
    )

    expect(() =>
      parseGarupaBuildData(
        encodeJson({
          Base: {
            model: { bundleName: 'https://bestdori.com/model', fileName: 'x' },
            textures: [],
          },
        }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<GarupaRemoteError>>({
        code: 'GARUPA_REMOTE_BUILDDATA_INVALID',
      }),
    )
  })
})
