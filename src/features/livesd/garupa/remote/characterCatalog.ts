import type { AppLocale } from '../../../../i18n'
import {
  listGarupaBuildDataBundleNames,
  parseGarupaSnapshotIndex,
} from './catalog'
import { GarupaRemoteError, normalizeGarupaRemoteError } from './errors'
import {
  fetchGarupaPinnedBytes,
  type FetchGarupaPinnedBytesOptions,
  type GarupaPinnedResponse,
} from './network'
import { GARUPA_PINNED_PROVIDER_MANIFEST } from './providerManifest'

const MAX_CHARACTER_RECORDS = 4_096
const MAX_COSTUME_ROWS = 32_768
const MAX_BAND_ID = 9_999
const SAFE_BUNDLE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$/

export interface GarupaLocalizedCharacterNames {
  readonly en: string | null
  readonly ja: string | null
  readonly ko: string | null
  readonly zhCN: string | null
}

export type GarupaCharacterCatalogResolution =
  | 'ambiguous'
  | 'base'
  | 'exact'
  | 'unresolved'

export type GarupaCharacterKind = 'mob' | 'unique' | 'unmapped'

export interface GarupaPinnedCharacterCatalogEntry {
  readonly bandId: number | null
  readonly bundleName: string
  readonly characterId: number | null
  readonly characterKind: GarupaCharacterKind
  readonly names: GarupaLocalizedCharacterNames | null
  readonly resolution: GarupaCharacterCatalogResolution
}

export interface GarupaPinnedCharacterCatalog {
  readonly entries: readonly GarupaPinnedCharacterCatalogEntry[]
}

type GarupaPinnedCatalogFetcher = (
  relativePath: string,
  options: FetchGarupaPinnedBytesOptions,
) => Promise<GarupaPinnedResponse>

export interface LoadGarupaPinnedCharacterCatalogOptions {
  readonly signal: AbortSignal
  readonly fetchBytes?: GarupaPinnedCatalogFetcher
}

interface CharacterCandidate {
  readonly bandId: number | null
  readonly characterId: number
  readonly characterType: string
  readonly names: GarupaLocalizedCharacterNames
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidCatalog(message: string): never {
  throw new GarupaRemoteError('GARUPA_REMOTE_CATALOG_INVALID', message)
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    )
  })
}

function parseOptionalName(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') {
    invalidCatalog('Garupa characterName 값이 올바르지 않습니다.')
  }
  const name = value.trim()
  if (
    name.length === 0 ||
    Array.from(name).length > 128 ||
    hasControlCharacter(name)
  ) {
    invalidCatalog('Garupa characterName 범위가 올바르지 않습니다.')
  }
  return name
}

function parseNames(value: unknown): GarupaLocalizedCharacterNames {
  if (!Array.isArray(value) || value.length !== 5) {
    invalidCatalog('Garupa characterName locale 배열이 올바르지 않습니다.')
  }
  return Object.freeze({
    ja: parseOptionalName(value[0]),
    en: parseOptionalName(value[1]),
    zhCN: parseOptionalName(value[3]),
    ko: parseOptionalName(value[4]),
  })
}

function parseOptionalBandId(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_BAND_ID
  ) {
    invalidCatalog('Garupa bandId 범위가 올바르지 않습니다.')
  }
  return value
}

function addCandidate(
  candidates: Map<string, CharacterCandidate[]>,
  bundleName: string,
  candidate: CharacterCandidate,
): void {
  const existing = candidates.get(bundleName)
  if (existing) {
    existing.push(candidate)
  } else {
    candidates.set(bundleName, [candidate])
  }
}

