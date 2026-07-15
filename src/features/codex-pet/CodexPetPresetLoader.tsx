import { useI18n } from '../../i18n'
import type { CodexPetSettingsPresetCatalog } from './settingsPresets'

export interface CodexPetPresetLoaderProps {
  readonly busy?: boolean
  readonly catalog: CodexPetSettingsPresetCatalog
  readonly description: string
  readonly onLoad: () => void
  readonly onSelectionChange: (presetName: string | null) => void
  readonly selectedPresetName: string | null
  readonly selectorTestId: string
}

export function CodexPetPresetLoader({
  busy = false,
  catalog,
  description,
  onLoad,
  onSelectionChange,
  selectedPresetName,
  selectorTestId,
}: CodexPetPresetLoaderProps) {
  const { t } = useI18n()

  return (
    <section
      className="panel-section preset-selection-section"
      data-provider-capability="preset-restoration"
    >
      <div className="step-heading">
        <span>00</span>
        <div>
          <h2>{t('builder.preset')}</h2>
          <p>{description}</p>
        </div>
      </div>
      <label className="codex-pet-preset-selector resource-preset-selector">
        <span>{t('builder.preset')}</span>
        <select
          data-testid={selectorTestId}
          onChange={(event) =>
            onSelectionChange(event.target.value || null)
          }
          value={selectedPresetName ?? ''}
        >
          <option value="">{t('builder.newSession')}</option>
          {Object.keys(catalog.presets).map((presetName) => (
            <option key={presetName} value={presetName}>
              {presetName}
            </option>
          ))}
        </select>
      </label>
      <div className="remote-actions preset-load-actions">
        <button
          className="primary-action primary-action--compact"
          disabled={busy || selectedPresetName === null}
          onClick={onLoad}
          type="button"
        >
          {t('builder.loadPreset')}
        </button>
        {selectedPresetName !== null ? (
          <button
            className="secondary-action"
            onClick={() => onSelectionChange(null)}
            type="button"
          >
            {t('builder.createNew')}
          </button>
        ) : null}
      </div>
    </section>
  )
}
