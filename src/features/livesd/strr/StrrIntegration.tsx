import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import './strr.css'

import { useI18n } from '../../../i18n'
import {
  resolveCodexPetMirrorX,
  type CodexPetAnimationMappings,
} from '../../codex-pet/animationMapping'
import {
  CodexPetBuilder,
  type CodexPetBuilderSource,
} from '../../codex-pet/CodexPetBuilder'
import { CodexPetPresetLoader } from '../../codex-pet/CodexPetPresetLoader'
import { CodexPetStateShortcuts } from '../../codex-pet/CodexPetStateShortcuts'
import type { CodexPetStateId } from '../../codex-pet/contract'
import { CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT } from '../../codex-pet/lookMovementScale'
import { useCodexPetPresetSession } from '../../codex-pet/useCodexPetPresetSession'
import {
  liveSD36Adapter,
  type LiveSD36AdapterContract,
  type LiveSDPreviewSession,
} from '../adapter'
import {
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  LIVE_SD_FRAMING_OFFSET_STEP,
  LIVE_SD_FRAMING_OFFSET_X_MAX,
  LIVE_SD_FRAMING_OFFSET_X_MIN,
  LIVE_SD_FRAMING_OFFSET_Y_MAX,
  LIVE_SD_FRAMING_OFFSET_Y_MIN,
  type LiveSDFramingOffset,
} from '../rendering/framingOffset'
import {
  LIVE_SD_FRAMING_SCALE_DEFAULT,
  LIVE_SD_FRAMING_SCALE_MAX,
  LIVE_SD_FRAMING_SCALE_MIN,
  LIVE_SD_FRAMING_SCALE_STEP,
} from '../rendering/framingScale'
import {
  normalizeLiveSDLookTarget,
  type LiveSDLookTarget,
} from '../rendering/lookTarget'
import {
  SPINE_36_RUNTIME_LICENSE_URL,
  SPINE_36_RUNTIME_NOTICES_URL,
} from '../runtime/runtimeLoader'
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from '../ui/SearchableCombobox'
import {
  loadStrrCatalog,
  loadStrrModel,
  localizeStrrLabels,
  type LoadStrrCatalogOptions,
  type LoadStrrModelOptions,
} from './staticProvider'
import {
  StrrProviderError,
  type StrrCatalog,
} from './types'

type CatalogPhase = 'error' | 'idle' | 'loading' | 'ready'
type ModelPhase = 'error' | 'idle' | 'loading' | 'ready'

const STRR_DEFAULT_GLOBAL_MIRROR_X = true
const STRR_DEFAULT_STATE_ANIMATION_NAMES = Object.freeze({
  idle: 'wait1',
  jumping: 'surprized1',
  running: 'walk1',
})
const STRR_DEFAULT_STATE_MIRROR_X = Object.freeze({
  'running-right': true,
  'running-left': false,
})

interface StrrPreviewState {
  readonly animations: readonly string[]
  readonly characterId: string
  readonly editionId: string
  readonly session: LiveSDPreviewSession
  readonly source: CodexPetBuilderSource
  readonly version: string
}

export interface StrrIntegrationProps {
  readonly adapter?: LiveSD36AdapterContract
  readonly catalogLoader?: (
    options: LoadStrrCatalogOptions,
  ) => Promise<StrrCatalog>
  readonly modelLoader?: typeof loadStrrModel
}

function errorCode(error: unknown): string {
  return error instanceof StrrProviderError
    ? error.code
    : 'STRR_PREVIEW_FAILED'
}

