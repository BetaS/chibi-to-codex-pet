import { PrskRemoteError } from './errors'
import {
  PRSK_REMOTE_LIMITS,
  type PrskRemoteCharacterOption,
} from './types'

interface IndexedOption extends PrskRemoteCharacterOption {
  readonly originalIndex: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function invalidCatalog(message: string): never {
  throw new PrskRemoteError('REMOTE_CATALOG_INVALID', message, {
    resource: 'catalog',
  })
}

export function normalizePrskRemoteCharacterOptions(
  values: readonly unknown[],
): readonly PrskRemoteCharacterOption[] {
  if (values.length > PRSK_REMOTE_LIMITS.catalogOptions) {
    throw new PrskRemoteError(
      'REMOTE_CATALOG_ENTRY_LIMIT_EXCEEDED',
      `원격 catalog는 캐릭터를 최대 ${PRSK_REMOTE_LIMITS.catalogOptions}개까지 포함할 수 있습니다.`,
      { resource: 'catalog' },
    )
  }

  const ids = new Set<string>()
  const options: IndexedOption[] = values.map((value, originalIndex) => {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string') {
      return invalidCatalog('catalog 캐릭터 항목에는 문자열 id와 label이 필요합니다.')
    }

    const id = value.id
    const label = value.label
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(id)) {
      return invalidCatalog(
        '캐릭터 ID는 영숫자로 시작하고 영숫자, _, -, .만 포함하는 128자 이하 단일 경로여야 합니다.',
      )
    }
    const labelLength = Array.from(label).length
    if (labelLength < 1 || labelLength > PRSK_REMOTE_LIMITS.fieldCharacters) {
      return invalidCatalog('캐릭터 label은 1자 이상 128자 이하여야 합니다.')
    }
    if (ids.has(id)) {
      return invalidCatalog(`중복된 캐릭터 ID가 있습니다: ${id}`)
    }
    ids.add(id)

    return { id, label, originalIndex }
  })

  options.sort((left, right) =>
    compareText(left.label, right.label) ||
    compareText(left.id, right.id) ||
    left.originalIndex - right.originalIndex,
  )

  return Object.freeze(
    options.map(({ id, label }) => Object.freeze({ id, label })),
  )
}

export function parseCustomPrskCatalogManifest(
  value: unknown,
): readonly PrskRemoteCharacterOption[] {
  if (!isRecord(value)) {
    return invalidCatalog('custom catalog JSON은 object여야 합니다.')
  }
  if (value.version !== 1) {
    throw new PrskRemoteError(
      'REMOTE_CATALOG_VERSION_UNSUPPORTED',
      '지원하지 않는 catalog version입니다. 숫자 version 1이 필요합니다.',
      { resource: 'catalog' },
    )
  }
  if (!Array.isArray(value.characters)) {
    return invalidCatalog('custom catalog에는 characters 배열이 필요합니다.')
  }

  return normalizePrskRemoteCharacterOptions(value.characters)
}

const PRSK_CHIBI_VIEWER_MAIN_BUNDLE_PATH =
  /^\/static\/js\/main\.[0-9a-f]{8}\.js$/
const PRSK_CHIBI_VIEWER_ID = /^sd_[A-Za-z0-9][A-Za-z0-9_.-]{0,124}$/
const RAW_VIEWER_OPTION =
  /\{"value":"([^"\\]*)","label":"([^"\\]*)"\}/g
const ESCAPED_VIEWER_OPTION =
  /\{\\"value\\":\\"([^"\\]*)\\",\\"label\\":\\"([^"\\]*)\\"\}/g

function parseUrl(value: string, baseUrl?: string): URL {
  try {
    return new URL(value, baseUrl)
  } catch (error) {
    throw new PrskRemoteError(
      'REMOTE_CATALOG_ORIGIN_INVALID',
      'prsk-chibi-viewer bundle URL이 올바르지 않습니다.',
      { cause: error, resource: 'catalog', url: value },
    )
  }
}

export function resolvePrskChibiViewerBundleUrl(
  html: string,
  catalogUrl: string,
): string {
  const pageUrl = parseUrl(catalogUrl)
  const document = new DOMParser().parseFromString(html, 'text/html')
  const candidates = Array.from(document.querySelectorAll('script[src]'))
    .map((script) => {
      const source = script.getAttribute('src') ?? ''
      return { source, url: parseUrl(source, pageUrl.href) }
    })
    .filter(({ url }) => PRSK_CHIBI_VIEWER_MAIN_BUNDLE_PATH.test(url.pathname))

  if (candidates.length !== 1) {
    return invalidCatalog(
      'prsk-chibi-viewer HTML에는 안전한 main bundle script가 정확히 하나 있어야 합니다.',
    )
  }

  const candidate = candidates[0]
  if (
    !candidate ||
    candidate.url.protocol !== 'https:' ||
    candidate.url.origin !== pageUrl.origin ||
    candidate.url.username ||
    candidate.url.password ||
    candidate.url.search ||
    candidate.url.hash
  ) {
    throw new PrskRemoteError(
      'REMOTE_CATALOG_ORIGIN_INVALID',
      'prsk-chibi-viewer main bundle은 catalog와 같은 HTTPS origin이어야 합니다.',
      {
        resource: 'catalog',
        url: candidate?.source,
      },
    )
  }

  return candidate.url.href
}

export function parsePrskChibiViewerCatalogBundle(
  source: string,
): readonly PrskRemoteCharacterOption[] {
  const candidates = new Map<string, string>()

  const addMatches = (pattern: RegExp) => {
    pattern.lastIndex = 0
    for (const match of source.matchAll(pattern)) {
      const id = match[1] ?? ''
      const label = match[2] ?? ''
      if (!PRSK_CHIBI_VIEWER_ID.test(id)) {
        continue
      }
      if (label !== id) {
        return invalidCatalog(
          `prsk-chibi-viewer bundle의 label은 ID와 일치해야 합니다: ${id}`,
        )
      }

      const previousLabel = candidates.get(id)
      if (previousLabel !== undefined) {
        if (previousLabel !== label) {
          return invalidCatalog(
            `prsk-chibi-viewer bundle에 label이 다른 중복 ID가 있습니다: ${id}`,
          )
        }
        continue
      }
      if (candidates.size >= PRSK_REMOTE_LIMITS.catalogOptions) {
        throw new PrskRemoteError(
          'REMOTE_CATALOG_ENTRY_LIMIT_EXCEEDED',
          `원격 catalog는 캐릭터를 최대 ${PRSK_REMOTE_LIMITS.catalogOptions}개까지 포함할 수 있습니다.`,
          { resource: 'catalog' },
        )
      }
      candidates.set(id, label)
    }
  }

  addMatches(RAW_VIEWER_OPTION)
  addMatches(ESCAPED_VIEWER_OPTION)

  return normalizePrskRemoteCharacterOptions(
    Array.from(candidates, ([id, label]) => ({ id, label })),
  )
}
