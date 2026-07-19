import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react'

import {
  trackButtonClick,
  trackCharacterSelection,
  trackModelSelection,
} from '../../../../analytics/ga4'
import { useI18n } from '../../../../i18n'
import { CodexPetPresetLoader } from '../../../codex-pet/CodexPetPresetLoader'
import type { CodexPetSettingsPresetCatalog } from '../../../codex-pet/settingsPresets'
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from '../../ui/SearchableCombobox'
import { toGarupaDiagnostic, type GarupaDiagnostic } from '../errors'
import {
  loadGarupaPinnedCharacterCatalog,
  localizeGarupaCharacterName,
  type GarupaCharacterKind,
  type GarupaPinnedCharacterCatalog,
  type GarupaPinnedCharacterCatalogEntry,
} from '../remote'
import {
  compareGarupaCharacterSectionPlacements,
  garupaCharacterSectionPlacement,
} from './characterSections'
import { GarupaSourceController } from './GarupaSourceController'

const MOB_CHARACTER_GROUP = 'mob'
const UNMAPPED_CHARACTER_GROUP = 'unmapped'

interface GarupaCharacterModelGroup {
  readonly bandId: number | null
  readonly characterId: number | null
  readonly entries: readonly GarupaPinnedCharacterCatalogEntry[]
  readonly key: string
  readonly kind: GarupaCharacterKind
}

export interface GarupaSourcePanelProps {
  readonly controller: GarupaSourceController
  readonly onLoad: () => void
  readonly onPresetLoad: () => void
  readonly onPresetSelectionChange: (presetName: string | null) => void
  readonly presetCatalog: CodexPetSettingsPresetCatalog
  readonly selectedPresetName: string | null
  readonly characterCatalogLoader?: typeof loadGarupaPinnedCharacterCatalog
}

function groupCharacterModels(
  catalog: GarupaPinnedCharacterCatalog | null,
): readonly GarupaCharacterModelGroup[] {
  if (!catalog) return []
  const mapped = new Map<number, GarupaPinnedCharacterCatalogEntry[]>()
  const mob: GarupaPinnedCharacterCatalogEntry[] = []
  const unmapped: GarupaPinnedCharacterCatalogEntry[] = []
  for (const entry of catalog.entries) {
    if (entry.characterKind === 'mob') {
      mob.push(entry)
      continue
    }
    if (entry.characterKind !== 'unique' || entry.characterId === null) {
      unmapped.push(entry)
      continue
    }
    const entries = mapped.get(entry.characterId)
    if (entries) entries.push(entry)
    else mapped.set(entry.characterId, [entry])
  }

  const groups: GarupaCharacterModelGroup[] = [...mapped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([characterId, entries]) => Object.freeze({
      bandId: entries[0]?.bandId ?? null,
      characterId,
      entries: Object.freeze(
        [...entries].sort((left, right) =>
          left.bundleName.localeCompare(right.bundleName, 'en'),
        ),
      ),
      key: `character:${characterId}`,
      kind: 'unique',
    }))
  if (mob.length > 0) {
    groups.push(Object.freeze({
      bandId: null,
      characterId: null,
      entries: Object.freeze(
        [...mob].sort((left, right) =>
          left.bundleName.localeCompare(right.bundleName, 'en'),
        ),
      ),
      key: MOB_CHARACTER_GROUP,
      kind: 'mob',
    }))
  }
  if (unmapped.length > 0) {
    groups.push(Object.freeze({
      bandId: null,
      characterId: null,
      entries: Object.freeze(
        [...unmapped].sort((left, right) =>
          left.bundleName.localeCompare(right.bundleName, 'en'),
        ),
      ),
      key: UNMAPPED_CHARACTER_GROUP,
      kind: 'unmapped',
    }))
  }
  return Object.freeze(groups)
}