function parseCharacterCandidates(
  bytes: Uint8Array,
): ReadonlyMap<string, readonly CharacterCandidate[]> {
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    invalidCatalog('Garupa character catalog가 올바른 UTF-8 JSON이 아닙니다.')
  }
  if (!isRecord(parsed) || Object.keys(parsed).length > MAX_CHARACTER_RECORDS) {
    invalidCatalog('Garupa character catalog root가 올바르지 않습니다.')
  }

  const candidates = new Map<string, CharacterCandidate[]>()
  let costumeRows = 0
  for (const [rawCharacterId, rawCharacter] of Object.entries(parsed)) {
    if (!/^[1-9][0-9]{0,8}$/u.test(rawCharacterId) || !isRecord(rawCharacter)) {
      invalidCatalog('Garupa character catalog ID가 올바르지 않습니다.')
    }
    const characterId = Number(rawCharacterId)
    if (!Number.isSafeInteger(characterId)) {
      invalidCatalog('Garupa character catalog ID 범위가 올바르지 않습니다.')
    }
    if (
      typeof rawCharacter.characterType !== 'string' ||
      rawCharacter.characterType.length < 1 ||
      rawCharacter.characterType.length > 32 ||
      hasControlCharacter(rawCharacter.characterType)
    ) {
      invalidCatalog('Garupa characterType이 올바르지 않습니다.')
    }
    const candidate = Object.freeze({
      bandId: parseOptionalBandId(rawCharacter.bandId),
      characterId,
      characterType: rawCharacter.characterType,
      names: parseNames(rawCharacter.characterName),
    })
    if (rawCharacter.seasonCostumeListMap === undefined) continue
    if (
      !isRecord(rawCharacter.seasonCostumeListMap) ||
      !isRecord(rawCharacter.seasonCostumeListMap.entries)
    ) {
      invalidCatalog('Garupa season costume map이 올바르지 않습니다.')
    }
    for (const rawSeason of Object.values(
      rawCharacter.seasonCostumeListMap.entries,
    )) {
      if (!isRecord(rawSeason) || !Array.isArray(rawSeason.entries)) {
        invalidCatalog('Garupa season costume entry가 올바르지 않습니다.')
      }
      for (const rawCostume of rawSeason.entries) {
        costumeRows += 1
        if (costumeRows > MAX_COSTUME_ROWS || !isRecord(rawCostume)) {
          invalidCatalog('Garupa season costume 수가 올바르지 않습니다.')
        }
        const bundleName = rawCostume.sdAssetBundleName
        if (
          rawCostume.characterId !== characterId ||
          typeof bundleName !== 'string' ||
          !SAFE_BUNDLE_NAME.test(bundleName)
        ) {
          invalidCatalog('Garupa season costume identity가 올바르지 않습니다.')
        }
        addCandidate(candidates, bundleName, candidate)
      }
    }
  }

  return candidates
}

function resolveCandidate(
  candidates: readonly CharacterCandidate[] | undefined,
): CharacterCandidate | null {
  if (!candidates || candidates.length === 0) return null
  const byCharacterId = new Map<number, CharacterCandidate>()
  for (const candidate of candidates) {
    byCharacterId.set(candidate.characterId, candidate)
  }
  const uniqueCharacters = [...byCharacterId.values()]
  const primaryCharacters = uniqueCharacters.filter(
    (candidate) => candidate.characterType === 'unique',
  )
  const preferred = primaryCharacters.length > 0
    ? primaryCharacters
    : uniqueCharacters
  return preferred.length === 1 ? preferred[0] ?? null : null
}

function candidateKind(
  candidate: CharacterCandidate,
): Exclude<GarupaCharacterKind, 'unmapped'> {
  return candidate.characterType === 'unique' ? 'unique' : 'mob'
}

function ambiguousCandidateKind(
  candidates: readonly CharacterCandidate[],
): Extract<GarupaCharacterKind, 'mob' | 'unmapped'> {
  return candidates.every((candidate) => candidate.characterType !== 'unique')
    ? 'mob'
    : 'unmapped'
}

