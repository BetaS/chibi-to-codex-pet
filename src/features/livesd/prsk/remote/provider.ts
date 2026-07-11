import { PrskRemoteError } from './errors'
import {
  PJSEK_AI_ASSET_BASE_URL,
  PRSK_CHIBI_VIEWER_CATALOG_URL,
  type PrskRemoteProviderConfig,
  type PrskRemoteProviderSelection,
} from './types'

export interface ValidatePrskAssetBaseUrlOptions {
  readonly development?: boolean
}

const IPV4_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/

function parseIpv4(hostname: string): readonly number[] | null {
  if (!IPV4_LITERAL.test(hostname)) {
    return null
  }

  const octets = hostname.split('.').map(Number)
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return null
  }

  return octets
}

function parseIpv6(hostname: string): readonly number[] | null {
  const unwrapped = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

  if (!unwrapped.includes(':') || unwrapped.includes('%')) {
    return null
  }

  let source = unwrapped.toLocaleLowerCase('en-US')
  const ipv4TailMatch = source.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (ipv4TailMatch) {
    const ipv4 = parseIpv4(ipv4TailMatch[1] ?? '')
    if (!ipv4) {
      return null
    }
    const high = ((ipv4[0] ?? 0) << 8) | (ipv4[1] ?? 0)
    const low = ((ipv4[2] ?? 0) << 8) | (ipv4[3] ?? 0)
    source = source.slice(0, -(ipv4TailMatch[1]?.length ?? 0)) +
      `${high.toString(16)}:${low.toString(16)}`
  }

  if ((source.match(/::/g) ?? []).length > 1) {
    return null
  }

  const [leftSource, rightSource] = source.split('::')
  const left = leftSource ? leftSource.split(':') : []
  const right = rightSource ? rightSource.split(':') : []
  const hasCompression = source.includes('::')
  const missing = 8 - left.length - right.length

  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 1)) {
    return null
  }

  const segments = [
    ...left,
    ...Array.from({ length: hasCompression ? missing : 0 }, () => '0'),
    ...right,
  ]
  if (
    segments.length !== 8 ||
    segments.some((segment) => !/^[0-9a-f]{1,4}$/.test(segment))
  ) {
    return null
  }

  return segments.map((segment) => Number.parseInt(segment, 16))
}

function isRestrictedIpv4(octets: readonly number[]): boolean {
  const first = octets[0] ?? -1
  const second = octets[1] ?? -1
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isRestrictedIpv6(segments: readonly number[]): boolean {
  const first = segments[0] ?? 0
  const isUnspecified = segments.every((segment) => segment === 0)
  const isLoopback =
    segments.slice(0, 7).every((segment) => segment === 0) &&
    segments[7] === 1
  const isUniqueLocal = (first & 0xfe00) === 0xfc00
  const isLinkLocal = (first & 0xffc0) === 0xfe80
  const embeddedIpv4 = [
    ((segments[6] ?? 0) >> 8) & 0xff,
    (segments[6] ?? 0) & 0xff,
    ((segments[7] ?? 0) >> 8) & 0xff,
    (segments[7] ?? 0) & 0xff,
  ]
  const isMappedIpv4 =
    segments.slice(0, 5).every((segment) => segment === 0) &&
    (segments[5] === 0 || segments[5] === 0xffff) &&
    isRestrictedIpv4(embeddedIpv4)

  return isUnspecified || isLoopback || isUniqueLocal || isLinkLocal || isMappedIpv4
}

function isRestrictedHost(hostname: string): boolean {
  const normalized = hostname
    .toLocaleLowerCase('en-US')
    .replace(/\.$/, '')
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === 'local' ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  const ipv4 = parseIpv4(normalized)
  if (ipv4) {
    return isRestrictedIpv4(ipv4)
  }

  const ipv6 = parseIpv6(normalized)
  return ipv6 ? isRestrictedIpv6(ipv6) : false
}

function isDevelopmentLoopback(hostname: string): boolean {
  const normalized = hostname.toLocaleLowerCase('en-US')
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]'
  )
}

function invalidUrl(message: string, cause?: unknown): never {
  throw new PrskRemoteError(
    'REMOTE_ASSET_URL_INVALID',
    message,
    cause === undefined ? {} : { cause },
  )
}

export function validatePrskAssetBaseUrl(
  rawUrl: string,
  options: ValidatePrskAssetBaseUrlOptions = {},
): string {
  const trimmedUrl = rawUrl.trim()
  let url: URL
  try {
    url = new URL(trimmedUrl)
  } catch (error) {
    return invalidUrl('유효한 리소스 서버 URL을 입력하세요.', error)
  }

  if (url.username || url.password) {
    return invalidUrl('리소스 서버 URL에는 사용자 정보나 비밀번호를 넣을 수 없습니다.')
  }
  if (
    url.search ||
    url.hash ||
    trimmedUrl.includes('?') ||
    trimmedUrl.includes('#')
  ) {
    return invalidUrl('리소스 서버 URL에는 query 또는 fragment를 넣을 수 없습니다.')
  }

  const development = options.development ?? import.meta.env.DEV
  const developmentHttp =
    development &&
    url.protocol === 'http:' &&
    isDevelopmentLoopback(url.hostname)
  if (url.protocol !== 'https:' && !developmentHttp) {
    return invalidUrl(
      '리소스 서버는 HTTPS여야 합니다. 개발 환경에서는 localhost, 127.0.0.1, [::1]의 HTTP만 허용됩니다.',
    )
  }

  if (isRestrictedHost(url.hostname)) {
    const allowedDevelopmentLoopback =
      development && isDevelopmentLoopback(url.hostname)
    if (!allowedDevelopmentLoopback) {
      return invalidUrl('로컬, 사설 또는 link-local 주소는 리소스 서버로 사용할 수 없습니다.')
    }
  }

  const pathname = url.pathname === '/'
    ? ''
    : url.pathname.replace(/\/+$/, '')
  return `${url.origin}${pathname}`
}

