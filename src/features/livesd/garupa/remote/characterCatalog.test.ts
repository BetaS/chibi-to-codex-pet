import { describe, expect, it, vi } from 'vitest'

import type {
  FetchGarupaPinnedBytesOptions,
  GarupaPinnedResponse,
} from './network'
import {
  loadGarupaPinnedCharacterCatalog,
  localizeGarupaCharacterName,
  parseGarupaPinnedCharacterCatalog,
} from './characterCatalog'

const encodeJson = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value))

function seasonEntry(characterId: number, sdAssetBundleName: string) {
  return {
    characterId,
    basicSeasonId: 1,
    costumeType: 'CASUAL',
    seasonCostumeType: 'CASUAL_SPRING',
    sdAssetBundleName,
    live2dAssetBundleName: 'unused',
    seasonType: 'season_1',
  }
}

function character(
  characterId: number,
  names: readonly (string | null)[],
  bundleNames: readonly string[],
  characterType = 'unique',
  bandId: number | null = null,
) {
  return {
    bandId,
    characterType,
    characterName: names,
    seasonCostumeListMap: {
      entries: {
        season_1: {
          entries: bundleNames.map((bundleName) =>
            seasonEntry(characterId, bundleName),
          ),
        },
      },
    },
  }
}

function validCharacters() {
  return {
    1: character(
      1,
      ['戸山 香澄', 'Kasumi Toyama', '戶山 香澄', '户山 香澄', '토야마 카스미'],
      ['00001'],
      'unique',
      1,
    ),
    2: character(
      2,
      ['丸山 彩', 'Aya Maruyama', '丸山 彩', '丸山 彩', null],
      ['00002'],
      'unique',
      4,
    ),
    3: character(
      3,
      ['重複A', 'Duplicate A', 'Duplicate A', 'Duplicate A', '중복A'],
      ['00003'],
      'unique',
      1,
    ),
    4: character(
      4,
      ['重複B', 'Duplicate B', 'Duplicate B', 'Duplicate B', '중복B'],
      ['00003'],
      'unique',
      2,
    ),
    1001: character(
      1001,
      ['モブA', 'Mob A', 'Mob A', 'Mob A', '모브A'],
      ['01001', '01002'],
      'another',
    ),
    1046: character(
      1046,
      ['モブA2', 'Mob A2', 'Mob A2', 'Mob A2', '모브A2'],
      ['01001'],
      'another',
    ),
  }
}

function validIndex() {
  const files = [
    'assets-star-builddata-00001-builddata.asset',
    'assets-star-builddata-00001_hurisode-builddata.asset',
    'assets-star-builddata-00002-builddata.asset',
    'assets-star-builddata-00003-builddata.asset',
    'assets-star-builddata-01001-builddata.asset',
    'assets-star-builddata-01001_variant-builddata.asset',
    'assets-star-builddata-01002-builddata.asset',
    'assets-star-builddata-09999-builddata.asset',
  ]
  return {
    builddata: {
      assetPath: 'sdchara/builddata_rip',
      saveDir: 'sdchara/builddata_rip',
      fileCount: files.length,
      files,
    },
  }
}

