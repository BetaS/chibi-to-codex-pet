export const APP_LOCALES = ['ko', 'en', 'ja', 'zh-CN'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const APP_LOCALE_STORAGE_KEY = 'chibi-to-codex-pet.locale.v1'
export const APP_LOCALE_FALLBACK: AppLocale = 'en'

export interface LocaleStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ResolveInitialLocaleOptions {
  readonly browserLanguage?: string
  readonly browserLanguages?: readonly string[]
  readonly storage?: LocaleStorage | null
}

export function isAppLocale(value: unknown): value is AppLocale {
  return APP_LOCALES.includes(value as AppLocale)
}

export function normalizeAppLocale(value: unknown): AppLocale | null {
  if (typeof value !== 'string') {
    return null
  }

  const primaryLanguage = value.trim().replaceAll('_', '-').toLowerCase().split('-')[0]
  switch (primaryLanguage) {
    case 'ko':
      return 'ko'
    case 'en':
      return 'en'
    case 'ja':
      return 'ja'
    case 'zh':
      return 'zh-CN'
    default:
      return null
  }
}

export function resolveBrowserLocale(
  browserLanguages: readonly string[] = [],
  browserLanguage?: string,
): AppLocale {
  const candidates = [
    ...browserLanguages,
    ...(browserLanguage && !browserLanguages.includes(browserLanguage)
      ? [browserLanguage]
      : []),
  ]
  for (const candidate of candidates) {
    const locale = normalizeAppLocale(candidate)
    if (locale) {
      return locale
    }
  }
  return APP_LOCALE_FALLBACK
}

export function readStoredAppLocale(
  storage: LocaleStorage | null | undefined,
): AppLocale | null {
  if (!storage) {
    return null
  }
  try {
    const value = storage.getItem(APP_LOCALE_STORAGE_KEY)
    return isAppLocale(value) ? value : null
  } catch {
    return null
  }
}

export function writeStoredAppLocale(
  storage: LocaleStorage | null | undefined,
  locale: AppLocale,
): boolean {
  if (!storage) {
    return false
  }
  try {
    storage.setItem(APP_LOCALE_STORAGE_KEY, locale)
    return true
  } catch {
    return false
  }
}

function defaultStorage(): LocaleStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function defaultBrowserLanguages(): readonly string[] {
  try {
    return typeof navigator === 'undefined' ? [] : navigator.languages
  } catch {
    return []
  }
}

function defaultBrowserLanguage(): string | undefined {
  try {
    return typeof navigator === 'undefined' ? undefined : navigator.language
  } catch {
    return undefined
  }
}

export function resolveInitialAppLocale(
  options: ResolveInitialLocaleOptions = {},
): AppLocale {
  const storage =
    Object.hasOwn(options, 'storage') ? options.storage : defaultStorage()
  const storedLocale = readStoredAppLocale(storage)
  if (storedLocale) {
    return storedLocale
  }

  return resolveBrowserLocale(
    options.browserLanguages ?? defaultBrowserLanguages(),
    options.browserLanguage ?? defaultBrowserLanguage(),
  )
}
