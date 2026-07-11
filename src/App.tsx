import { useState } from 'react'

import { I18nProvider, LocaleSelector, useI18n } from './i18n'
import {
  GAME_SOURCES,
  getAvailableGameSource,
  type GameSourceId,
} from './features/gameSources'

export function AppContent() {
  const { t } = useI18n()
  const [selectedGameId, setSelectedGameId] = useState<GameSourceId>('prsk')
  const selectedGame = getAvailableGameSource(selectedGameId)
  const Integration = selectedGame?.integration

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">{t('app.eyebrow')}</p>
          <h1>LiveSD Pet Builder</h1>
          <p className="app-header__summary">
            {t('app.summary')}
          </p>
        </div>
        <div className="app-header__actions">
          <LocaleSelector />
          <span className="compatibility-badge">{t('app.compatibility')}</span>
        </div>
      </header>

      <nav className="game-source-tabs" aria-label={t('app.gameSelection')}>
        <div role="tablist" aria-label={t('app.gameList')}>
          {GAME_SOURCES.map((game) => {
            const available = game.status === 'available'
            const selected = game.id === selectedGameId
            return (
              <button
                aria-controls={available ? `game-panel-${game.id}` : undefined}
                aria-disabled={!available}
                aria-selected={selected}
                disabled={!available}
                id={`game-tab-${game.id}`}
                key={game.id}
                onClick={() => {
                  if (available) {
                    setSelectedGameId(game.id)
                  }
                }}
                role="tab"
                type="button"
              >
                <span>{t(game.labelKey)}</span>
                {!available ? <small>{t('app.comingSoon')}</small> : null}
              </button>
            )
          })}
        </div>
      </nav>

      {Integration ? (
        <section
          aria-labelledby={`game-tab-${selectedGame.id}`}
          id={`game-panel-${selectedGame.id}`}
          role="tabpanel"
        >
          <Integration />
        </section>
      ) : null}
    </main>
  )
}

export function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
