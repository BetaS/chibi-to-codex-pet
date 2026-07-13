import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  localizeErrorNotice,
  useI18n,
  type MessageKey,
} from '../../i18n'
import { trackPetZipDownload } from '../../analytics/ga4'
import type { LiveSDAtlasBundle } from '../livesd/model'
import {
  liveSD36FrameSampler,
} from '../livesd/export/LiveSD36FrameSampler'
import type {
  LiveSDFrameSamplerContract,
  LiveSDFrameSamplingProgress,
} from '../livesd/export/types'
import {
  recommendCodexPetMappings,
  type CodexPetAnimationMappings,
} from './animationMapping'
import {
  CODEX_PET_LOOK_FRAME_COUNT,
  CODEX_PET_STATES,
  type CodexPetStateId,
} from './contract'
import { CodexPetInstalledPreview } from './CodexPetInstalledPreview'
import { GitHubStarPrompt } from './GitHubStarPrompt'
import {
  exportCodexPetPackage,
  type ExportedCodexPetPackage,
} from './packageExporter'
import {
  validateCodexPetPackage,
  type ValidatedCodexPetPackage,
} from './packageValidator'
import {
  createCodexPetRecipe,
  formatCodexPetRecipeInstallCommand,
  type CodexPetRecipeSource,
} from './recipe'
import {
  CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
  CODEX_PET_LOOK_MOVEMENT_SCALE_MAX,
  CODEX_PET_LOOK_MOVEMENT_SCALE_MIN,
  CODEX_PET_LOOK_MOVEMENT_SCALE_STEP,
} from './lookMovementScale'
import { getCodexPetStateCopy } from './stateCopy'
import {
  isDefaultLiveSDFramingOffset,
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  type LiveSDFramingOffset,
} from '../livesd/rendering/framingOffset'
import { LIVE_SD_FRAMING_SCALE_DEFAULT } from '../livesd/rendering/framingScale'
import type { LiveSDLookRigFallback } from '../livesd/rendering/lookRigFallback'
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from '../livesd/ui/SearchableCombobox'
import {
  applyCodexPetSettingsPresetMappings,
  readCodexPetSettingsPresetCatalog,
  saveCodexPetSettingsPreset,
  selectCodexPetSettingsPreset,
  type CodexPetSettingsPreset,
  type CodexPetSettingsPresetCatalog,
  type CodexPetSettingsPresetRuntime,
  type CodexPetSettingsPresetSource,
} from './settingsPresets'

export interface CodexPetBuilderSource {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly defaultDisplayName?: string
  readonly lookRigFallback?: LiveSDLookRigFallback
  readonly skeletonData: ArrayBuffer
}

export interface CodexPetBuilderServices {
  readonly copyText: (text: string) => Promise<void>
  readonly sample: LiveSDFrameSamplerContract['sample']
  readonly exportPackage: typeof exportCodexPetPackage
  readonly validatePackage: typeof validateCodexPetPackage
  readonly createObjectUrl: (blob: Blob) => string
  readonly revokeObjectUrl: (url: string) => void
  readonly trackDownload: () => void
}

export interface CodexPetBuilderProps {
  readonly animations: readonly string[]
  readonly defaultGlobalMirrorX?: boolean
  readonly defaultStateAnimationNames?: Readonly<
    Partial<Record<CodexPetStateId, string>>
  >
  readonly defaultStateMirrorX?: Readonly<
    Partial<Record<CodexPetStateId, boolean>>
  >
  readonly framingOffset?: LiveSDFramingOffset
  readonly framingScale: number
  readonly onFramingChange?: (
    framingScale: number,
    framingOffset: LiveSDFramingOffset,
  ) => void
  readonly onPreviewAnimationChange?: (
    animationName: string,
    stateId: CodexPetStateId,
    stateMirrorX: boolean,
  ) => void
  readonly onGlobalMirrorXChange?: (globalMirrorX: boolean) => void
  readonly onMappingsChange?: (
    mappings: Readonly<CodexPetAnimationMappings> | null,
  ) => void
  readonly onPresetCatalogChange?: (
    catalog: CodexPetSettingsPresetCatalog,
  ) => void
  readonly onPreviewLookMovementScaleChange?: (scale: number) => void
  readonly presetCatalog?: CodexPetSettingsPresetCatalog
  readonly presetLoadGeneration?: number
  readonly presetRuntime?: CodexPetSettingsPresetRuntime
  readonly presetSource?: CodexPetSettingsPresetSource | null
  readonly recipeSource?: CodexPetRecipeSource | null
  readonly services?: Partial<CodexPetBuilderServices>
  readonly source: CodexPetBuilderSource | null
}