function requestOrigins(catalogUrl: string, assetBaseUrl: string): readonly string[] {
  return Object.freeze([
    ...new Set([new URL(catalogUrl).origin, new URL(assetBaseUrl).origin]),
  ])
}

export function resolvePrskRemoteProvider(
  selection: PrskRemoteProviderSelection,
  options: ValidatePrskAssetBaseUrlOptions = {},
): PrskRemoteProviderConfig {
  if (selection.kind === 'prsk-chibi-viewer') {
    return Object.freeze({
      kind: 'prsk-chibi-viewer' as const,
      providerLabel: 'prsk-chibi-viewer snapshot',
      assetBaseUrl: PJSEK_AI_ASSET_BASE_URL,
      catalogUrl: PRSK_CHIBI_VIEWER_CATALOG_URL,
      requestOrigins: requestOrigins(
        PRSK_CHIBI_VIEWER_CATALOG_URL,
        PJSEK_AI_ASSET_BASE_URL,
      ),
    })
  }

  const assetBaseUrl = validatePrskAssetBaseUrl(
    selection.assetBaseUrl,
    options,
  )
  const catalogUrl = `${assetBaseUrl}/catalog.json`
  if (new URL(catalogUrl).origin !== new URL(assetBaseUrl).origin) {
    throw new PrskRemoteError(
      'REMOTE_CATALOG_ORIGIN_INVALID',
      'custom catalog는 asset base와 같은 origin이어야 합니다.',
      { url: catalogUrl },
    )
  }

  return Object.freeze({
    kind: 'custom' as const,
    providerLabel: 'Custom',
    assetBaseUrl,
    catalogUrl,
    requestOrigins: requestOrigins(catalogUrl, assetBaseUrl),
  })
}

export function assertPrskRemoteProviderConfig(
  provider: PrskRemoteProviderConfig,
): void {
  const invalidProvider = () => {
    throw new PrskRemoteError(
      'REMOTE_CATALOG_ORIGIN_INVALID',
      '원격 provider의 catalog 및 asset origin 설정이 올바르지 않습니다.',
      { url: provider.catalogUrl },
    )
  }

  if (provider.kind === 'prsk-chibi-viewer') {
    const expectedOrigins = [
      'https://prsk-chibi-viewer.vercel.app',
      'https://assets.pjsek.ai',
    ]
    if (
      provider.assetBaseUrl !== PJSEK_AI_ASSET_BASE_URL ||
      provider.catalogUrl !== PRSK_CHIBI_VIEWER_CATALOG_URL ||
      provider.requestOrigins.length !== expectedOrigins.length ||
      provider.requestOrigins.some(
        (origin, index) => origin !== expectedOrigins[index],
      )
    ) {
      throw new PrskRemoteError(
        'REMOTE_CATALOG_ORIGIN_INVALID',
        'prsk-chibi-viewer preset은 고정된 viewer 및 asset origin만 사용할 수 있습니다.',
        { url: provider.catalogUrl },
      )
    }
    return
  }

  let expectedCatalogUrl: string
  let expectedOrigin: string
  let catalogOrigin: string
  let normalizedAssetBaseUrl: string
  try {
    normalizedAssetBaseUrl = validatePrskAssetBaseUrl(provider.assetBaseUrl)
    expectedCatalogUrl = `${provider.assetBaseUrl}/catalog.json`
    expectedOrigin = new URL(provider.assetBaseUrl).origin
    catalogOrigin = new URL(provider.catalogUrl).origin
  } catch (error) {
    if (error instanceof PrskRemoteError) {
      throw error
    }
    return invalidProvider()
  }
  if (normalizedAssetBaseUrl !== provider.assetBaseUrl) {
    throw new PrskRemoteError(
      'REMOTE_ASSET_URL_INVALID',
      'asset base URL은 정규화된 canonical URL이어야 합니다.',
      { url: provider.assetBaseUrl },
    )
  }
  if (
    provider.catalogUrl !== expectedCatalogUrl ||
    catalogOrigin !== expectedOrigin ||
    provider.requestOrigins.length !== 1 ||
    provider.requestOrigins[0] !== expectedOrigin
  ) {
    throw new PrskRemoteError(
      'REMOTE_CATALOG_ORIGIN_INVALID',
      'custom catalog는 asset base 아래의 catalog.json이어야 합니다.',
      { url: provider.catalogUrl },
    )
  }
}
