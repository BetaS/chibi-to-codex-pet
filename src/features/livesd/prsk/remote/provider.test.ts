import { describe, expect, it } from 'vitest'

import {
  assertPrskRemoteProviderConfig,
  resolvePrskRemoteProvider,
  validatePrskAssetBaseUrl,
} from './provider'
import {
  PJSEK_AI_ASSET_BASE_URL,
  PRSK_CHIBI_VIEWER_CATALOG_URL,
  type PrskRemoteProviderConfig,
} from './types'

describe('PRSK remote provider resolver', () => {
  it('public HTTPS URL을 정규화하고 custom catalog를 같은 base에 고정한다', () => {
    expect(
      validatePrskAssetBaseUrl(' https://EXAMPLE.com:443/assets/area_sd/// ', {
        development: false,
      }),
    ).toBe('https://example.com/assets/area_sd')

    const provider = resolvePrskRemoteProvider(
      { kind: 'custom', assetBaseUrl: 'https://example.com/area_sd/' },
      { development: false },
    )
    expect(provider).toMatchObject({
      kind: 'custom',
      assetBaseUrl: 'https://example.com/area_sd',
      catalogUrl: 'https://example.com/area_sd/catalog.json',
      requestOrigins: ['https://example.com'],
    })
  })

  it('prsk-chibi-viewer preset을 고정 viewer와 asset 설정으로만 해석한다', () => {
    const provider = resolvePrskRemoteProvider({ kind: 'prsk-chibi-viewer' })
    expect(provider).toEqual({
      kind: 'prsk-chibi-viewer',
      providerLabel: 'prsk-chibi-viewer snapshot',
      assetBaseUrl: PJSEK_AI_ASSET_BASE_URL,
      catalogUrl: PRSK_CHIBI_VIEWER_CATALOG_URL,
      requestOrigins: [
        'https://prsk-chibi-viewer.vercel.app',
        'https://assets.pjsek.ai',
      ],
    })
  })

  it.each([
    'http://example.com/area_sd',
    'https://user:secret@example.com/area_sd',
    'https://example.com/area_sd?token=secret',
    'https://example.com/area_sd?',
    'https://example.com/area_sd#fragment',
    'https://example.com/area_sd#',
    'https://localhost/area_sd',
    'https://localhost./area_sd',
    'https://foo.localhost/area_sd',
    'https://local/area_sd',
    'https://asset.local/area_sd',
    'https://asset.local./area_sd',
    'https://127.0.0.2/area_sd',
    'https://10.0.0.1/area_sd',
    'https://172.16.0.1/area_sd',
    'https://192.168.0.1/area_sd',
    'https://169.254.0.1/area_sd',
    'https://[fc00::1]/area_sd',
    'https://[fe80::1]/area_sd',
    'https://[::1]/area_sd',
  ])('production에서 금지 URL %s를 거부한다', (url) => {
    expect(() =>
      validatePrskAssetBaseUrl(url, { development: false }),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_ASSET_URL_INVALID' }),
    )
  })

  it.each([
    'http://localhost:4173/area_sd',
    'http://127.0.0.1:4173/area_sd',
    'http://[::1]:4173/area_sd',
  ])('development에서 명시적 loopback HTTP %s를 허용한다', (url) => {
    expect(
      validatePrskAssetBaseUrl(url, { development: true }),
    ).toBe(url)
  })

  it('development에서도 다른 localhost 계열과 private HTTP를 거부한다', () => {
    for (const url of [
      'http://foo.localhost/area_sd',
      'http://127.0.0.2/area_sd',
      'http://192.168.0.1/area_sd',
    ]) {
      expect(() =>
        validatePrskAssetBaseUrl(url, { development: true }),
      ).toThrowError(
        expect.objectContaining({ code: 'REMOTE_ASSET_URL_INVALID' }),
      )
    }
  })

  it('preset 뒤 편집 입력은 custom resolver를 통해 viewer 연결을 제거한다', () => {
    const preset = resolvePrskRemoteProvider({ kind: 'prsk-chibi-viewer' })
    const edited = resolvePrskRemoteProvider(
      { kind: 'custom', assetBaseUrl: preset.assetBaseUrl },
      { development: false },
    )
    expect(edited.kind).toBe('custom')
    expect(edited.catalogUrl).toBe(`${PJSEK_AI_ASSET_BASE_URL}/catalog.json`)
  })

  it('조작된 custom 및 preset catalog origin 설정을 거부한다', () => {
    const custom = {
      ...resolvePrskRemoteProvider(
        { kind: 'custom', assetBaseUrl: 'https://example.com/area_sd' },
        { development: false },
      ),
      catalogUrl: 'https://evil.example/catalog.json',
    } as PrskRemoteProviderConfig
    expect(() => assertPrskRemoteProviderConfig(custom)).toThrowError(
      expect.objectContaining({ code: 'REMOTE_CATALOG_ORIGIN_INVALID' }),
    )

    const preset = {
      ...resolvePrskRemoteProvider({ kind: 'prsk-chibi-viewer' }),
      catalogUrl: 'https://evil.example/assets',
    } as PrskRemoteProviderConfig
    expect(() => assertPrskRemoteProviderConfig(preset)).toThrowError(
      expect.objectContaining({ code: 'REMOTE_CATALOG_ORIGIN_INVALID' }),
    )
  })
})