type ExportPhase =
  | 'cancelled'
  | 'error'
  | 'idle'
  | 'packaging'
  | 'ready'
  | 'sampling'
  | 'validating'

type InstallCommandCopyPhase = 'copied' | 'copying' | 'error' | 'idle'

interface BuilderResult {
  readonly filename: string
  readonly installCommand: string | null
  readonly packageUrl: string
  readonly spritesheetUrl: string
  readonly validated: ValidatedCodexPetPackage
}

interface BuilderError {
  readonly code: string
  readonly message: string
}

interface InitialBuilderState {
  readonly description: string
  readonly displayName: string
  readonly error: BuilderError | null
  readonly globalMirrorX: boolean
  readonly initialFramingOffset: LiveSDFramingOffset | null
  readonly initialFramingScale: number | null
  readonly lookMovementScale: number
  readonly mappings: CodexPetAnimationMappings | null
  readonly phase: ExportPhase
}

const DEFAULT_SERVICES: CodexPetBuilderServices = {
  copyText: async (value) => {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API is unavailable.')
    }
    await navigator.clipboard.writeText(value)
  },
  sample: (input) => liveSD36FrameSampler.sample(input),
  exportPackage: exportCodexPetPackage,
  validatePackage: validateCodexPetPackage,
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  trackDownload: trackPetZipDownload,
}

const PHASE_MESSAGE_KEYS: Readonly<Record<ExportPhase, MessageKey>> = {
  cancelled: 'builder.phase.cancelled',
  error: 'builder.phase.error',
  idle: 'builder.phase.idle',
  packaging: 'builder.phase.packaging',
  ready: 'builder.phase.ready',
  sampling: 'builder.phase.sampling',
  validating: 'builder.phase.validating',
}

function suggestedDisplayName(sourceName: string): string {
  return sourceName
    .replace(/\.(?:zip|atlas)$/iu, '')
    .replace(/[_-]+/gu, ' ')
    .trim()
}

function toBuilderError(error: unknown): BuilderError {
  if (error instanceof Error) {
    const code = Reflect.get(error, 'code')
    return {
      code: typeof code === 'string' ? code : 'CODEX_PET_EXPORT_FAILED',
      message: error.message,
    }
  }

  return {
    code: 'CODEX_PET_EXPORT_FAILED',
    message: '',
  }
}

function createDefaultMappings(
  animations: readonly string[],
  defaultStateAnimationNames?: Readonly<
    Partial<Record<CodexPetStateId, string>>
  >,
  defaultStateMirrorX?: Readonly<
    Partial<Record<CodexPetStateId, boolean>>
  >,
): CodexPetAnimationMappings {
  const mappings = recommendCodexPetMappings(animations)
  for (const state of CODEX_PET_STATES) {
    const preferredAnimationName = defaultStateAnimationNames?.[state.id]
    const animationName = preferredAnimationName
      ? animations.find((candidate) => candidate === preferredAnimationName) ??
        animations.find(
          (candidate) =>
            candidate.toLocaleLowerCase('en-US') ===
            preferredAnimationName.toLocaleLowerCase('en-US'),
        )
      : undefined
    const mirrorX = defaultStateMirrorX?.[state.id]
    if (animationName !== undefined || mirrorX !== undefined) {
      mappings[state.id] = {
        ...mappings[state.id],
        ...(animationName === undefined ? {} : { animationName }),
        ...(mirrorX === undefined ? {} : { mirrorX }),
      }
    }
  }
  return mappings
}

