import { createContext, useContext } from 'react'

import type { AppLocale } from './locale'
import { translateMessage, type MessageKey, type TranslationValues } from './messages'

export interface I18nContextValue {
  readonly locale: AppLocale
  readonly setLocale: (locale: AppLocale) => void
  readonly t: (key: MessageKey, values?: TranslationValues) => string
}

const FALLBACK_CONTEXT: I18nContextValue = {
  locale: 'ko',
  setLocale: () => undefined,
  t: (key, values) => translateMessage('ko', key, values),
}

export const I18nContext = createContext<I18nContextValue>(FALLBACK_CONTEXT)

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
