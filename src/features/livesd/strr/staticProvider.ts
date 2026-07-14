import type { AppLocale } from '../../../i18n'
import {
  readAtlasPageReferences,
  resolveAtlasPagePath,
} from '../model'
import {
  StrrProviderError,
  type StrrCatalog,
  type StrrCharacter,
  type StrrEdition,
  type StrrLocalizedLabels,
  type StrrModelInput,
} from './types'

export const STRR_MIRROR_COMMIT =
  '866b72570450d6e38d0d441d387d0a230d2cb70e'
export const STRR_DEFAULT_ASSET_ROOT =
  `https://raw.githubusercontent.com/clyerick/res-pak/${STRR_MIRROR_COMMIT}/strr`

const CATALOG_BYTES = 2 * 1024 * 1024
const SKELETON_BYTES = 8 * 1024 * 1024
const ATLAS_BYTES = 1024 * 1024
const PNG_BYTES = 16 * 1024 * 1024
const MAX_CHARACTERS = 100
const MAX_EDITIONS = 1_000
const MAX_PAGES = 8
const SAFE_ID = /^\d{1,16}$/u
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const LABEL_LOCALES = ['en', 'ja', 'ko', 'zh_hant'] as const

export interface LoadStrrCatalogOptions {
  readonly fetcher?: typeof fetch
  readonly signal: AbortSignal
}

export interface LoadStrrModelOptions {
  readonly catalog: StrrCatalog
  readonly characterId: string
  readonly editionId: string
  readonly fetcher?: typeof fetch
  readonly signal: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidCatalog(message: string): never {
  throw new StrrProviderError('STRR_CATALOG_INVALID', message)
}

function invalidModel(message: string, cause?: unknown): never {
  throw new StrrProviderError(
    'STRR_MODEL_INVALID',
    message,
    cause === undefined ? {} : { cause },
  )
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 0x20 || codePoint === 0x7f
  })
}

function parseLabels(value: unknown, field: string): StrrLocalizedLabels {
  if (!isRecord(value)) {
    return invalidCatalog(`${field} labels가 object가 아닙니다.`)
  }
  const labels: Partial<Record<(typeof LABEL_LOCALES)[number], string>> = {}
  for (const locale of LABEL_LOCALES) {
    const label = value[locale]
    if (label === undefined) continue
    if (
      typeof label !== 'string' ||
      Array.from(label).length < 1 ||
      Array.from(label).length > 128 ||
      hasControlCharacter(label)
    ) {
      return invalidCatalog(`${field}.${locale} label이 유효하지 않습니다.`)
    }
    labels[locale] = label
  }
  if (Object.keys(labels).length === 0) {
    return invalidCatalog(`${field}에 표시 가능한 label이 없습니다.`)
  }
  return Object.freeze(labels)
}

function parseEdition(
  value: unknown,
  characterId: string,
  seen: Set<string>,
): StrrEdition {
  if (!isRecord(value) || typeof value.id !== 'string' || !SAFE_ID.test(value.id)) {
    return invalidCatalog('STRR edition ID가 유효하지 않습니다.')
  }
  if (!value.id.startsWith(characterId) || seen.has(value.id)) {
    return invalidCatalog(`STRR edition identity가 유효하지 않습니다: ${value.id}`)
  }
  if (
    value.side !== 'right' ||
    (value.metadataSource !== 'karth' && value.metadataSource !== 'local')
  ) {
    return invalidCatalog(`STRR edition metadata가 유효하지 않습니다: ${value.id}`)
  }
  seen.add(value.id)
  return Object.freeze({
    id: value.id,
    labels: parseLabels(value.labels, `edition.${value.id}`),
    metadataSource: value.metadataSource,
    side: value.side,
  })
}