function createInitialBuilderState(
  source: CodexPetBuilderSource | null,
  animations: readonly string[],
  defaultGlobalMirrorX: boolean,
  defaultStateAnimationNames?: Readonly<
    Partial<Record<CodexPetStateId, string>>
  >,
  defaultStateMirrorX?: Readonly<
    Partial<Record<CodexPetStateId, boolean>>
  >,
  presetCatalog?: CodexPetSettingsPresetCatalog,
): InitialBuilderState {
  const activePreset = presetCatalog?.activePresetName
    ? presetCatalog.presets[presetCatalog.activePresetName]
    : undefined
  const defaultDisplayName =
    presetCatalog &&
    presetCatalog.activePresetName === null &&
    Object.keys(presetCatalog.presets).length > 0
      ? ''
      : source
        ? source.defaultDisplayName?.trim() ||
          suggestedDisplayName(source.atlasBundle.sourceName)
        : ''
  const baseState = {
    description: activePreset?.description ?? '',
    displayName: activePreset?.displayName ?? defaultDisplayName,
    globalMirrorX: activePreset?.globalMirrorX ?? defaultGlobalMirrorX,
    initialFramingOffset: activePreset?.framingOffset ?? null,
    initialFramingScale: activePreset?.framingScale ?? null,
    lookMovementScale:
      activePreset?.lookMovementScale ??
      CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
  }

  if (!source || animations.length === 0) {
    return {
      ...baseState,
      error: null,
      mappings: null,
      phase: 'idle',
    }
  }

  try {
    const mappings = createDefaultMappings(
      animations,
      defaultStateAnimationNames,
      defaultStateMirrorX,
    )
    const resolvedMappings = activePreset
      ? applyCodexPetSettingsPresetMappings(
          activePreset,
          animations,
          mappings,
        )
      : mappings
    return {
      ...baseState,
      error: null,
      mappings: resolvedMappings,
      phase: 'idle',
    }
  } catch (error) {
    return {
      ...baseState,
      error: toBuilderError(error),
      mappings: null,
      phase: 'error',
    }
  }
}

function progressText(progress: LiveSDFrameSamplingProgress | null): string {
  if (!progress) {
    return ''
  }

  const frame =
    progress.stateId !== undefined && progress.frameIndex !== undefined
      ? ` · ${progress.stateId} ${progress.frameIndex + 1}`
      : progress.lookDirectionIndex !== undefined
        ? ` · look ${progress.lookDirectionIndex + 1}/${CODEX_PET_LOOK_FRAME_COUNT}`
      : ''
  return `${progress.completedSteps}/${progress.totalSteps}${frame}`
}

