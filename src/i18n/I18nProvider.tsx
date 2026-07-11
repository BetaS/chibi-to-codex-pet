import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import {
  resolveInitialAppLocale,
  writeStoredAppLocale,
  type AppLocale,
  type LocaleStorage,
} from './locale'
import { I18nContext, type I18nContextValue } from './I18nContext'
import { translateMessage } from './messages'

export interface I18nProviderProps extends PropsWithChildren {
  readonly initialLocale?: AppLocale
  readonly storage?: LocaleStorage | null
}

function browserStorage(): LocaleStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function I18nProvider({
  children,
  initialLocale,
  storage,
}: I18nProviderProps) {
  const resolvedStorage =
    storage === undefined ? browserStorage() : storage
  const [locale, setLocaleState] = useState<AppLocale>(() =>
    initialLocale ?? resolveInitialAppLocale({ storage: resolvedStorage }),
  )

  useLayoutEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale)
    writeStoredAppLocale(resolvedStorage, nextLocale)
  }, [resolvedStorage])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key, values) => translateMessage(locale, key, values),
  }), [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