export function StrrIntegration({
  adapter = liveSD36Adapter,
  catalogLoader = loadStrrCatalog,
  modelLoader = loadStrrModel,
}: StrrIntegrationProps = {}) {
  const { locale, t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewFrameRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<LiveSDPreviewSession | null>(null)
  const mappingsRef = useRef<Readonly<CodexPetAnimationMappings> | null>(null)
  const activeStateIdRef = useRef<CodexPetStateId | null>(null)
  const globalMirrorXRef = useRef(STRR_DEFAULT_GLOBAL_MIRROR_X)
  const lookTargetRef = useRef<LiveSDLookTarget | null>(null)
  const lookMovementScaleRef = useRef(
    CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
  )
  const catalogRequestRef = useRef<AbortController | null>(null)
  const modelRequestRef = useRef<AbortController | null>(null)
  const catalogGenerationRef = useRef(0)
  const modelGenerationRef = useRef(0)

  const [catalog, setCatalog] = useState<StrrCatalog | null>(null)
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>('idle')
  const [modelPhase, setModelPhase] = useState<ModelPhase>('idle')
  const [selectedCharacterId, setSelectedCharacterId] =
    useState<string | null>(null)
  const [selectedEditionId, setSelectedEditionId] =
    useState<string | null>(null)
  const [preview, setPreview] = useState<StrrPreviewState | null>(null)
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null)
  const presetSession = useCodexPetPresetSession('strr')
  const [framingScale, setFramingScale] = useState(
    LIVE_SD_FRAMING_SCALE_DEFAULT,
  )
  const [framingOffset, setFramingOffset] = useState<LiveSDFramingOffset>(
    LIVE_SD_FRAMING_OFFSET_DEFAULT,
  )
  const [codexPetMappings, setCodexPetMappings] =
    useState<Readonly<CodexPetAnimationMappings> | null>(null)
  const [activePreviewStateId, setActivePreviewStateId] =
    useState<CodexPetStateId | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [characterQueryResetKey, setCharacterQueryResetKey] = useState(0)
  const [editionQueryResetKey, setEditionQueryResetKey] = useState(0)
  const [animationQueryResetKey, setAnimationQueryResetKey] = useState(0)

  const resetPreviewControls = useCallback(() => {
    mappingsRef.current = null
    activeStateIdRef.current = null
    globalMirrorXRef.current = STRR_DEFAULT_GLOBAL_MIRROR_X
    lookTargetRef.current = null
    lookMovementScaleRef.current = CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT
    setFramingScale(LIVE_SD_FRAMING_SCALE_DEFAULT)
    setFramingOffset(LIVE_SD_FRAMING_OFFSET_DEFAULT)
    setCodexPetMappings(null)
    setActivePreviewStateId(null)
  }, [])

  const disposePreview = useCallback(() => {
    sessionRef.current?.dispose()
    sessionRef.current = null
  }, [])

  useEffect(
    () => () => {
      catalogGenerationRef.current += 1
      modelGenerationRef.current += 1
      catalogRequestRef.current?.abort()
      modelRequestRef.current?.abort()
      disposePreview()
    },
    [disposePreview],
  )

  useEffect(() => {
    const frame = previewFrameRef.current
    const session = preview?.session
    if (!frame || !session) return

    const resize = () => {
      session.resize(
        Math.max(frame.clientWidth, 1),
        Math.max(frame.clientHeight, 1),
      )
    }
    resize()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize)
      return () => window.removeEventListener('resize', resize)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [preview])

  useEffect(() => {
    if (!preview) return
    return preview.session.onError((previewError) => {
      setError(previewError)
      setModelPhase('error')
      setPreview(null)
      setCurrentAnimation(null)
      resetPreviewControls()
      sessionRef.current = null
    })
  }, [preview, resetPreviewControls])

  const characterOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      catalog?.characters
        .map((character) => ({
          label: localizeStrrLabels(
            character.labels,
            locale,
            `#${character.id}`,
          ),
          value: character.id,
        }))
        .sort((left, right) =>
          left.label.localeCompare(right.label, locale) ||
          left.value.localeCompare(right.value, 'en'),
        ) ?? [],
    [catalog, locale],
  )
  const selectedCharacter = useMemo(
    () => catalog?.characters.find(
      (character) => character.id === selectedCharacterId,
    ) ?? null,
    [catalog, selectedCharacterId],
  )
  const editionOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      selectedCharacter?.editions.map((edition) => ({
        label: `${localizeStrrLabels(
          edition.labels,
          locale,
          `#${edition.id}`,
        )} · ${edition.id}`,
        value: edition.id,
      })) ?? [],
    [locale, selectedCharacter],
  )
  const selectedEdition = useMemo(
    () => selectedCharacter?.editions.find(
      (edition) => edition.id === selectedEditionId,
    ) ?? null,
    [selectedCharacter, selectedEditionId],
  )
  const animationOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      preview?.animations.map((animation) => ({
        label: animation,
        value: animation,
      })) ?? [],
    [preview],
  )

  const selectedCharacterLabel = selectedCharacter
    ? localizeStrrLabels(
        selectedCharacter.labels,
        locale,
        selectedCharacter.id,
      )
    : null
  const selectedEditionLabel = selectedEdition
    ? localizeStrrLabels(
        selectedEdition.labels,
        locale,
        selectedEdition.id,
      )
    : null
  const totalEditions = catalog?.characters.reduce(
    (total, character) => total + character.editions.length,
    0,
  ) ?? 0
  const activePreset = presetSession.appliedCatalog.activePresetName
    ? presetSession.appliedCatalog.presets[
        presetSession.appliedCatalog.activePresetName
      ]
    : null
  const activePresetSource = activePreset?.source?.provider === 'strr-res-pak'
    ? activePreset.source
    : null
  const activePresetSourceKey = activePresetSource
    ? `${activePresetSource.characterId}:${activePresetSource.editionId}`
    : ''
  const activePreviewSourceKey = preview
    ? `${preview.characterId}:${preview.editionId}`
    : ''

  const loadCatalog = async () => {
    if (presetSession.selectedPresetName !== null) {
      return
    }
    catalogRequestRef.current?.abort()
    modelRequestRef.current?.abort()
    disposePreview()
    resetPreviewControls()
    const request = new AbortController()
    catalogRequestRef.current = request
    const generation = catalogGenerationRef.current + 1
    catalogGenerationRef.current = generation
    modelGenerationRef.current += 1

    setCatalog(null)
    setCatalogPhase('loading')
    setModelPhase('idle')
    setSelectedCharacterId(null)
    setSelectedEditionId(null)
    setPreview(null)
    setCurrentAnimation(null)
    setError(null)
    setCharacterQueryResetKey((key) => key + 1)
    setEditionQueryResetKey((key) => key + 1)
    setAnimationQueryResetKey((key) => key + 1)

    try {
      const nextCatalog = await catalogLoader({
        signal: request.signal,
      })
      if (
        request.signal.aborted ||
        catalogGenerationRef.current !== generation
      ) {
        return
      }
      setCatalog(nextCatalog)
      setCatalogPhase('ready')
    } catch (caughtError) {
      if (
        request.signal.aborted ||
        catalogGenerationRef.current !== generation
      ) {
        return
      }
      setError(caughtError)
      setCatalogPhase('error')
    } finally {
      if (catalogRequestRef.current === request) {
        catalogRequestRef.current = null
      }
    }
  }

  const selectCharacter = (characterId: string) => {
    modelRequestRef.current?.abort()
    modelGenerationRef.current += 1
    disposePreview()
    resetPreviewControls()
    setSelectedCharacterId(characterId)
    setSelectedEditionId(null)
    setPreview(null)
    setCurrentAnimation(null)
    setModelPhase('idle')
    setError(null)
    setEditionQueryResetKey((key) => key + 1)
    setAnimationQueryResetKey((key) => key + 1)
  }

  const loadModelForSelection = useCallback(async (
    currentCatalog: StrrCatalog,
    characterId: string,
    editionId: string,
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const currentCharacter = currentCatalog.characters.find(
      (character) => character.id === characterId,
    )
    const currentEdition = currentCharacter?.editions.find(
      (edition) => edition.id === editionId,
    )
    const defaultDisplayName = currentCharacter && currentEdition
      ? `${localizeStrrLabels(
          currentEdition.labels,
          locale,
          currentEdition.id,
        )} - ${localizeStrrLabels(
          currentCharacter.labels,
          locale,
          currentCharacter.id,
        )}`
      : undefined

    modelRequestRef.current?.abort()
    disposePreview()
    resetPreviewControls()
    const request = new AbortController()
    modelRequestRef.current = request
    const generation = modelGenerationRef.current + 1
    modelGenerationRef.current = generation

    setSelectedEditionId(editionId)
    setPreview(null)
    setCurrentAnimation(null)
    setModelPhase('loading')
    setError(null)
    setAnimationQueryResetKey((key) => key + 1)

    let nextSession: LiveSDPreviewSession | null = null
    try {
      const input = await modelLoader({
        catalog: currentCatalog,
        characterId,
        editionId,
        signal: request.signal,
      } satisfies LoadStrrModelOptions)
      if (request.signal.aborted || modelGenerationRef.current !== generation) {
        return
      }
      adapter.inspectSkeleton(input.skeletonData)
      nextSession = await adapter.createPreview({
        atlasBundle: input.atlasBundle,
        canvas,
        lookRigFallback: 'static',
        skeletonData: input.skeletonData,
      })
      if (request.signal.aborted || modelGenerationRef.current !== generation) {
        nextSession.dispose()
        return
      }

      nextSession.setFramingOffset(LIVE_SD_FRAMING_OFFSET_DEFAULT)
      nextSession.setFramingScale(LIVE_SD_FRAMING_SCALE_DEFAULT)
      nextSession.setMirrorX(STRR_DEFAULT_GLOBAL_MIRROR_X)
      sessionRef.current = nextSession
      setPreview({
        animations: Object.freeze([...nextSession.animations]),
        characterId,
        editionId,
        session: nextSession,
        source: Object.freeze({
          atlasBundle: input.atlasBundle,
          defaultDisplayName,
          lookRigFallback: 'static',
          skeletonData: input.skeletonData,
        }),
        version: nextSession.version,
      })
      setCurrentAnimation(nextSession.currentAnimation)
      setModelPhase('ready')
      nextSession = null
    } catch (caughtError) {
      nextSession?.dispose()
      if (request.signal.aborted || modelGenerationRef.current !== generation) {
        return
      }
      setError(caughtError)
      setModelPhase('error')
    } finally {
      if (modelRequestRef.current === request) {
        modelRequestRef.current = null
      }
    }
  }, [adapter, disposePreview, locale, modelLoader, resetPreviewControls])

  const loadModel = async (editionId: string) => {
    const currentCatalog = catalog
    const characterId = selectedCharacterId
    if (!currentCatalog || !characterId) return
    await loadModelForSelection(currentCatalog, characterId, editionId)
  }

  const loadPresetSource = useCallback(async (
    characterId: string,
    editionId: string,
  ) => {
    catalogRequestRef.current?.abort()
    modelRequestRef.current?.abort()
    const request = new AbortController()
    catalogRequestRef.current = request
    const generation = catalogGenerationRef.current + 1
    catalogGenerationRef.current = generation
    modelGenerationRef.current += 1

    setCatalog(null)
    setCatalogPhase('loading')
    setModelPhase('idle')
    setSelectedCharacterId(null)
    setSelectedEditionId(null)
    setError(null)
    setCharacterQueryResetKey((key) => key + 1)
    setEditionQueryResetKey((key) => key + 1)

    try {
      const nextCatalog = await catalogLoader({ signal: request.signal })
      if (
        request.signal.aborted ||
        catalogGenerationRef.current !== generation
      ) {
        return
      }
      setCatalog(nextCatalog)
      setCatalogPhase('ready')
      setSelectedCharacterId(characterId)
      setSelectedEditionId(editionId)
      setCharacterQueryResetKey((key) => key + 1)
      setEditionQueryResetKey((key) => key + 1)
      await loadModelForSelection(nextCatalog, characterId, editionId)
    } catch (caughtError) {
      if (
        request.signal.aborted ||
        catalogGenerationRef.current !== generation
      ) {
        return
      }
      setError(caughtError)
      setCatalogPhase('error')
    } finally {
      if (catalogRequestRef.current === request) {
        catalogRequestRef.current = null
      }
    }
  }, [catalogLoader, loadModelForSelection])

  useEffect(() => {
    if (
      !activePresetSource ||
      !activePresetSourceKey ||
      activePresetSourceKey === activePreviewSourceKey
    ) {
      return
    }
    const loadTimer = window.setTimeout(() => {
      void loadPresetSource(
        activePresetSource.characterId,
        activePresetSource.editionId,
      )
    }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [
    activePresetSource,
    activePresetSourceKey,
    activePreviewSourceKey,
    loadPresetSource,
    presetSession.loadGeneration,
  ])

  const handlePresetSelectionChange = useCallback((
    presetName: string | null,
  ) => {
    if (presetName === null) {
      catalogRequestRef.current?.abort()
      modelRequestRef.current?.abort()
      catalogGenerationRef.current += 1
      modelGenerationRef.current += 1
      setCatalogPhase((current) =>
        current === 'loading' ? (catalog ? 'ready' : 'idle') : current,
      )
      setModelPhase((current) =>
        current === 'loading' ? (preview ? 'ready' : 'idle') : current,
      )
    }
    presetSession.selectPreset(presetName)
  }, [catalog, presetSession, preview])

  const reportPreviewControlError = useCallback((caughtError: unknown) => {
    setError(caughtError)
    setModelPhase('error')
  }, [])

  const playAnimation = useCallback((animationName: string) => {
    try {
      sessionRef.current?.play(animationName)
      setCurrentAnimation(animationName)
      setError(null)
      setModelPhase('ready')
    } catch (caughtError) {
      reportPreviewControlError(caughtError)
    }
  }, [reportPreviewControlError])

  const applyPreviewMirrorX = useCallback((mirrorX: boolean) => {
    const session = sessionRef.current
    if (!session) return

    try {
      session.setMirrorX(mirrorX)
      setError(null)
      setModelPhase('ready')
    } catch (caughtError) {
      reportPreviewControlError(caughtError)
    }
  }, [reportPreviewControlError])

  const handleMappingsChange = useCallback((
    mappings: Readonly<CodexPetAnimationMappings> | null,
  ) => {
    mappingsRef.current = mappings
    setCodexPetMappings(mappings)
    if (mappings && sessionRef.current) {
      try {
        sessionRef.current.setAnimationMappings(mappings)
        setError(null)
        setModelPhase('ready')
      } catch (caughtError) {
        reportPreviewControlError(caughtError)
        return
      }
    }

    const stateId = activeStateIdRef.current
    if (!mappings || !stateId) return
    applyPreviewMirrorX(resolveCodexPetMirrorX(
      globalMirrorXRef.current,
      mappings[stateId].mirrorX,
    ))
  }, [applyPreviewMirrorX, reportPreviewControlError])

  const handleGlobalMirrorXChange = useCallback((globalMirrorX: boolean) => {
    globalMirrorXRef.current = globalMirrorX
    const stateId = activeStateIdRef.current
    const stateMirrorX = stateId
      ? mappingsRef.current?.[stateId].mirrorX ?? false
      : false
    applyPreviewMirrorX(resolveCodexPetMirrorX(
      globalMirrorX,
      stateMirrorX,
    ))
  }, [applyPreviewMirrorX])

  const playDirectAnimation = useCallback((animationName: string) => {
    activeStateIdRef.current = null
    setActivePreviewStateId(null)
    applyPreviewMirrorX(globalMirrorXRef.current)
    playAnimation(animationName)
  }, [applyPreviewMirrorX, playAnimation])

  const playStateAnimation = useCallback((
    animationName: string,
    stateId: CodexPetStateId,
    stateMirrorX: boolean,
  ) => {
    activeStateIdRef.current = stateId
    setActivePreviewStateId(stateId)
    applyPreviewMirrorX(resolveCodexPetMirrorX(
      globalMirrorXRef.current,
      stateMirrorX,
    ))
    playAnimation(animationName)
  }, [applyPreviewMirrorX, playAnimation])

  const applyPreviewLookTarget = useCallback((
    target: LiveSDLookTarget | null,
    movementScale = lookMovementScaleRef.current,
  ) => {
    const session = sessionRef.current
    if (!session) return

    try {
      session.setLookTarget(target, movementScale)
      setError(null)
      setModelPhase('ready')
    } catch (caughtError) {
      reportPreviewControlError(caughtError)
    }
  }, [reportPreviewControlError])

  const handlePreviewPointerMove = useCallback((
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    if (!preview) return

    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    const target = normalizeLiveSDLookTarget(
      (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2),
      (bounds.top + bounds.height / 2 - event.clientY) / (bounds.height / 2),
    )
    lookTargetRef.current = target
    applyPreviewLookTarget(target)
  }, [applyPreviewLookTarget, preview])

  const clearPreviewLookTarget = useCallback(() => {
    lookTargetRef.current = null
    applyPreviewLookTarget(null)
  }, [applyPreviewLookTarget])

  const updatePreviewLookMovementScale = useCallback((nextScale: number) => {
    lookMovementScaleRef.current = nextScale
    if (lookTargetRef.current) {
      applyPreviewLookTarget(lookTargetRef.current, nextScale)
    }
  }, [applyPreviewLookTarget])

  const applyFraming = useCallback((
    nextScale: number,
    nextOffset: LiveSDFramingOffset,
  ) => {
    const session = sessionRef.current
    if (!session) return

    try {
      session.setFramingScale(nextScale)
      session.setFramingOffset(nextOffset)
      setFramingScale(nextScale)
      setFramingOffset(nextOffset)
      setError(null)
      setModelPhase('ready')
    } catch (caughtError) {
      reportPreviewControlError(caughtError)
    }
  }, [reportPreviewControlError])

  const updateFramingScale = (nextScale: number) => {
    applyFraming(nextScale, framingOffset)
  }

  const updateFramingOffset = (nextOffset: LiveSDFramingOffset) => {
    applyFraming(framingScale, nextOffset)
  }

  const resetFraming = () => {
    applyFraming(
      LIVE_SD_FRAMING_SCALE_DEFAULT,
      LIVE_SD_FRAMING_OFFSET_DEFAULT,
    )
  }

  const framingScalePercent = Math.round(framingScale * 100)

  const statusPhase = error
    ? 'error'
    : modelPhase === 'ready'
      ? 'ready'
      : catalogPhase === 'loading' || modelPhase === 'loading'
        ? 'loading'
        : 'idle'
  const statusMessage =
    catalogPhase === 'loading'
      ? t('strr.status.loadingCatalog')
      : modelPhase === 'loading'
        ? t('strr.status.loadingModel', {
            edition: selectedEditionId ?? '',
          })
        : modelPhase === 'ready' && selectedCharacterLabel && selectedEditionLabel
          ? t('strr.status.ready', {
              character: selectedCharacterLabel,
              edition: selectedEditionLabel,
            })
          : catalogPhase === 'ready' && catalog
            ? t('strr.status.catalogReady', {
                characters: catalog.characters.length,
                editions: totalEditions,
              })
            : error
              ? t('strr.status.error')
              : t('strr.status.idle')
  const previewTitle = selectedCharacterLabel && selectedEditionLabel
    ? `${selectedCharacterLabel} · ${selectedEditionLabel}`
    : t('strr.previewTitle')

  return (
    <>
      <div className="workspace-grid strr-workspace">
        <aside className="control-panel" aria-label={t('strr.modelImport')}>
          <CodexPetPresetLoader
            busy={catalogPhase === 'loading' || modelPhase === 'loading'}
            catalog={presetSession.catalog}
            description={t('strr.presetDescription')}
            onLoad={presetSession.loadSelectedPreset}
            onSelectionChange={handlePresetSelectionChange}
            selectedPresetName={presetSession.selectedPresetName}
            selectorTestId="strr-resource-preset-selector"
          />

          <section className="panel-section">
            <div className="step-heading">
              <span>01</span>
              <div>
                <h2>{t('strr.archiveMirror')}</h2>
                <p>{t('strr.archiveMirrorDescription')}</p>
              </div>
            </div>
            <button
              className="primary-action"
              disabled={
                presetSession.selectedPresetName !== null ||
                catalogPhase === 'loading' ||
                modelPhase === 'loading'
              }
              onClick={() => void loadCatalog()}
              type="button"
            >
              {catalogPhase === 'loading'
                ? t('strr.loadingCatalog')
                : t('strr.loadCatalog')}
            </button>
          </section>

          <section className="panel-section strr-selector-stack">
            <div className="step-heading">
              <span>02</span>
              <div>
                <h2>{t('strr.character')}</h2>
                <p>{t('strr.characterDescription')}</p>
              </div>
            </div>
            <SearchableCombobox
              disabled={catalogPhase !== 'ready' || modelPhase === 'loading'}
              disabledMessage={t('strr.loadCatalogFirst')}
              emptyMessage={t('strr.noCharacters')}
              id="strr-character"
              label={t('strr.characterSearch')}
              loading={catalogPhase === 'loading'}
              loadingMessage={t('strr.status.loadingCatalog')}
              onChange={selectCharacter}
              options={characterOptions}
              placeholder={t('strr.characterPlaceholder')}
              queryResetKey={characterQueryResetKey}
              value={selectedCharacterId}
            />
          </section>

          <section className="panel-section strr-selector-stack">
            <div className="step-heading">
              <span>03</span>
              <div>
                <h2>{t('strr.edition')}</h2>
                <p>{t('strr.editionDescription')}</p>
              </div>
            </div>
            <SearchableCombobox
              disabled={!selectedCharacter || modelPhase === 'loading'}
              disabledMessage={t('strr.selectCharacterFirst')}
              emptyMessage={t('strr.noEditions')}
              id="strr-edition"
              label={t('strr.editionSearch')}
              loading={modelPhase === 'loading'}
              loadingMessage={t('strr.status.loadingModel', {
                edition: selectedEditionId ?? '',
              })}
              onChange={(editionId) => void loadModel(editionId)}
              options={editionOptions}
              placeholder={t('strr.editionPlaceholder')}
              queryResetKey={editionQueryResetKey}
              value={selectedEditionId}
            />
          </section>

          <div
            className={`status-card status-card--${statusPhase}`}
            aria-atomic="true"
            aria-live="polite"
            role="status"
          >
            <span className="status-card__dot" aria-hidden="true" />
            <div>
              <strong>
                {modelPhase === 'ready'
                  ? t('strr.previewReady')
                  : t('strr.status')}
              </strong>
              <p>{statusMessage}</p>
              {preview ? (
                <p
                  data-render-status="ready"
                  data-testid="strr-render-evidence"
                >
                  {t('strr.renderEvidence', {
                    count: preview.animations.length,
                  })}
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="notice notice--error" role="alert">
              <code>{errorCode(error)}</code>
              <p>
                {errorCode(error).startsWith('STRR_CATALOG_')
                  ? t('strr.error.catalog')
                  : t('strr.error.model')}
              </p>
            </div>
          ) : null}

        </aside>

        <section className="preview-panel" aria-labelledby="strr-preview-title">
          <div className="preview-toolbar">
            <div>
              <p className="toolbar-label">{t('game.strr')}</p>
              <h2 id="strr-preview-title">{previewTitle}</h2>
            </div>
            <div className="preview-toolbar__controls">
              <fieldset className="framing-scale-control" disabled={!preview}>
                <legend>{t('prsk.framing')}</legend>
                <div className="framing-scale-control__input-row">
                  <label htmlFor="strr-pet-framing-scale">
                    {t('prsk.petSize')}
                  </label>
                  <input
                    aria-label={t('prsk.petSizeSlider')}
                    aria-valuetext={t('common.percentValue', {
                      value: framingScalePercent,
                    })}
                    id="strr-pet-framing-scale"
                    max={LIVE_SD_FRAMING_SCALE_MAX * 100}
                    min={LIVE_SD_FRAMING_SCALE_MIN * 100}
                    onChange={(event) =>
                      updateFramingScale(Number(event.target.value) / 100)
                    }
                    step={LIVE_SD_FRAMING_SCALE_STEP * 100}
                    type="range"
                    value={framingScalePercent}
                  />
                  <output htmlFor="strr-pet-framing-scale">
                    {framingScalePercent}%
                  </output>
                </div>
                <div className="framing-scale-control__input-row">
                  <label htmlFor="strr-pet-framing-offset-x">
                    {t('prsk.offsetX')}
                  </label>
                  <input
                    aria-label={t('prsk.offsetXSlider')}
                    aria-valuetext={t('common.pixelValue', {
                      value: framingOffset.x,
                    })}
                    id="strr-pet-framing-offset-x"
                    max={LIVE_SD_FRAMING_OFFSET_X_MAX}
                    min={LIVE_SD_FRAMING_OFFSET_X_MIN}
                    onChange={(event) =>
                      updateFramingOffset({
                        ...framingOffset,
                        x: Number(event.target.value),
                      })
                    }
                    step={LIVE_SD_FRAMING_OFFSET_STEP}
                    type="range"
                    value={framingOffset.x}
                  />
                  <output htmlFor="strr-pet-framing-offset-x">
                    {t('common.pixelValue', { value: framingOffset.x })}
                  </output>
                </div>
                <div className="framing-scale-control__input-row">
                  <label htmlFor="strr-pet-framing-offset-y">
                    {t('prsk.offsetY')}
                  </label>
                  <input
                    aria-label={t('prsk.offsetYSlider')}
                    aria-valuetext={t('common.pixelValue', {
                      value: framingOffset.y,
                    })}
                    id="strr-pet-framing-offset-y"
                    max={LIVE_SD_FRAMING_OFFSET_Y_MAX}
                    min={LIVE_SD_FRAMING_OFFSET_Y_MIN}
                    onChange={(event) =>
                      updateFramingOffset({
                        ...framingOffset,
                        y: Number(event.target.value),
                      })
                    }
                    step={LIVE_SD_FRAMING_OFFSET_STEP}
                    type="range"
                    value={framingOffset.y}
                  />
                  <output htmlFor="strr-pet-framing-offset-y">
                    {t('common.pixelValue', { value: framingOffset.y })}
                  </output>
                </div>
                <button
                  disabled={
                    !preview ||
                    (framingScale === LIVE_SD_FRAMING_SCALE_DEFAULT &&
                      framingOffset.x === LIVE_SD_FRAMING_OFFSET_DEFAULT.x &&
                      framingOffset.y === LIVE_SD_FRAMING_OFFSET_DEFAULT.y)
                  }
                  onClick={resetFraming}
                  type="button"
                >
                  {t('prsk.resetFraming')}
                </button>
              </fieldset>
              <div className="animation-picker">
                <SearchableCombobox
                  disabled={!preview}
                  disabledMessage={t('strr.loadModelFirst')}
                  emptyMessage={t('strr.noAnimations')}
                  id="strr-animation"
                  label={t('strr.animation')}
                  onChange={playDirectAnimation}
                  options={animationOptions}
                  placeholder={t('strr.animationPlaceholder')}
                  queryResetKey={animationQueryResetKey}
                  value={currentAnimation}
                />
              </div>
            </div>
            <CodexPetStateShortcuts
              activeStateId={activePreviewStateId}
              disabled={!preview}
              mappings={codexPetMappings}
              onActivate={playStateAnimation}
            />
          </div>

          <div className="preview-stage">
            <div
              aria-hidden={!preview}
              className={`livesd-preview-border-box${
                preview ? '' : ' livesd-preview-border-box--empty'
              }`}
              data-testid="strr-preview-border-box"
              ref={previewFrameRef}
            >
              <span className="preview-border-label">
                {t('strr.outputFrame')}
              </span>
              <canvas
                aria-label={t('strr.canvasLabel')}
                height={208}
                onPointerCancel={clearPreviewLookTarget}
                onPointerLeave={clearPreviewLookTarget}
                onPointerMove={handlePreviewPointerMove}
                ref={canvasRef}
                width={192}
              />
            </div>
            {!preview ? (
              <div className="preview-empty">
                <span aria-hidden="true">◇</span>
                <strong>{t('strr.noPreview')}</strong>
                <p>{t('strr.noPreviewHint')}</p>
              </div>
            ) : (
              <div className="preview-meta">
                <span>LiveSD {preview.version}</span>
                <span>{currentAnimation}</span>
              </div>
            )}
          </div>
        </section>

        <CodexPetBuilder
          animations={preview?.animations ?? []}
          defaultGlobalMirrorX={STRR_DEFAULT_GLOBAL_MIRROR_X}
          defaultStateAnimationNames={STRR_DEFAULT_STATE_ANIMATION_NAMES}
          defaultStateMirrorX={STRR_DEFAULT_STATE_MIRROR_X}
          framingOffset={framingOffset}
          framingScale={framingScale}
          onFramingChange={applyFraming}
          onGlobalMirrorXChange={handleGlobalMirrorXChange}
          onMappingsChange={handleMappingsChange}
          onPresetCatalogChange={presetSession.updateCatalog}
          onPreviewAnimationChange={playStateAnimation}
          onPreviewLookMovementScaleChange={updatePreviewLookMovementScale}
          presetCatalog={presetSession.appliedCatalog}
          presetLoadGeneration={presetSession.loadGeneration}
          presetRuntime="strr"
          recipeSource={preview
            ? {
                provider: 'strr-res-pak',
                characterId: preview.characterId,
                editionId: preview.editionId,
              }
            : null}
          source={preview?.source ?? null}
        />
      </div>

      <footer className="app-footer">
        <p>{t('strr.footerPrivacy')}</p>
        <nav aria-label={t('prsk.runtimeNotices')}>
          <a
            href={SPINE_36_RUNTIME_LICENSE_URL}
            rel="noreferrer"
            target="_blank"
          >
            Spine runtime license
          </a>
          <a
            href={SPINE_36_RUNTIME_NOTICES_URL}
            rel="noreferrer"
            target="_blank"
          >
            Third-party notices
          </a>
        </nav>
      </footer>
    </>
  )
}