describe('Garupa pinned character catalog', () => {
  it('maps exact and suffix bundles to localized names without guessing ambiguous IDs', () => {
    const catalog = parseGarupaPinnedCharacterCatalog(
      encodeJson(validCharacters()),
      [
        '00001',
        '00001_hurisode',
        '00002',
        '00003',
        '01001',
        '01001_variant',
        '01002',
        '09999',
      ],
    )
    const byBundle = new Map(
      catalog.entries.map((entry) => [entry.bundleName, entry]),
    )

    expect(byBundle.get('00001')).toMatchObject({
      bandId: 1,
      characterId: 1,
      characterKind: 'unique',
      resolution: 'exact',
    })
    expect(localizeGarupaCharacterName(byBundle.get('00001')!, 'ko')).toBe(
      '토야마 카스미',
    )
    expect(byBundle.get('00001_hurisode')).toMatchObject({
      bandId: 1,
      characterId: 1,
      characterKind: 'unique',
      resolution: 'base',
    })
    expect(localizeGarupaCharacterName(byBundle.get('00002')!, 'ko')).toBe(
      'Aya Maruyama',
    )
    expect(byBundle.get('00002')).toMatchObject({ bandId: 4 })
    expect(byBundle.get('00003')).toMatchObject({
      bandId: null,
      characterId: null,
      characterKind: 'unmapped',
      names: null,
      resolution: 'ambiguous',
    })
    expect(byBundle.get('01001')).toMatchObject({
      bandId: null,
      characterId: null,
      characterKind: 'mob',
      names: null,
      resolution: 'ambiguous',
    })
    expect(byBundle.get('01001_variant')).toMatchObject({
      characterId: null,
      characterKind: 'mob',
      names: null,
      resolution: 'ambiguous',
    })
    expect(byBundle.get('01002')).toMatchObject({
      bandId: null,
      characterId: 1001,
      characterKind: 'mob',
      resolution: 'exact',
    })
    expect(localizeGarupaCharacterName(byBundle.get('01002')!, 'ko')).toBe(
      '모브A',
    )
    expect(byBundle.get('09999')).toMatchObject({
      bandId: null,
      characterId: null,
      characterKind: 'unmapped',
      names: null,
      resolution: 'unresolved',
    })
    expect(Object.isFrozen(catalog.entries)).toBe(true)
  })

  it('rejects unsafe names, mismatched character IDs, and duplicate bundle options', () => {
    const unsafeNames = validCharacters()
    unsafeNames[1].characterName = [
      '戸山 香澄',
      'Kasumi\nToyama',
      '戶山 香澄',
      '户山 香澄',
      '토야마 카스미',
    ]
    expect(() =>
      parseGarupaPinnedCharacterCatalog(encodeJson(unsafeNames), ['00001']),
    ).toThrowError(expect.objectContaining({
      code: 'GARUPA_REMOTE_CATALOG_INVALID',
    }))

    const mismatched = validCharacters()
    mismatched[1].seasonCostumeListMap.entries.season_1.entries[0]!.characterId = 2
    expect(() =>
      parseGarupaPinnedCharacterCatalog(encodeJson(mismatched), ['00001']),
    ).toThrowError(expect.objectContaining({
      code: 'GARUPA_REMOTE_CATALOG_INVALID',
    }))

    expect(() =>
      parseGarupaPinnedCharacterCatalog(
        encodeJson(validCharacters()),
        ['00001', '00001'],
      ),
    ).toThrowError(expect.objectContaining({
      code: 'GARUPA_REMOTE_CATALOG_INVALID',
    }))

    const invalidBand = validCharacters()
    invalidBand[1].bandId = 0
    expect(() =>
      parseGarupaPinnedCharacterCatalog(encodeJson(invalidBand), ['00001']),
    ).toThrowError(expect.objectContaining({
      code: 'GARUPA_REMOTE_CATALOG_INVALID',
    }))
  })

  it('loads only the two exact-commit catalogs declared by the provider manifest', async () => {
    const responses = new Map([
      ['sdchara/_info.json', encodeJson(validIndex())],
      ['data/characters.all.5.json', encodeJson(validCharacters())],
    ])
    const fetchBytes = vi.fn(async (
      relativePath: string,
      _options: FetchGarupaPinnedBytesOptions,
    ): Promise<GarupaPinnedResponse> => {
      void _options
      const bytes = responses.get(relativePath)
      if (!bytes) throw new Error(`Unexpected path: ${relativePath}`)
      return {
        bytes,
        contentType: 'application/json',
        sha256: 'fixture',
        url: `https://example.test/${relativePath}`,
      }
    })

    const catalog = await loadGarupaPinnedCharacterCatalog({
      signal: new AbortController().signal,
      fetchBytes,
    })

    expect(catalog.entries).toHaveLength(8)
    expect(fetchBytes.mock.calls.map(([path]) => path)).toEqual([
      'sdchara/_info.json',
      'data/characters.all.5.json',
    ])
    for (const [, options] of fetchBytes.mock.calls) {
      expect(options).toMatchObject({
        expectedContentTypes: ['application/json', 'text/plain'],
        integrityErrorCode: 'GARUPA_REMOTE_CATALOG_INVALID',
      })
      expect(options.expectedSha256).toMatch(/^[0-9a-f]{64}$/u)
    }
  })

})
