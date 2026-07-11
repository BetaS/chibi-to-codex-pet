import { describe, expect, it } from 'vitest'

import {
  normalizePrskRemoteCharacterOptions,
  parsePrskChibiViewerCatalogBundle,
  parseCustomPrskCatalogManifest,
  resolvePrskChibiViewerBundleUrl,
} from './catalogParsers'
import { PRSK_REMOTE_LIMITS } from './types'

describe('custom PRSK remote catalog parser', () => {
  it('version 1 manifest를 label, ID 순으로 안정적으로 정렬한다', () => {
    expect(
      parseCustomPrskCatalogManifest({
        version: 1,
        characters: [
          { id: 'z', label: 'Beta' },
          { id: 'b', label: 'Alpha' },
          { id: 'a', label: 'Alpha' },
        ],
      }),
    ).toEqual([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Alpha' },
      { id: 'z', label: 'Beta' },
    ])
  })

  it('지원하지 않는 version과 잘못된 schema를 구분한다', () => {
    expect(() =>
      parseCustomPrskCatalogManifest({ version: 2, characters: [] }),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_CATALOG_VERSION_UNSUPPORTED' }),
    )
    expect(() =>
      parseCustomPrskCatalogManifest({ version: 1, characters: null }),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_CATALOG_INVALID' }),
    )
  })

  it.each([
    '',
    '_starts_with_symbol',
    'contains/slash',
    'contains\\backslash',
    'contains space',
    '한글',
    `a${'b'.repeat(PRSK_REMOTE_LIMITS.fieldCharacters)}`,
  ])('유효하지 않은 ID %j를 거부한다', (id) => {
    expect(() =>
      normalizePrskRemoteCharacterOptions([{ id, label: 'label' }]),
    ).toThrowError(expect.objectContaining({ code: 'REMOTE_CATALOG_INVALID' }))
  })

  it('ID와 label의 정확한 128자 상한을 허용하고 초과 label을 거부한다', () => {
    const id = `a${'b'.repeat(PRSK_REMOTE_LIMITS.fieldCharacters - 1)}`
    const label = '가'.repeat(PRSK_REMOTE_LIMITS.fieldCharacters)
    expect(normalizePrskRemoteCharacterOptions([{ id, label }])).toEqual([
      { id, label },
    ])
    expect(() =>
      normalizePrskRemoteCharacterOptions([
        { id: 'valid', label: `${label}가` },
      ]),
    ).toThrowError(expect.objectContaining({ code: 'REMOTE_CATALOG_INVALID' }))
  })

  it('빈 label과 중복 ID를 거부한다', () => {
    expect(() =>
      normalizePrskRemoteCharacterOptions([{ id: 'valid', label: '' }]),
    ).toThrowError(expect.objectContaining({ code: 'REMOTE_CATALOG_INVALID' }))
    expect(() =>
      normalizePrskRemoteCharacterOptions([
        { id: 'same', label: 'A' },
        { id: 'same', label: 'B' },
      ]),
    ).toThrowError(expect.objectContaining({ code: 'REMOTE_CATALOG_INVALID' }))
  })

  it('빈 목록을 parser 결과로 보존하고 1,000개 경계를 적용한다', () => {
    expect(
      parseCustomPrskCatalogManifest({ version: 1, characters: [] }),
    ).toEqual([])

    const exact = Array.from(
      { length: PRSK_REMOTE_LIMITS.catalogOptions },
      (_, index) => ({ id: `character_${index}`, label: `Character ${index}` }),
    )
    expect(normalizePrskRemoteCharacterOptions(exact)).toHaveLength(
      PRSK_REMOTE_LIMITS.catalogOptions,
    )
    expect(() =>
      normalizePrskRemoteCharacterOptions([
        ...exact,
        { id: 'overflow', label: 'Overflow' },
      ]),
    ).toThrowError(
      expect.objectContaining({
        code: 'REMOTE_CATALOG_ENTRY_LIMIT_EXCEEDED',
      }),
    )
  })
})

describe('prsk-chibi-viewer catalog parser', () => {
  const pageUrl = 'https://prsk-chibi-viewer.vercel.app/'

  it('HTML에서 정확히 하나인 same-origin main hash bundle URL을 해석한다', () => {
    expect(
      resolvePrskChibiViewerBundleUrl(
        '<script src="/runtime.js"></script><script defer src="/static/js/main.8ca0b7b5.js"></script>',
        pageUrl,
      ),
    ).toBe('https://prsk-chibi-viewer.vercel.app/static/js/main.8ca0b7b5.js')
  })

  it.each([
    '',
    '<script src="/static/js/main.8ca0b7b5.js"></script><script src="/static/js/main.abcdef12.js"></script>',
  ])('main bundle이 없거나 여러 개인 HTML을 거부한다', (html) => {
    expect(() => resolvePrskChibiViewerBundleUrl(html, pageUrl)).toThrowError(
      expect.objectContaining({ code: 'REMOTE_CATALOG_INVALID' }),
    )
  })

  it.each([
    'https://evil.example/static/js/main.8ca0b7b5.js',
    '/static/js/main.8ca0b7b5.js?token=secret',
    '/static/js/main.8ca0b7b5.js#fragment',
  ])('origin, query 또는 fragment가 안전하지 않은 main bundle %s를 거부한다', (src) => {
    expect(() =>
      resolvePrskChibiViewerBundleUrl(
        `<script src="${src}"></script>`,
        pageUrl,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_CATALOG_ORIGIN_INVALID' }),
    )
  })

  it('raw 및 escaped strict pair만 읽고 sd_ 외 항목은 제외하며 ID를 dedupe한다', () => {
    const source = [
      'JSON.parse(\'[{"value":"base_model","label":"base_model"},',
      '{"value":"sd_z","label":"sd_z"},{"value":"jump","label":"Jump"},',
      '{"value":"sd_z","label":"sd_z"}]\')',
      '{\\"value\\":\\"sd_a\\",\\"label\\":\\"sd_a\\"}',
      '{ "value": "sd_whitespace", "label": "ignored" }',
      '{"label":"wrong-order","value":"sd_wrong_order"}',
    ].join('')

    expect(parsePrskChibiViewerCatalogBundle(source)).toEqual([
      { id: 'sd_a', label: 'sd_a' },
      { id: 'sd_z', label: 'sd_z' },
    ])
  })

  it('ID와 다른 label을 거부한다', () => {
    expect(() =>
      parsePrskChibiViewerCatalogBundle(
        '{"value":"sd_same","label":"Different"}',
      ),
    ).toThrowError(expect.objectContaining({ code: 'REMOTE_CATALOG_INVALID' }))
  })

  it('dedupe 후 1,000개 상한을 적용한다', () => {
    const exact = Array.from(
      { length: PRSK_REMOTE_LIMITS.catalogOptions },
      (_, index) => `{"value":"sd_${index}","label":"sd_${index}"}`,
    ).join('')
    expect(parsePrskChibiViewerCatalogBundle(exact)).toHaveLength(
      PRSK_REMOTE_LIMITS.catalogOptions,
    )
    expect(() =>
      parsePrskChibiViewerCatalogBundle(
        `${exact}{"value":"sd_overflow","label":"sd_overflow"}`,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'REMOTE_CATALOG_ENTRY_LIMIT_EXCEEDED' }),
    )
  })
})
