import { describe, expect, it, vi } from 'vitest'

import {
  APP_LOCALE_STORAGE_KEY,
  normalizeAppLocale,
  readStoredAppLocale,
  resolveBrowserLocale,
  resolveInitialAppLocale,
  writeStoredAppLocale,
  type LocaleStorage,
} from './locale'

describe('App locale resolution', () => {
  it.each([
    ['ko-KR', 'ko'],
    ['en_GB', 'en'],
    ['ja-JP', 'ja'],
    ['zh-Hant-TW', 'zh-CN'],
    ['fr-FR', null],
  ] as const)('%s를 %s로 정규화한다', (input, expected) => {
    expect(normalizeAppLocale(input)).toBe(expected)
  })

  it('browser 우선순위의 첫 지원 locale을 사용하고 미지원 언어는 영어로 fallback한다', () => {
    expect(resolveBrowserLocale(['fr-FR', 'ja-JP', 'en-US'])).toBe('ja')
    expect(resolveBrowserLocale(['fr-FR', 'de-DE'], 'es-ES')).toBe('en')
  })

  it('유효한 저장값을 browser locale보다 우선한다', () => {
    const storage: LocaleStorage = {
      getItem: vi.fn(() => 'en'),
      setItem: vi.fn(),
    }
    expect(resolveInitialAppLocale({
      browserLanguages: ['ja-JP'],
      storage,
    })).toBe('en')
    expect(storage.getItem).toHaveBeenCalledWith(APP_LOCALE_STORAGE_KEY)
  })

  it('손상·차단된 storage를 무시하고 page 선택은 계속 적용한다', () => {
    const blocked: LocaleStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('blocked')
      }),
      setItem: vi.fn(() => {
        throw new DOMException('blocked')
      }),
    }
    expect(readStoredAppLocale(blocked)).toBeNull()
    expect(resolveInitialAppLocale({
      browserLanguages: ['ko-KR'],
      storage: blocked,
    })).toBe('ko')
    expect(writeStoredAppLocale(blocked, 'ja')).toBe(false)
  })
})
