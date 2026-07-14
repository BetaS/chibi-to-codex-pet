import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { useI18n } from '../../../../i18n'
import {
  resolveCodexPetMirrorX,
  type CodexPetAnimationMappings,
} from '../../../codex-pet/animationMapping'
import { CodexPetBuilder } from '../../../codex-pet/CodexPetBuilder'
import { CodexPetStateShortcuts } from '../../../codex-pet/CodexPetStateShortcuts'
import type { CodexPetStateId } from '../../../codex-pet/contract'
import { CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT } from '../../../codex-pet/lookMovementScale'
import type { CodexPetSettingsPresetGarupaPinnedSource } from '../../../codex-pet/settingsPresets'
import { useCodexPetPresetSession } from '../../../codex-pet/useCodexPetPresetSession'
import type { LiveSDFrameSamplingInput } from '../../export/types'
import {
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  type LiveSDFramingOffset,
} from '../../rendering/framingOffset'
import {
  LIVE_SD_FRAMING_SCALE_DEFAULT,
} from '../../rendering/framingScale'
import {
  normalizeLiveSDLookTarget,
  type LiveSDLookTarget,
} from '../../rendering/lookTarget'
import {
  SPINE_40_RUNTIME_LICENSE_URL,
  SPINE_40_RUNTIME_NOTICES_URL,
} from '../../runtime/Spine40RuntimeLoader'
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from '../../ui/SearchableCombobox'
import { LiveSDFramingControls } from '../../ui/LiveSDFramingControls'
import {
  GarupaSpine40FrameSampler,
  officialGarupaSpine40RuntimeAdapter,
  type GarupaSpine40PreviewSession,
} from '../rendering'
import { createDefaultGarupaSourceController } from './createDefaultGarupaSourceController'
import type { GarupaSourceController } from './GarupaSourceController'
import {
  GarupaSourcePanel,
  type GarupaSourcePanelProps,
} from './GarupaSourcePanel'

const GARUPA_DEFAULT_STATE_MIRROR_X = Object.freeze({
  'running-right': true,
  'running-left': false,
})

export interface GarupaSourceIntegrationProps {
  readonly characterCatalogLoader?: GarupaSourcePanelProps['characterCatalogLoader']
  readonly controllerFactory?: () => GarupaSourceController
}

