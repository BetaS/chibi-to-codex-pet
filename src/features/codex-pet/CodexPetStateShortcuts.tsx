import { useI18n } from '../../i18n'
import type { CodexPetAnimationMappings } from './animationMapping'
import { CODEX_PET_STATES, type CodexPetStateId } from './contract'
import { getCodexPetStateCopy } from './stateCopy'

const STATE_SHORTCUT_ICONS: Readonly<Record<CodexPetStateId, string>> = {
  idle: '◉',
  'running-right': '→',
  'running-left': '←',
  waving: '👋',
  jumping: '↑',
  failed: '×',
  waiting: '…',
  running: '⚙',
  review: '⌕',
}

export interface CodexPetStateShortcutsProps {
  readonly activeStateId: CodexPetStateId | null
  readonly disabled?: boolean
  readonly mappings: Readonly<CodexPetAnimationMappings> | null
  readonly onActivate: (
    animationName: string,
    stateId: CodexPetStateId,
    stateMirrorX: boolean,
  ) => void
}

export function CodexPetStateShortcuts({
  activeStateId,
  disabled = false,
  mappings,
  onActivate,
}: CodexPetStateShortcutsProps) {
  const { t } = useI18n()
  const shortcutsDisabled = disabled || !mappings

  return (
    <div className="codex-pet-state-shortcuts">
      <span className="toolbar-label">{t('builder.stateShortcuts')}</span>
      <div
        aria-label={t('builder.stateShortcuts')}
        className="codex-pet-state-shortcuts__buttons"
        role="group"
      >
        {CODEX_PET_STATES.map((state) => {
          const copy = getCodexPetStateCopy(state.id, t)
          const actionLabel = t('builder.stateShortcutAction', {
            state: copy.label,
            description: copy.description,
          })

          return (
            <button
              aria-label={actionLabel}
              aria-pressed={activeStateId === state.id}
              data-state-id={state.id}
              disabled={shortcutsDisabled}
              key={state.id}
              onClick={() => {
                const mapping = mappings?.[state.id]
                if (mapping) {
                  onActivate(
                    mapping.animationName,
                    state.id,
                    mapping.mirrorX,
                  )
                }
              }}
              title={actionLabel}
              type="button"
            >
              <span aria-hidden="true">{STATE_SHORTCUT_ICONS[state.id]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