export function parseStrrCatalog(value: unknown): StrrCatalog {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.gameId !== 'strr' ||
    !Array.isArray(value.characters) ||
    value.characters.length < 1 ||
    value.characters.length > MAX_CHARACTERS
  ) {
    return invalidCatalog('STRR catalog root가 유효하지 않습니다.')
  }

  const characterIds = new Set<string>()
  const editionIds = new Set<string>()
  let editionCount = 0
  const characters = value.characters.map((candidate): StrrCharacter => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      !/^\d{1,8}$/u.test(candidate.id) ||
      characterIds.has(candidate.id) ||
      !Array.isArray(candidate.editions) ||
      candidate.editions.length < 1
    ) {
      return invalidCatalog('STRR character entry가 유효하지 않습니다.')
    }
    const characterId = candidate.id
    characterIds.add(characterId)
    editionCount += candidate.editions.length
    if (editionCount > MAX_EDITIONS) {
      return invalidCatalog('STRR edition 수가 제한을 초과했습니다.')
    }
    return Object.freeze({
      id: characterId,
      labels: parseLabels(candidate.labels, `character.${characterId}`),
      editions: Object.freeze(
        candidate.editions.map((edition) =>
          parseEdition(edition, characterId, editionIds),
        ),
      ),
    })
  })

  return Object.freeze({
    version: 1,
    gameId: 'strr',
    characters: Object.freeze(characters),
  })
}

function preferredLabelLocales(locale: AppLocale) {
  if (locale === 'zh-CN') return ['zh_hant', 'en', 'ja', 'ko'] as const
  if (locale === 'ko') return ['ko', 'en', 'ja', 'zh_hant'] as const
  if (locale === 'ja') return ['ja', 'en', 'ko', 'zh_hant'] as const
  return ['en', 'ja', 'ko', 'zh_hant'] as const
}

export function localizeStrrLabels(
  labels: StrrLocalizedLabels,
  locale: AppLocale,
  fallback: string,
): string {
  for (const candidate of preferredLabelLocales(locale)) {
    const label = labels[candidate]
    if (label) return label
  }
  return fallback
}

function joinMirrorAssetPath(...segments: string[]): string {
  return `${STRR_DEFAULT_ASSET_ROOT}/${segments
    .map(encodeURIComponent)
    .join('/')}`
}

async function readLimitedResponse(
  response: Response,
  maximumBytes: number,
  code: 'STRR_CATALOG_LOAD_FAILED' | 'STRR_MODEL_LOAD_FAILED',
  label: string,
): Promise<ArrayBuffer> {
  if (!response.ok) {
    throw new StrrProviderError(code, `${label} 요청이 HTTP ${response.status}로 실패했습니다.`)
  }
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new StrrProviderError(code, `${label} 크기가 제한을 초과했습니다.`)
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength < 1 || bytes.byteLength > maximumBytes) {
    throw new StrrProviderError(code, `${label} 크기가 유효하지 않습니다.`)
  }
  return bytes
}

