import { APP_LOCALES, type AppLocale } from './locale'

export interface LocaleOption {
  readonly flag: string
  readonly locale: AppLocale
  readonly nativeName: string
}

export const LOCALE_OPTIONS: readonly LocaleOption[] = Object.freeze([
  { locale: 'ko', flag: '🇰🇷', nativeName: '한국어' },
  { locale: 'en', flag: '🇺🇸', nativeName: 'English' },
  { locale: 'ja', flag: '🇯🇵', nativeName: '日本語' },
  { locale: 'zh-CN', flag: '🇨🇳', nativeName: '简体中文' },
] satisfies readonly LocaleOption[])

if (LOCALE_OPTIONS.some((option, index) => option.locale !== APP_LOCALES[index])) {
  throw new Error('Locale selector options must follow the canonical locale order.')
}