export function parseGarupaPinnedCharacterCatalog(
  characterBytes: Uint8Array,
  availableBundleNames: readonly string[],
): GarupaPinnedCharacterCatalog {
  if (
    availableBundleNames.length < 1 ||
    availableBundleNames.length > 8_192 ||
    availableBundleNames.some((name) => !SAFE_BUNDLE_NAME.test(name)) ||
    new Set(availableBundleNames.map((name) => name.toLowerCase())).size !==
      availableBundleNames.length
  ) {
    invalidCatalog('Garupa available bundle 목록이 올바르지 않습니다.')
  }
  const candidates = parseCharacterCandidates(characterBytes)
  const entries = availableBundleNames.map((bundleName) => {
    const exactCandidates = candidates.get(bundleName)
    const exact = resolveCandidate(exactCandidates)
    if (exact) {
      return Object.freeze({
        bandId: exact.bandId,
        bundleName,
        characterId: exact.characterId,
        characterKind: candidateKind(exact),
        names: exact.names,
        resolution: 'exact' as const,
      })
    }
    if (exactCandidates && exactCandidates.length > 0) {
      return Object.freeze({
        bandId: null,
        bundleName,
        characterId: null,
        characterKind: ambiguousCandidateKind(exactCandidates),
        names: null,
        resolution: 'ambiguous' as const,
      })
    }

    const separator = bundleName.indexOf('_')
    const baseName = separator > 0 ? bundleName.slice(0, separator) : null
    const baseCandidates = baseName ? candidates.get(baseName) : undefined
    const base = resolveCandidate(baseCandidates)
    if (base) {
      return Object.freeze({
        bandId: base.bandId,
        bundleName,
        characterId: base.characterId,
        characterKind: candidateKind(base),
        names: base.names,
        resolution: 'base' as const,
      })
    }
    if (baseCandidates && baseCandidates.length > 0) {
      return Object.freeze({
        bandId: null,
        bundleName,
        characterId: null,
        characterKind: ambiguousCandidateKind(baseCandidates),
        names: null,
        resolution: 'ambiguous' as const,
      })
    }
    return Object.freeze({
      bandId: null,
      bundleName,
      characterId: null,
      characterKind: 'unmapped' as const,
      names: null,
      resolution: 'unresolved' as const,
    })
  })
  return Object.freeze({ entries: Object.freeze(entries) })
}

export function localizeGarupaCharacterName(
  entry: GarupaPinnedCharacterCatalogEntry,
  locale: AppLocale,
): string | null {
  const names = entry.names
  if (!names) return null
  const primary = locale === 'zh-CN' ? names.zhCN : names[locale]
  return primary ?? names.en ?? names.ja ?? names.ko ?? names.zhCN
}

export async function loadGarupaPinnedCharacterCatalog(
  options: LoadGarupaPinnedCharacterCatalogOptions,
): Promise<GarupaPinnedCharacterCatalog> {
  const fetchBytes = options.fetchBytes ?? fetchGarupaPinnedBytes
  const manifest = GARUPA_PINNED_PROVIDER_MANIFEST
  try {
    const [indexResponse, characterResponse] = await Promise.all([
      fetchBytes(manifest.catalogs.assetIndex.path, {
        signal: options.signal,
        maxBytes: manifest.catalogs.assetIndex.bytes,
        expectedBytes: manifest.catalogs.assetIndex.bytes,
        expectedSha256: manifest.catalogs.assetIndex.sha256,
        expectedContentTypes: ['application/json', 'text/plain'],
        integrityErrorCode: 'GARUPA_REMOTE_CATALOG_INVALID',
      }),
      fetchBytes(manifest.catalogs.characters.path, {
        signal: options.signal,
        maxBytes: manifest.catalogs.characters.bytes,
        expectedBytes: manifest.catalogs.characters.bytes,
        expectedSha256: manifest.catalogs.characters.sha256,
        expectedContentTypes: ['application/json', 'text/plain'],
        integrityErrorCode: 'GARUPA_REMOTE_CATALOG_INVALID',
      }),
    ])
    const index = parseGarupaSnapshotIndex(indexResponse.bytes)
    return parseGarupaPinnedCharacterCatalog(
      characterResponse.bytes,
      listGarupaBuildDataBundleNames(index),
    )
  } catch (error) {
    throw normalizeGarupaRemoteError(error)
  }
}
