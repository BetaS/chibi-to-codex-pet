import { useI18n } from './I18nContext'
import { LOCALE_OPTIONS } from './localeOptions'

export function LocaleSelector() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      aria-label={t('locale.selectorLabel')}
      className="locale-selector"
      role="group"
    >
      {LOCALE_OPTIONS.map((option) => (
        <button
          aria-label={option.nativeName}
          aria-pressed={locale === option.locale}
          className="locale-selector__option"
          key={option.locale}
          lang={option.locale}
          onClick={() => setLocale(option.locale)}
          title={option.nativeName}
          type="button"
        >
          <span aria-hidden="true">{option.flag}</span>
        </button>
      ))}
    </div>
  )
}