function characterGroupKey(
  entry: GarupaPinnedCharacterCatalogEntry,
): string {
  if (entry.characterKind === 'mob') return MOB_CHARACTER_GROUP
  if (entry.characterKind === 'unique' && entry.characterId !== null) {
    return `character:${entry.characterId}`
  }
  return UNMAPPED_CHARACTER_GROUP
}

export function GarupaSourcePanel({
  controller,
  onLoad,
  onPresetLoad,
  onPresetSelectionChange,
  presetCatalog,
  selectedPresetName,
  characterCatalogLoader = loadGarupaPinnedCharacterCatalog,
}: GarupaSourcePanelProps) {
  const { locale, t } = useI18n()
  const catalogRequestRef = useRef<AbortController | null>(null)
  const catalogGenerationRef = useRef(0)
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  )
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [characterCatalog, setCharacterCatalog] =
    useState<GarupaPinnedCharacterCatalog | null>(null)
  const [catalogPhase, setCatalogPhase] =
    useState<'error' | 'idle' | 'loading' | 'ready'>('idle')
  const [catalogDiagnostic, setCatalogDiagnostic] =
    useState<GarupaDiagnostic | null>(null)
  const [selectedCharacterKey, setSelectedCharacterKey] =
    useState<string | null>(null)
  const [selectedBundleName, setSelectedBundleName] =
    useState<string | null>(null)
  const [characterQueryResetKey, setCharacterQueryResetKey] = useState(0)
  const [modelQueryResetKey, setModelQueryResetKey] = useState(0)

  const characterGroups = useMemo(
    () => groupCharacterModels(characterCatalog),
    [characterCatalog],
  )
  const characterOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      characterGroups
        .map((group) => {
          const representative = group.entries[0]
          const localizedName = representative
            ? localizeGarupaCharacterName(representative, locale)
            : null
          const section = garupaCharacterSectionPlacement(group, locale)
          const option = Object.freeze({
            group: section.group,
            label: group.kind === 'mob'
              ? t('garupa.mobCharacters')
              : group.kind === 'unmapped'
                ? t('garupa.unmappedCharacters')
                : localizedName ?? `#${group.characterId}`,
            value: group.key,
          })
          return { option, section }
        })
        .sort((left, right) => {
          const placementOrder = compareGarupaCharacterSectionPlacements(
            left.section,
            right.section,
          )
          if (placementOrder !== 0) return placementOrder
          return left.option.label.localeCompare(right.option.label, locale) ||
            left.option.value.localeCompare(right.option.value, 'en')
        })
        .map(({ option }) => option),
    [characterGroups, locale, t],
  )
  const selectedCharacterGroup = useMemo(
    () => characterGroups.find((group) => group.key === selectedCharacterKey),
    [characterGroups, selectedCharacterKey],
  )
  const modelOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      selectedCharacterGroup?.entries.map((entry) => ({
        label: entry.bundleName,
        value: entry.bundleName,
      })) ?? [],
    [selectedCharacterGroup],
  )

  useEffect(
    () => () => {
      catalogGenerationRef.current += 1
      catalogRequestRef.current?.abort()
      catalogRequestRef.current = null
    },
    [],
  )

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setLocalFile(event.currentTarget.files?.[0] ?? null)
  }

  const loadLocalFile = () => {
    if (!localFile || state.phase === 'loading') return
    trackButtonClick('garupa_local_load')
    setSelectedBundleName(null)
    setModelQueryResetKey((key) => key + 1)
    controller.selectLocal(localFile)
    onLoad()
  }

  const loadCharacterCatalog = async () => {
    if (selectedPresetName !== null) {
      return
    }
    trackButtonClick('garupa_catalog_load')
    catalogRequestRef.current?.abort()
    const request = new AbortController()
    catalogRequestRef.current = request
    const generation = catalogGenerationRef.current + 1
    catalogGenerationRef.current = generation
    setCatalogPhase('loading')
    setCatalogDiagnostic(null)

    try {
      const nextCatalog = await characterCatalogLoader({
        signal: request.signal,
      })
      if (
        request.signal.aborted ||
        catalogGenerationRef.current !== generation ||
        catalogRequestRef.current !== request
      ) {
        return
      }
      setCharacterCatalog(nextCatalog)
      setCatalogPhase('ready')
      setCharacterQueryResetKey((key) => key + 1)
      setModelQueryResetKey((key) => key + 1)

      const selectedEntry = selectedBundleName
        ? nextCatalog.entries.find(
            (entry) => entry.bundleName === selectedBundleName,
          )
        : null
      const selectedEntryKey = selectedEntry
        ? characterGroupKey(selectedEntry)
        : null
      if (
        !selectedEntry ||
        (selectedCharacterKey && selectedEntryKey !== selectedCharacterKey)
      ) {
        setSelectedBundleName(null)
        controller.clearSelection()
      }
      if (
        selectedCharacterKey &&
        !nextCatalog.entries.some(
          (entry) => selectedCharacterKey === characterGroupKey(entry),
        )
      ) {
        setSelectedCharacterKey(null)
      }
    } catch (error) {
      if (
        request.signal.aborted ||
        catalogGenerationRef.current !== generation ||
        catalogRequestRef.current !== request
      ) {
        return
      }
      setCatalogPhase('error')
      setCatalogDiagnostic(toGarupaDiagnostic(error, generation))
    } finally {
      if (catalogRequestRef.current === request) {
        catalogRequestRef.current = null
      }
    }
  }

  const selectCharacter = (characterKey: string) => {
    const selectedGroup = characterGroups.find(
      (group) => group.key === characterKey,
    )
    const analyticsCharacterId = selectedGroup?.characterId?.toString() ??
      selectedGroup?.kind ?? 'unmapped'
    trackCharacterSelection('garupa', analyticsCharacterId, 'pinned')
    setSelectedCharacterKey(characterKey)
    setSelectedBundleName(null)
    setModelQueryResetKey((key) => key + 1)
    controller.clearSelection()
  }

  const selectModel = (bundleName: string) => {
    trackModelSelection('garupa', bundleName, 'pinned')
    setSelectedBundleName(bundleName)
    const selectedEntry = selectedCharacterGroup?.entries.find(
      (entry) => entry.bundleName === bundleName,
    )
    const characterName = selectedEntry
      ? localizeGarupaCharacterName(selectedEntry, locale)
      : null
    controller.selectPinned(
      bundleName,
      characterName ? `${bundleName} - ${characterName}` : bundleName,
    )
    onLoad()
  }

  const statusKey =
    state.phase === 'loading'
      ? 'garupa.status.loading'
      : state.phase === 'ready'
        ? 'garupa.status.ready'
        : state.phase === 'error'
          ? 'garupa.status.error'
          : 'garupa.status.idle'

  return (
    <aside aria-label={t('garupa.modelImport')} className="control-panel">
      <CodexPetPresetLoader
        busy={catalogPhase === 'loading' || state.phase === 'loading'}
        catalog={presetCatalog}
        description={t('garupa.presetDescription')}
        onLoad={onPresetLoad}
        onSelectionChange={onPresetSelectionChange}
        selectedPresetName={selectedPresetName}
        selectorTestId="garupa-resource-preset-selector"
      />

      <section className="panel-section garupa-live-source-section">
        <div className="step-heading">
          <span>01</span>
          <div>
            <h2 id="garupa-source-title">{t('garupa.livePack')}</h2>
            <p>{t('garupa.livePackDescription')}</p>
          </div>
        </div>
        {selectedPresetName === null ? (
          <div className="remote-actions garupa-catalog-actions">
            <button
              className="primary-action primary-action--compact"
              data-provider-capability="catalog-load"
              disabled={
                catalogPhase === 'loading' || state.phase === 'loading'
              }
              onClick={() => void loadCharacterCatalog()}
              type="button"
            >
              {catalogPhase === 'loading'
                ? t('garupa.loadingCharacterList')
                : t('garupa.loadCharacterList')}
            </button>
          </div>
        ) : null}
        <div className="garupa-selector-stack">
          <SearchableCombobox
            disabled={catalogPhase !== 'ready' || state.phase === 'loading'}
            disabledMessage={t('garupa.loadCharacterListFirst')}
            emptyMessage={t('garupa.noCharacters')}
            error={
              catalogDiagnostic
                ? t(catalogDiagnostic.messageKey, catalogDiagnostic.values)
                : null
            }
            id="garupa-character"
            label={t('garupa.character')}
            loading={catalogPhase === 'loading'}
            loadingMessage={t('garupa.loadingCharacterList')}
            onChange={selectCharacter}
            options={characterOptions}
            placeholder={t('garupa.characterSearchPlaceholder')}
            providerCapability="character-selection"
            queryResetKey={characterQueryResetKey}
            value={selectedCharacterKey}
          />
          <SearchableCombobox
            disabled={
              catalogPhase !== 'ready' ||
              !selectedCharacterGroup ||
              state.phase === 'loading'
            }
            disabledMessage={t('garupa.selectCharacterFirst')}
            emptyMessage={t('garupa.noModels')}
            id="garupa-model"
            label={t('garupa.model')}
            loading={state.phase === 'loading'}
            loadingMessage={t('garupa.loading')}
            onChange={selectModel}
            options={modelOptions}
            placeholder={t('garupa.modelSearchPlaceholder')}
            providerCapability="model-selection"
            queryResetKey={modelQueryResetKey}
            value={selectedBundleName}
          />
          {catalogPhase === 'ready' ? (
            <p className="input-hint" aria-live="polite">
              {t('garupa.characterCatalogReady', {
                characters: characterGroups.filter(
                  (group) => group.kind !== 'unmapped',
                ).length,
                models: characterCatalog?.entries.length ?? 0,
              })}
            </p>
          ) : null}
        </div>
      </section>

      <details className="panel-section garupa-advanced-source">
        <summary>
          <span aria-hidden="true">02</span>
          <span>
            <strong>{t('garupa.localAdvanced')}</strong>
            <small>{t('garupa.localAdvancedDescription')}</small>
          </span>
        </summary>
        <div className="garupa-advanced-source__content">
          <label className="file-picker">
            <span>
              {localFile ? t('garupa.fileSelected') : t('garupa.selectZip')}
            </span>
            <strong>{localFile?.name ?? t('garupa.localArchive')}</strong>
            <input
              accept=".zip,application/zip"
              aria-label={t('garupa.selectZip')}
              onChange={selectFile}
              type="file"
            />
          </label>
          <p className="input-hint">{t('garupa.archiveLimits')}</p>
          <button
            className="secondary-action garupa-local-load"
            disabled={!localFile || state.phase === 'loading'}
            onClick={loadLocalFile}
            type="button"
          >
            {state.phase === 'loading' && state.selection?.kind === 'local'
              ? t('garupa.loading')
              : t('garupa.loadLocal')}
          </button>
        </div>
      </details>

      <div
        aria-atomic="true"
        aria-live="polite"
        className={`status-card status-card--${state.phase}`}
        role="status"
      >
        <span aria-hidden="true" className="status-card__dot" />
        <div>
          <strong>
            {state.phase === 'ready'
              ? t('garupa.previewReady')
              : t('garupa.status')}
          </strong>
          <p>{t(statusKey)}</p>
        </div>
      </div>
      {state.diagnostic ? (
        <div
          className="notice notice--error"
          data-code={state.diagnostic.code}
          data-generation={state.diagnostic.generation}
          role="alert"
        >
          <code>{state.diagnostic.code}</code>
          <p>{t(state.diagnostic.messageKey, state.diagnostic.values)}</p>
        </div>
      ) : null}
    </aside>
  )
}