async function fetchBytes(
  fetcher: typeof fetch,
  url: string,
  signal: AbortSignal,
  maximumBytes: number,
  code: 'STRR_CATALOG_LOAD_FAILED' | 'STRR_MODEL_LOAD_FAILED',
  label: string,
): Promise<ArrayBuffer> {
  let response: Response
  try {
    response = await fetcher(url, {
      cache: url.startsWith(`${STRR_DEFAULT_ASSET_ROOT}/`)
        ? 'force-cache'
        : 'no-store',
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new StrrProviderError(code, `${label}을 불러오지 못했습니다.`, {
      cause: error,
    })
  }
  return readLimitedResponse(response, maximumBytes, code, label)
}

function decodeUtf8(bytes: ArrayBuffer, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    return invalidModel(`${label}이 유효한 UTF-8이 아닙니다.`, error)
  }
}

function assertPng(bytes: ArrayBuffer, page: string): void {
  const value = new Uint8Array(bytes)
  if (
    value.byteLength < PNG_SIGNATURE.byteLength ||
    PNG_SIGNATURE.some((byte, index) => value[index] !== byte)
  ) {
    invalidModel(`STRR atlas page가 PNG가 아닙니다: ${page}`)
  }
}

export async function loadStrrCatalog({
  fetcher = fetch,
  signal,
}: LoadStrrCatalogOptions): Promise<StrrCatalog> {
  const bytes = await fetchBytes(
    fetcher,
    joinMirrorAssetPath('catalog.json'),
    signal,
    CATALOG_BYTES,
    'STRR_CATALOG_LOAD_FAILED',
    'STRR catalog',
  )
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (error) {
    throw new StrrProviderError(
      'STRR_CATALOG_INVALID',
      'STRR catalog가 유효한 UTF-8 JSON이 아닙니다.',
      { cause: error },
    )
  }
  return parseStrrCatalog(value)
}

export async function loadStrrModel({
  catalog,
  characterId,
  editionId,
  fetcher = fetch,
  signal,
}: LoadStrrModelOptions): Promise<StrrModelInput> {
  const character = catalog.characters.find((entry) => entry.id === characterId)
  const edition = character?.editions.find((entry) => entry.id === editionId)
  if (!character || !edition) {
    throw new StrrProviderError(
      'STRR_SELECTION_INVALID',
      '현재 STRR catalog에 없는 캐릭터 또는 에디션입니다.',
    )
  }

  const skeletonUrl = joinMirrorAssetPath(
    'characters',
    characterId,
    'model_right.skel',
  )
  const editionRoot = joinMirrorAssetPath(
    'editions',
    editionId,
  )
  const atlasUrl = `${editionRoot}/model_right.atlas`
  const skeletonData = await fetchBytes(
    fetcher,
    skeletonUrl,
    signal,
    SKELETON_BYTES,
    'STRR_MODEL_LOAD_FAILED',
    'STRR skeleton',
  )
  const atlasBytes = await fetchBytes(
    fetcher,
    atlasUrl,
    signal,
    ATLAS_BYTES,
    'STRR_MODEL_LOAD_FAILED',
    'STRR atlas',
  )
  const atlasText = decodeUtf8(atlasBytes, 'STRR atlas')

  let pageReferences: readonly string[]
  try {
    pageReferences = readAtlasPageReferences(atlasText)
  } catch (error) {
    return invalidModel('STRR atlas page 목록을 읽을 수 없습니다.', error)
  }
  if (pageReferences.length < 1 || pageReferences.length > MAX_PAGES) {
    return invalidModel('STRR atlas page 수가 유효하지 않습니다.')
  }

  const atlasPages = new Map<string, Blob>()
  let totalPngBytes = 0
  for (const pageReference of pageReferences) {
    let pagePath: string
    try {
      pagePath = resolveAtlasPagePath('model_right.atlas', pageReference)
    } catch (error) {
      return invalidModel(`안전하지 않은 STRR atlas page입니다: ${pageReference}`, error)
    }
    if (!pagePath.toLocaleLowerCase('en-US').endsWith('.png')) {
      return invalidModel(`STRR atlas page가 PNG가 아닙니다: ${pageReference}`)
    }
    const pageBytes = await fetchBytes(
      fetcher,
      `${editionRoot}/${pagePath
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      signal,
      PNG_BYTES - totalPngBytes,
      'STRR_MODEL_LOAD_FAILED',
      `STRR atlas page ${pagePath}`,
    )
    assertPng(pageBytes, pagePath)
    totalPngBytes += pageBytes.byteLength
    atlasPages.set(pagePath, new Blob([pageBytes], { type: 'image/png' }))
  }

  return Object.freeze({
    characterId,
    editionId,
    skeletonData,
    atlasBundle: Object.freeze({
      sourceName: `${characterId}:${editionId}`,
      atlasPath: 'model_right.atlas',
      atlasText,
      atlasPages,
    }),
  })
}