function CodexPetBuilderContent({
  animations,
  defaultGlobalMirrorX = false,
  defaultStateAnimationNames,
  defaultStateMirrorX,
  framingOffset = LIVE_SD_FRAMING_OFFSET_DEFAULT,
  framingScale,
  onFramingChange,
  onGlobalMirrorXChange,
  onMappingsChange,
  onPresetCatalogChange,
  onPreviewAnimationChange,
  onPreviewLookMovementScaleChange,
  presetCatalog: controlledPresetCatalog,
  presetLoadGeneration = 0,
  presetRuntime = 'prsk',
  presetSource,
  recipeSource,
  services,
  source,
}: CodexPetBuilderProps) {
  const { locale, t } = useI18n()
  const [initialPresetCatalog] = useState(() =>
    readCodexPetSettingsPresetCatalog(undefined, presetRuntime),
  )
  const [uncontrolledPresetCatalog, setUncontrolledPresetCatalog] =
    useState(initialPresetCatalog)
  const presetCatalog =
    controlledPresetCatalog ?? uncontrolledPresetCatalog
  const resolvedPresetSource =
    presetSource === undefined ? recipeSource : presetSource
  const [initialState] = useState(() =>
    createInitialBuilderState(
      source,
      animations,
      defaultGlobalMirrorX,
      defaultStateAnimationNames,
      defaultStateMirrorX,
      controlledPresetCatalog ?? initialPresetCatalog,
    ),
  )
  const resolvedServices = useMemo<CodexPetBuilderServices>(
    () => ({ ...DEFAULT_SERVICES, ...services }),
    [services],
  )
  const controllerRef = useRef<AbortController | null>(null)
  const framingRef = useRef({
    scale: framingScale,
    x: framingOffset.x,
    y: framingOffset.y,
  })
  const generationRef = useRef(0)
  const initialFramingAppliedRef = useRef(false)
  const appliedPresetRef = useRef({
    generation: presetLoadGeneration,
    name: presetCatalog.activePresetName,
  })
  const urlsRef = useRef<Pick<BuilderResult, 'packageUrl' | 'spritesheetUrl'> | null>(
    null,
  )
  const downloadLinkRef = useRef<HTMLAnchorElement>(null)
  const starPromptShownRef = useRef(false)
  const [description, setDescription] = useState(initialState.description)
  const [globalMirrorX, setGlobalMirrorX] = useState(
    initialState.globalMirrorX,
  )
  const [lookMovementScale, setLookMovementScale] = useState(
    initialState.lookMovementScale,
  )
  const [displayName, setDisplayName] = useState(initialState.displayName)
  const [error, setError] = useState<BuilderError | null>(initialState.error)
  const [mappings, setMappings] =
    useState<CodexPetAnimationMappings | null>(initialState.mappings)
  const [phase, setPhase] = useState<ExportPhase>(initialState.phase)
  const [progress, setProgress] =
    useState<LiveSDFrameSamplingProgress | null>(null)
  const [mappingQueryResetKey, setMappingQueryResetKey] = useState(0)
  const [result, setResult] = useState<BuilderResult | null>(null)
  const [isStarPromptOpen, setIsStarPromptOpen] = useState(false)
  const [installCommandCopyPhase, setInstallCommandCopyPhase] =
    useState<InstallCommandCopyPhase>('idle')
  const animationOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      animations.map((animationName) => ({
        label: animationName,
        value: animationName,
      })),
    [animations],
  )

  useEffect(() => {
    onMappingsChange?.(mappings)
  }, [mappings, onMappingsChange])

  useEffect(() => {
    onGlobalMirrorXChange?.(globalMirrorX)
  }, [globalMirrorX, onGlobalMirrorXChange])

  useEffect(() => {
    onPreviewLookMovementScaleChange?.(lookMovementScale)
  }, [lookMovementScale, onPreviewLookMovementScaleChange])

  useEffect(() => {
    if (
      initialFramingAppliedRef.current ||
      !source ||
      initialState.initialFramingScale === null ||
      initialState.initialFramingOffset === null
    ) {
      return
    }
    initialFramingAppliedRef.current = true
    onFramingChange?.(
      initialState.initialFramingScale,
      initialState.initialFramingOffset,
    )
    const idleMapping = initialState.mappings?.idle
    if (idleMapping) {
      onPreviewAnimationChange?.(
        idleMapping.animationName,
        'idle',
        idleMapping.mirrorX,
      )
    }
  }, [
    initialState.initialFramingOffset,
    initialState.initialFramingScale,
    initialState.mappings,
    onFramingChange,
    onPreviewAnimationChange,
    source,
  ])

  useEffect(
    () => () => onMappingsChange?.(null),
    [onMappingsChange],
  )

  const clearResult = useCallback(() => {
    const urls = urlsRef.current
    if (urls) {
      resolvedServices.revokeObjectUrl(urls.packageUrl)
      resolvedServices.revokeObjectUrl(urls.spritesheetUrl)
      urlsRef.current = null
    }
    setResult(null)
    setInstallCommandCopyPhase('idle')
  }, [resolvedServices])

  useEffect(
    () => () => {
      generationRef.current += 1
      controllerRef.current?.abort()
      const urls = urlsRef.current
      if (urls) {
        resolvedServices.revokeObjectUrl(urls.packageUrl)
        resolvedServices.revokeObjectUrl(urls.spritesheetUrl)
        urlsRef.current = null
      }
    },
    [resolvedServices],
  )

  useEffect(() => {
    if (
      Object.is(framingRef.current.scale, framingScale) &&
      framingRef.current.x === framingOffset.x &&
      framingRef.current.y === framingOffset.y
    ) {
      return
    }

    framingRef.current = {
      scale: framingScale,
      x: framingOffset.x,
      y: framingOffset.y,
    }
    generationRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    clearResult()
    setProgress(null)
    setError(null)
    setPhase('idle')
  }, [clearResult, framingOffset.x, framingOffset.y, framingScale])

  const updateAnimation = (
    stateId: CodexPetStateId,
    animationName: string,
  ) => {
    clearResult()
    setPhase('idle')
    setMappings((current) =>
      current
        ? {
            ...current,
            [stateId]: { ...current[stateId], animationName },
          }
        : current,
    )
    onPreviewAnimationChange?.(
      animationName,
      stateId,
      mappings?.[stateId].mirrorX ?? false,
    )
  }

  const updateMirror = (stateId: CodexPetStateId, mirrorX: boolean) => {
    clearResult()
    setPhase('idle')
    setMappings((current) =>
      current
        ? {
            ...current,
            [stateId]: { ...current[stateId], mirrorX },
          }
        : current,
    )
    onPreviewAnimationChange?.(
      mappings?.[stateId].animationName ?? '',
      stateId,
      mirrorX,
    )
  }

  const updateLookMovementScale = (nextScale: number) => {
    clearResult()
    setPhase('idle')
    setLookMovementScale(nextScale)
  }

  const updatePresetCatalog = useCallback((
    nextCatalog: CodexPetSettingsPresetCatalog,
  ) => {
    if (controlledPresetCatalog === undefined) {
      setUncontrolledPresetCatalog(nextCatalog)
    }
    onPresetCatalogChange?.(nextCatalog)
  }, [controlledPresetCatalog, onPresetCatalogChange])

  const applyPreset = useCallback((
    preset: CodexPetSettingsPreset | null,
  ) => {
    let nextMappings: CodexPetAnimationMappings | null = null
    try {
      if (source && animations.length > 0) {
        const defaults = createDefaultMappings(
          animations,
          defaultStateAnimationNames,
          defaultStateMirrorX,
        )
        nextMappings = preset
          ? applyCodexPetSettingsPresetMappings(
              preset,
              animations,
              defaults,
            )
          : defaults
      }
    } catch (caughtError) {
      setError(toBuilderError(caughtError))
      setPhase('error')
      return
    }

    generationRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    clearResult()
    setProgress(null)
    setError(null)
    setPhase('idle')
    setDescription(preset?.description ?? '')
    setDisplayName(preset?.displayName ?? '')
    setGlobalMirrorX(preset?.globalMirrorX ?? defaultGlobalMirrorX)
    setLookMovementScale(
      preset?.lookMovementScale ??
        CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
    )
    setMappings(nextMappings)
    setMappingQueryResetKey((key) => key + 1)

    if (source) {
      onFramingChange?.(
        preset?.framingScale ?? LIVE_SD_FRAMING_SCALE_DEFAULT,
        preset?.framingOffset ?? LIVE_SD_FRAMING_OFFSET_DEFAULT,
      )
      const idleMapping = nextMappings?.idle
      if (idleMapping) {
        onPreviewAnimationChange?.(
          idleMapping.animationName,
          'idle',
          idleMapping.mirrorX,
        )
      }
    }
  }, [
    animations,
    clearResult,
    defaultGlobalMirrorX,
    defaultStateAnimationNames,
    defaultStateMirrorX,
    onFramingChange,
    onPreviewAnimationChange,
    source,
  ])

  useEffect(() => {
    const nextPresetName = presetCatalog.activePresetName
    if (
      appliedPresetRef.current.name === nextPresetName &&
      appliedPresetRef.current.generation === presetLoadGeneration
    ) {
      return
    }
    appliedPresetRef.current = {
      generation: presetLoadGeneration,
      name: nextPresetName,
    }
    applyPreset(
      nextPresetName ? presetCatalog.presets[nextPresetName] ?? null : null,
    )
  }, [
    applyPreset,
    presetCatalog.activePresetName,
    presetCatalog.presets,
    presetLoadGeneration,
  ])

  const changeActivePreset = (presetName: string | null) => {
    const nextCatalog = selectCodexPetSettingsPreset(
      presetName,
      undefined,
      presetRuntime,
    )
    updatePresetCatalog(nextCatalog)
  }

  const cancelExport = () => {
    generationRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    setProgress(null)
    setPhase('cancelled')
  }

  const generatePackage = async () => {
    if (!source || !mappings || !displayName.trim()) {
      return
    }

    controllerRef.current?.abort()
    clearResult()
    const controller = new AbortController()
    controllerRef.current = controller
    const generation = generationRef.current + 1
    generationRef.current = generation
    setError(null)
    setProgress(null)
    setPhase('sampling')
    const sampledFramingScale = framingScale
    const sampledFramingOffset = { ...framingOffset }
    const sampledLookMovementScale = lookMovementScale
    const sampledGlobalMirrorX = globalMirrorX
    const sampledMappings = mappings

    try {
      const sampled = await resolvedServices.sample({
        atlasBundle: source.atlasBundle,
        framingOffset: sampledFramingOffset,
        framingScale: sampledFramingScale,
        globalMirrorX: sampledGlobalMirrorX,
        lookMovementScale: sampledLookMovementScale,
        lookRigFallback: source.lookRigFallback,
        skeletonData: source.skeletonData,
        mappings: sampledMappings,
        signal: controller.signal,
        onProgress: (nextProgress) => {
          if (
            generationRef.current === generation &&
            !controller.signal.aborted
          ) {
            setProgress(nextProgress)
          }
        },
      })
      if (controller.signal.aborted || generationRef.current !== generation) {
        return
      }

      setPhase('packaging')
      const exported: ExportedCodexPetPackage =
        await resolvedServices.exportPackage({
          metadata: { description, displayName },
          spritesheet: sampled.atlasPng,
        })
      if (controller.signal.aborted || generationRef.current !== generation) {
        return
      }

      setPhase('validating')
      const validated = await resolvedServices.validatePackage(exported.blob, {
        allowEdgeClipping:
          sampledFramingScale > LIVE_SD_FRAMING_SCALE_DEFAULT ||
          !isDefaultLiveSDFramingOffset(sampledFramingOffset),
      })
      if (controller.signal.aborted || generationRef.current !== generation) {
        return
      }

      const packageUrl = resolvedServices.createObjectUrl(exported.blob)
      const spritesheetUrl = resolvedServices.createObjectUrl(
        validated.spritesheet,
      )
      if (controller.signal.aborted || generationRef.current !== generation) {
        resolvedServices.revokeObjectUrl(packageUrl)
        resolvedServices.revokeObjectUrl(spritesheetUrl)
        return
      }

      const installCommand = recipeSource
        ? formatCodexPetRecipeInstallCommand(
            createCodexPetRecipe({
              source: recipeSource,
              globalMirrorX: sampledGlobalMirrorX,
              pet: {
                displayName,
                description,
                framingOffsetX: sampledFramingOffset.x,
                framingOffsetY: sampledFramingOffset.y,
                framingScale: sampledFramingScale,
                lookMovementScale: sampledLookMovementScale,
              },
              mappings: sampledMappings,
            }),
          )
        : null

      urlsRef.current = { packageUrl, spritesheetUrl }
      setResult({
        filename: exported.filename,
        installCommand,
        packageUrl,
        spritesheetUrl,
        validated,
      })
      setProgress(null)
      setPhase('ready')
      try {
        const nextCatalog = saveCodexPetSettingsPreset(
          {
            description,
            displayName,
            framingOffset: sampledFramingOffset,
            framingScale: sampledFramingScale,
            globalMirrorX: sampledGlobalMirrorX,
            lookMovementScale: sampledLookMovementScale,
            mappings: sampledMappings,
            source: resolvedPresetSource ?? null,
          },
          undefined,
          Date.now(),
          presetRuntime,
        )
        appliedPresetRef.current = {
          generation: presetLoadGeneration,
          name: nextCatalog.activePresetName,
        }
        updatePresetCatalog(nextCatalog)
      } catch {
        // Preset validation or persistence must not invalidate a valid package.
      }
    } catch (caughtError) {
      if (generationRef.current !== generation) {
        return
      }

      const nextError = toBuilderError(caughtError)
      setProgress(null)
      if (controller.signal.aborted || nextError.code === 'ABORTED') {
        setPhase('cancelled')
      } else {
        setError(nextError)
        setPhase('error')
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
      }
    }
  }

  const busy =
    phase === 'sampling' || phase === 'packaging' || phase === 'validating'
  const lookMovementPercent = Math.round(lookMovementScale * 100)

  const closeStarPrompt = useCallback(() => {
    setIsStarPromptOpen(false)
  }, [])
  const handleDownload = useCallback(() => {
    resolvedServices.trackDownload()
    if (!starPromptShownRef.current) {
      starPromptShownRef.current = true
      setIsStarPromptOpen(true)
    }
  }, [resolvedServices])

  const copyInstallCommand = async () => {
    if (!result?.installCommand || installCommandCopyPhase === 'copying') {
      return
    }
    setInstallCommandCopyPhase('copying')
    try {
      await resolvedServices.copyText(result.installCommand)
      setInstallCommandCopyPhase('copied')
    } catch {
      setInstallCommandCopyPhase('error')
    }
  }

  return (
    <section className="codex-pet-builder" aria-labelledby="codex-pet-builder-title">
      <div className="codex-pet-builder__header">
        <div>
          <p className="eyebrow">{t('builder.eyebrow')}</p>
          <h2 id="codex-pet-builder-title">{t('builder.title')}</h2>
          <p>{t('builder.description')}</p>
        </div>
        <div className="codex-pet-builder__header-actions">
          {controlledPresetCatalog === undefined ? (
            <label className="codex-pet-preset-selector">
              <span>{t('builder.preset')}</span>
              <select
                disabled={busy}
                onChange={(event) =>
                  changeActivePreset(event.target.value || null)
                }
                value={presetCatalog.activePresetName ?? ''}
              >
                <option value="">{t('builder.newSession')}</option>
                {Object.keys(presetCatalog.presets).map((presetName) => (
                  <option key={presetName} value={presetName}>
                    {presetName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {!source || !mappings ? (
        <div className="codex-pet-builder__empty">
          <strong>{t('builder.emptyTitle')}</strong>
          <p>{t('builder.emptyDescription')}</p>
        </div>
      ) : (
        <div className="codex-pet-builder__body">
          <div className="codex-pet-mapping-panel">
            <div className="codex-pet-section-heading">
              <div>
                <p className="toolbar-label">{t('builder.mappingEyebrow')}</p>
                <h3>{t('builder.mappingTitle')}</h3>
              </div>
              <span>{t('builder.animationCount', { count: animations.length })}</span>
            </div>
            <div className="codex-pet-mapping-grid">
              <label className="codex-pet-mirror-toggle codex-pet-mirror-toggle--global">
                <input
                  aria-label={t('builder.globalMirror')}
                  checked={globalMirrorX}
                  disabled={busy}
                  onChange={(event) => {
                    clearResult()
                    setPhase('idle')
                    setGlobalMirrorX(event.target.checked)
                  }}
                  type="checkbox"
                />
                {t('builder.globalMirror')}
              </label>
              {CODEX_PET_STATES.map((state) => {
                const copy = getCodexPetStateCopy(state.id, t)
                return (
                <div className="codex-pet-mapping-row" key={state.id}>
                  <div>
                    <strong>{copy.label}</strong>
                  </div>
                  <SearchableCombobox
                    className="codex-pet-state-animation"
                    disabled={busy}
                    id={`codex-pet-state-${state.id}-animation`}
                    label={t('builder.stateAnimation', {
                      state: copy.label,
                    })}
                    noResultsMessage={t('builder.noMatchingAnimations')}
                    onChange={(animationName) =>
                      updateAnimation(state.id, animationName)
                    }
                    onFocus={() =>
                      onPreviewAnimationChange?.(
                        mappings[state.id].animationName,
                        state.id,
                        mappings[state.id].mirrorX,
                      )
                    }
                    options={animationOptions}
                    placeholder={t('builder.stateAnimationSearch')}
                    queryResetKey={mappingQueryResetKey}
                    value={mappings[state.id].animationName}
                  />
                  {state.id === 'running-left' || state.id === 'running-right' ? (
                    <label className="codex-pet-mirror-toggle">
                      <input
                        aria-label={t('builder.stateMirror', {
                          state: copy.label,
                        })}
                        checked={mappings[state.id].mirrorX}
                        disabled={busy}
                        onChange={(event) =>
                          updateMirror(state.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      {t('builder.mirror')}
                    </label>
                  ) : (
                    <span className="codex-pet-mapping-row__description">
                      {copy.description}
                    </span>
                  )}
                </div>
                )
              })}
            </div>
          </div>

          <div className="codex-pet-package-panel">
            <div className="codex-pet-section-heading">
              <div>
                <p className="toolbar-label">{t('builder.packageEyebrow')}</p>
                <h3>{t('builder.packageTitle')}</h3>
              </div>
            </div>
            <div className="codex-pet-look-movement-control">
              <div className="codex-pet-look-movement-control__heading">
                <label htmlFor="codex-pet-look-movement-scale">
                  {t('builder.lookMovement')}
                </label>
                <output htmlFor="codex-pet-look-movement-scale">
                  {lookMovementPercent}%
                </output>
              </div>
              <input
                aria-label={t('builder.lookMovementSlider')}
                aria-valuetext={t('common.percentValue', {
                  value: lookMovementPercent,
                })}
                disabled={busy}
                id="codex-pet-look-movement-scale"
                max={CODEX_PET_LOOK_MOVEMENT_SCALE_MAX * 100}
                min={CODEX_PET_LOOK_MOVEMENT_SCALE_MIN * 100}
                onChange={(event) =>
                  updateLookMovementScale(Number(event.target.value) / 100)
                }
                step={CODEX_PET_LOOK_MOVEMENT_SCALE_STEP * 100}
                type="range"
                value={lookMovementPercent}
              />
              <div className="codex-pet-look-movement-control__footer">
                <small>{t('builder.lookMovementDescription')}</small>
                <button
                  disabled={
                    busy ||
                    lookMovementScale ===
                      CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT
                  }
                  onClick={() =>
                    updateLookMovementScale(
                      CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
                    )
                  }
                  type="button"
                >
                  {t('builder.reset100')}
                </button>
              </div>
            </div>
            <label className="codex-pet-field">
              <span>{t('builder.petName')}</span>
              <input
                disabled={busy}
                maxLength={80}
                onChange={(event) => {
                  clearResult()
                  setDisplayName(event.target.value)
                  setPhase('idle')
                }}
                required
                value={displayName}
              />
            </label>
            <label className="codex-pet-field">
              <span>{t('builder.petDescription')}</span>
              <textarea
                disabled={busy}
                maxLength={280}
                onChange={(event) => {
                  clearResult()
                  setDescription(event.target.value)
                  setPhase('idle')
                }}
                placeholder={t('builder.optional')}
                rows={3}
                value={description}
              />
            </label>

            <div
              aria-atomic="true"
              aria-live="polite"
              className={`codex-pet-export-status codex-pet-export-status--${phase}`}
            >
              <strong>{t(PHASE_MESSAGE_KEYS[phase])}</strong>
              {progress ? (
                <>
                  <progress max={1} value={progress.fraction} />
                  <span>{progressText(progress)}</span>
                </>
              ) : null}
            </div>

            {error ? (
              <div className="notice notice--error" role="alert">
                <code>{error.code}</code>
                <p>{localizeErrorNotice(locale, t, error)}</p>
              </div>
            ) : null}

            <div className="codex-pet-export-actions">
              <button
                className="primary-action"
                disabled={busy || !displayName.trim()}
                onClick={() => void generatePackage()}
                type="button"
              >
                {t('builder.generate')}
              </button>
              {busy ? (
                <button
                  className="secondary-action"
                  onClick={cancelExport}
                  type="button"
                >
                  {t('builder.cancel')}
                </button>
              ) : null}
            </div>

            {result ? (
              <div className="codex-pet-download-card">
                <div>
                  <strong>{result.validated.manifest.displayName}</strong>
                  <code>{result.filename}</code>
                </div>
                <a
                  download={result.filename}
                  href={result.packageUrl}
                  onClick={handleDownload}
                  ref={downloadLinkRef}
                >
                  {t('builder.download')}
                </a>
                {result.installCommand ? (
                  <div className="codex-pet-command">
                    <label>
                      <span>{t('builder.installCommand')}</span>
                      <textarea
                        readOnly
                        rows={3}
                        value={result.installCommand}
                      />
                    </label>
                    <button
                      className="secondary-action"
                      disabled={installCommandCopyPhase === 'copying'}
                      onClick={() => void copyInstallCommand()}
                      type="button"
                    >
                      {t('builder.copyInstallCommand')}
                    </button>
                    <span
                      aria-live="polite"
                      className="codex-pet-command__copy-status"
                      role="status"
                    >
                      {installCommandCopyPhase === 'copied'
                        ? t('builder.installCommandCopied')
                        : installCommandCopyPhase === 'error'
                          ? t('builder.installCommandCopyFailed')
                          : ''}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {result ? (
            <CodexPetInstalledPreview
              manifest={result.validated.manifest}
              spritesheetUrl={result.spritesheetUrl}
            />
          ) : null}
        </div>
      )}
      <GitHubStarPrompt
        isOpen={isStarPromptOpen}
        onClose={closeStarPrompt}
        triggerRef={downloadLinkRef}
      />
    </section>
  )
}

const BUILDER_SOURCE_KEYS = new WeakMap<CodexPetBuilderSource, number>()
let nextBuilderSourceKey = 1

function getBuilderSourceKey(source: CodexPetBuilderSource | null): string {
  if (!source) {
    return 'empty'
  }

  let key = BUILDER_SOURCE_KEYS.get(source)
  if (key === undefined) {
    key = nextBuilderSourceKey
    nextBuilderSourceKey += 1
    BUILDER_SOURCE_KEYS.set(source, key)
  }
  return String(key)
}

export function CodexPetBuilder(props: CodexPetBuilderProps) {
  const instanceKey = `${props.presetRuntime ?? 'prsk'}:${getBuilderSourceKey(props.source)}:${JSON.stringify(props.animations)}:${props.defaultGlobalMirrorX ?? false}:${JSON.stringify(props.defaultStateAnimationNames ?? {})}:${JSON.stringify(props.defaultStateMirrorX ?? {})}`
  return <CodexPetBuilderContent key={instanceKey} {...props} />
}