export function GarupaSourceIntegration({
  characterCatalogLoader,
  controllerFactory = createDefaultGarupaSourceController,
}: GarupaSourceIntegrationProps = {}) {
  const { t } = useI18n()
  const [controller] = useState(controllerFactory)
  const lifecycleGenerationRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewFrameRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<GarupaSpine40PreviewSession | null>(
    controller.getActivePreview(),
  )
  const mappingsRef = useRef<Readonly<CodexPetAnimationMappings> | null>(null)
  const activeStateIdRef = useRef<CodexPetStateId | null>(null)
  const globalMirrorXRef = useRef(false)
  const lookTargetRef = useRef<LiveSDLookTarget | null>(null)
  const lookMovementScaleRef = useRef(
    CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
  )
  const controllerState = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  )
  const frameSampler = useMemo(
    () =>
      new GarupaSpine40FrameSampler({
        runtimeAdapter: officialGarupaSpine40RuntimeAdapter,
      }),
    [],
  )
  const presetSession = useCodexPetPresetSession('garupa')
  const [framingScale, setFramingScale] = useState(
    LIVE_SD_FRAMING_SCALE_DEFAULT,
  )
  const [framingOffset, setFramingOffset] = useState<LiveSDFramingOffset>(
    LIVE_SD_FRAMING_OFFSET_DEFAULT,
  )
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null)
  const [codexPetMappings, setCodexPetMappings] =
    useState<Readonly<CodexPetAnimationMappings> | null>(null)
  const [activePreviewStateId, setActivePreviewStateId] =
    useState<CodexPetStateId | null>(null)
  const [animationQueryResetKey, setAnimationQueryResetKey] = useState(0)
  const [builderSessionGeneration, setBuilderSessionGeneration] = useState(0)
  const [previewControlError, setPreviewControlError] = useState(false)

  const activeSource = controllerState.active
    ? controller.getActiveSource()
    : null
  const activePreview = controllerState.active
    ? controller.getActivePreview()
    : null
  const ready = Boolean(activeSource && activePreview)
  const activePreset = presetSession.appliedCatalog.activePresetName
    ? presetSession.appliedCatalog.presets[
        presetSession.appliedCatalog.activePresetName
      ]
    : undefined
  const activePresetSource = activePreset?.source?.provider === 'garupa-pinned'
    ? activePreset.source
    : null
  const activePinnedBundleName = controllerState.active?.kind === 'pinned'
    ? controllerState.active.sdAssetBundleName
    : null
  const currentPresetSource: CodexPetSettingsPresetGarupaPinnedSource | null =
    controllerState.active?.kind === 'pinned'
      ? {
          provider: 'garupa-pinned',
          sdAssetBundleName: controllerState.active.sdAssetBundleName,
        }
      : null
  const builderSource = useMemo(
    () => ready && activeSource
      ? {
          ...activeSource,
          ...(controllerState.active?.defaultDisplayName
            ? {
                defaultDisplayName:
                  controllerState.active.defaultDisplayName,
              }
            : {}),
        }
      : null,
    [activeSource, controllerState.active, ready],
  )

  const animationOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      activePreview?.animations.map((animation) => ({
        label: animation,
        value: animation,
      })) ?? [],
    [activePreview],
  )

  const services = useMemo(
    () => ({
      sample: (input: LiveSDFrameSamplingInput) =>
        frameSampler.sample({
          ...input,
          expectedAdapterIdentity: activePreview?.adapterIdentity,
        }),
    }),
    [activePreview?.adapterIdentity, frameSampler],
  )

  useEffect(() => {
    const generation = lifecycleGenerationRef.current + 1
    lifecycleGenerationRef.current = generation

    return () => {
      queueMicrotask(() => {
        if (lifecycleGenerationRef.current === generation) {
          controller.dispose()
        }
      })
    }
  }, [controller])

  useEffect(() => {
    if (!activePreview) {
      return
    }
    return activePreview.onError(() => setPreviewControlError(true))
  }, [activePreview])

  useEffect(() => {
    const previewFrame = previewFrameRef.current
    if (!previewFrame || !activePreview) {
      return
    }

    const resize = () => {
      activePreview.resize(
        Math.max(previewFrame.clientWidth, 1),
        Math.max(previewFrame.clientHeight, 1),
      )
    }

    resize()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize)
      return () => window.removeEventListener('resize', resize)
    }

    let resizeFrame: number | null = null
    const scheduleResize = () => {
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame)
      }
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null
        resize()
      })
    }
    const observer = new ResizeObserver(scheduleResize)
    observer.observe(previewFrame)
    return () => {
      observer.disconnect()
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame)
      }
    }
  }, [activePreview])

  const loadSelectedSource = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !await controller.load(canvas)) {
      return
    }
    const nextPreview = controller.getActivePreview()
    if (!nextPreview) {
      return
    }

    previewRef.current = nextPreview
    mappingsRef.current = null
    activeStateIdRef.current = null
    globalMirrorXRef.current = false
    lookTargetRef.current = null
    lookMovementScaleRef.current = CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT

    try {
      nextPreview.setFramingScale(LIVE_SD_FRAMING_SCALE_DEFAULT)
      nextPreview.setFramingOffset(LIVE_SD_FRAMING_OFFSET_DEFAULT)
      nextPreview.setMirrorX(false)
      nextPreview.setLookTarget(null)
      setPreviewControlError(false)
    } catch {
      setPreviewControlError(true)
    }

    setFramingScale(LIVE_SD_FRAMING_SCALE_DEFAULT)
    setFramingOffset(LIVE_SD_FRAMING_OFFSET_DEFAULT)
    setCurrentAnimation(nextPreview.currentAnimation)
    setCodexPetMappings(null)
    setActivePreviewStateId(null)
    setAnimationQueryResetKey((key) => key + 1)
    setBuilderSessionGeneration((generation) => generation + 1)
  }, [controller])

  useEffect(() => {
    if (
      !activePresetSource ||
      activePresetSource.sdAssetBundleName === activePinnedBundleName
    ) {
      return
    }
    const loadTimer = window.setTimeout(() => {
      controller.selectPinned(activePresetSource.sdAssetBundleName)
      void loadSelectedSource()
    }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [
    activePinnedBundleName,
    activePresetSource,
    controller,
    loadSelectedSource,
    presetSession.loadGeneration,
  ])

  const handlePresetSelectionChange = useCallback((
    presetName: string | null,
  ) => {
    if (presetName === null) {
      controller.clearSelection()
    }
    presetSession.selectPreset(presetName)
  }, [controller, presetSession])

  const applyPreviewMirrorX = useCallback((mirrorX: boolean) => {
    try {
      previewRef.current?.setMirrorX(mirrorX)
      setPreviewControlError(false)
    } catch {
      setPreviewControlError(true)
    }
  }, [])

  const playAnimation = useCallback((animationName: string) => {
    const preview = previewRef.current
    if (!preview) {
      return
    }
    try {
      preview.play(animationName)
      setCurrentAnimation(animationName)
      setPreviewControlError(false)
    } catch {
      setPreviewControlError(true)
    }
  }, [])

  const handleMappingsChange = useCallback((
    mappings: Readonly<CodexPetAnimationMappings> | null,
  ) => {
    mappingsRef.current = mappings
    setCodexPetMappings(mappings)
    const stateId = activeStateIdRef.current
    if (mappings && stateId) {
      applyPreviewMirrorX(resolveCodexPetMirrorX(
        globalMirrorXRef.current,
        mappings[stateId].mirrorX,
      ))
    }
  }, [applyPreviewMirrorX])

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
    const preview = previewRef.current
    if (!preview?.lookRigSupported) {
      return
    }
    try {
      preview.setLookTarget(target, movementScale)
      setPreviewControlError(false)
    } catch {
      setPreviewControlError(true)
    }
  }, [])

  const handlePreviewPointerMove = useCallback((
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    if (!ready || !previewRef.current?.lookRigSupported) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) {
      return
    }

    const target = normalizeLiveSDLookTarget(
      (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2),
      (bounds.top + bounds.height / 2 - event.clientY) / (bounds.height / 2),
    )
    lookTargetRef.current = target
    applyPreviewLookTarget(target)
  }, [applyPreviewLookTarget, ready])

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
    const preview = previewRef.current
    if (!preview) {
      return
    }
    try {
      preview.setFramingScale(nextScale)
      preview.setFramingOffset(nextOffset)
      setFramingScale(nextScale)
      setFramingOffset(nextOffset)
      setPreviewControlError(false)
    } catch {
      setPreviewControlError(true)
    }
  }, [])

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

  return (
    <>
      <div className="workspace-grid">
        <GarupaSourcePanel
          {...(characterCatalogLoader ? { characterCatalogLoader } : {})}
          controller={controller}
          onLoad={loadSelectedSource}
          onPresetLoad={presetSession.loadSelectedPreset}
          onPresetSelectionChange={handlePresetSelectionChange}
          presetCatalog={presetSession.catalog}
          selectedPresetName={presetSession.selectedPresetName}
        />

        <section className="preview-panel" aria-labelledby="garupa-preview-title">
          <div className="preview-toolbar">
            <div>
              <p className="toolbar-label">{t('game.garupa')}</p>
              <h2 id="garupa-preview-title">
                {activeSource?.atlasBundle.sourceName ??
                  t('garupa.characterPreview')}
              </h2>
            </div>
            <div className="preview-toolbar__controls">
              <LiveSDFramingControls
                disabled={!ready}
                framingOffset={framingOffset}
                framingScale={framingScale}
                idPrefix="garupa"
                onOffsetChange={updateFramingOffset}
                onReset={resetFraming}
                onScaleChange={updateFramingScale}
              />
              <div className="animation-picker">
                <SearchableCombobox
                  disabled={!ready}
                  disabledMessage={t('garupa.loadModelFirst')}
                  emptyMessage={t('garupa.noAnimations')}
                  id="garupa-animation-picker"
                  label={t('garupa.animation')}
                  onChange={playDirectAnimation}
                  options={animationOptions}
                  placeholder={t('garupa.animationSearch')}
                  providerCapability="animation-selection"
                  queryResetKey={animationQueryResetKey}
                  value={currentAnimation}
                />
              </div>
            </div>
            <CodexPetStateShortcuts
              activeStateId={activePreviewStateId}
              disabled={!ready}
              mappings={codexPetMappings}
              onActivate={playStateAnimation}
            />
            {previewControlError ? (
              <div className="notice notice--error preview-control-error" role="alert">
                <code>GARUPA_PREVIEW_CONTROL_FAILED</code>
                <p>{t('garupa.error.rendering')}</p>
              </div>
            ) : null}
          </div>

          <div className="preview-stage">
            <div
              aria-hidden={!ready}
              className={`livesd-preview-border-box${
                ready ? '' : ' livesd-preview-border-box--empty'
              }`}
              data-testid="garupa-livesd-preview-border-box"
              ref={previewFrameRef}
            >
              <span className="preview-border-label">
                {t('garupa.outputFrame')}
              </span>
              <canvas
                aria-label={t('garupa.canvasLabel')}
                data-provider-capability="preview"
                height={208}
                onPointerCancel={clearPreviewLookTarget}
                onPointerLeave={clearPreviewLookTarget}
                onPointerMove={handlePreviewPointerMove}
                ref={canvasRef}
                width={192}
              />
            </div>
            {!ready ? (
              <div className="preview-empty">
                <span aria-hidden="true">◇</span>
                <strong>{t('garupa.noCharacter')}</strong>
                <p>{t('garupa.noCharacterHint')}</p>
              </div>
            ) : (
              <div className="preview-meta">
                <span>Spine {activePreview?.version}</span>
                <span>{currentAnimation}</span>
              </div>
            )}
          </div>
        </section>

        <CodexPetBuilder
          animations={activePreview?.animations ?? []}
          defaultGlobalMirrorX={false}
          defaultStateMirrorX={GARUPA_DEFAULT_STATE_MIRROR_X}
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
          presetRuntime="garupa"
          presetSource={currentPresetSource}
          recipeSource={null}
          services={services}
          source={builderSource}
          key={builderSessionGeneration}
        />
      </div>

      <footer className="app-footer">
        <p>{t('garupa.footerPrivacy')}</p>
        <nav aria-label={t('garupa.runtimeNotices')}>
          <a
            href={SPINE_40_RUNTIME_LICENSE_URL}
            rel="noreferrer"
            target="_blank"
          >
            Spine 4.0 runtime license
          </a>
          <a
            href={SPINE_40_RUNTIME_NOTICES_URL}
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
