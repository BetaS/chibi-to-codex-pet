import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import {
  localizeErrorNotice,
  useI18n,
  type MessageKey,
  type TranslationValues,
} from '../../../i18n'
import {
  liveSD36Adapter,
  type LiveSDLookTarget,
  type LiveSDPreviewSession,
} from '../adapter'
import {
  prskCharacterArchiveImporter,
} from './archive'
import type { LiveSDAtlasBundle } from '../model'
import {
  loadSharedSkeleton,
} from '../input/sharedSkeleton'
import {
  findPrskRemoteModelSelection,
  groupPrskRemoteCharacterModels,
  prskCharacterUnitSearchTerms,
  PrskRemoteError,
  prskRemoteCatalogSource,
  prskRemoteResourceSource,
  resolvePrskRemoteProvider,
  type PrskRemoteCatalog,
} from './remote'
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from '../ui/SearchableCombobox'
import { LiveSDFramingControls } from '../ui/LiveSDFramingControls'
import {
  toPreviewUiNotice,
  type PreviewUiNotice,
} from '../ui/previewError'
import {
  LIVE_SD_FRAMING_SCALE_DEFAULT,
} from '../rendering/framingScale'
import {
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  type LiveSDFramingOffset,
} from '../rendering/framingOffset'
import { normalizeLiveSDLookTarget } from '../rendering/lookTarget'
import {
  SPINE_36_RUNTIME_LICENSE_URL,
  SPINE_36_RUNTIME_NOTICES_URL,
} from '../runtime/runtimeLoader'
import { CodexPetBuilder } from '../../codex-pet/CodexPetBuilder'
import { CodexPetPresetLoader } from '../../codex-pet/CodexPetPresetLoader'
import { CodexPetStateShortcuts } from '../../codex-pet/CodexPetStateShortcuts'
import {
  resolveCodexPetMirrorX,
  type CodexPetAnimationMappings,
} from '../../codex-pet/animationMapping'
import type { CodexPetStateId } from '../../codex-pet/contract'
import { CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT } from '../../codex-pet/lookMovementScale'
import type { CodexPetRecipeSource } from '../../codex-pet/recipe'
import type { CodexPetSettingsPresetSource } from '../../codex-pet/settingsPresets'
import { useCodexPetPresetSession } from '../../codex-pet/useCodexPetPresetSession'
import { toPrskPreviewUiNotice } from './previewError'

const PRSK_DEFAULT_STATE_MIRROR_X = Object.freeze({
  'running-right': true,
  'running-left': false,
})

type AppPhase = 'error' | 'idle' | 'importing' | 'loading' | 'ready'
type CatalogPhase = 'error' | 'idle' | 'loading' | 'ready'
export type PrskResourceSource = 'provided' | 'upload' | 'custom'

interface AppStatus {
  readonly phase: AppPhase
  readonly messageKey: MessageKey
  readonly values?: TranslationValues
}

interface PreviewViewModel {
  readonly animations: readonly string[]
  readonly currentAnimation: string
  readonly sourceName: string
  readonly version: string
}

type PrskRecipeSource = Extract<
  CodexPetRecipeSource,
  { readonly provider: 'custom' | 'prsk-chibi-viewer' }
>

function isPrskRecipeSource(
  source: CodexPetSettingsPresetSource | null,
): source is PrskRecipeSource {
  return source !== null && (
    source.provider === 'custom' ||
    source.provider === 'prsk-chibi-viewer'
  )
}

function recipeSourceKey(source: PrskRecipeSource | null | undefined): string {
  if (!source) {
    return ''
  }
  if (source.provider === 'custom') {
    return `${source.provider}:${source.assetBaseUrl}:${source.characterId}`
  }
  return `${source.provider}:${source.characterId}`
}

export interface ActiveLiveSDSource {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly defaultDisplayName?: string
  readonly recipeSource?: PrskRecipeSource
  readonly skeletonData: ArrayBuffer
}

export function PrskIntegration() {
  const { locale, t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewFrameRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const sessionErrorUnsubscribeRef = useRef<(() => void) | null>(null)
  const sessionRef = useRef<LiveSDPreviewSession | null>(null)
  const catalogRequestRef = useRef<AbortController | null>(null)
  const modelRequestRef = useRef<AbortController | null>(null)
  const catalogGenerationRef = useRef(0)
  const modelGenerationRef = useRef(0)
  const previewGenerationRef = useRef(0)
  const previewLookTargetRef = useRef<LiveSDLookTarget | null>(null)
  const previewLookMovementScaleRef = useRef(
    CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
  )
  const codexPetMappingsRef =
    useRef<Readonly<CodexPetAnimationMappings> | null>(null)
  const activePreviewStateIdRef = useRef<CodexPetStateId | null>(null)
  const codexPetGlobalMirrorXRef = useRef(false)

  const [resourceSource, setResourceSource] =
    useState<PrskResourceSource>('provided')
  const presetSession = useCodexPetPresetSession('prsk')
  const [archiveFile, setArchiveFile] = useState<File | null>(null)
  const [skeletonFile, setSkeletonFile] = useState<File | null>(null)
  const [localBusy, setLocalBusy] = useState(false)
  const [error, setError] = useState<PreviewUiNotice | null>(null)
  const [preview, setPreview] = useState<PreviewViewModel | null>(null)
  const [framingScale, setFramingScale] = useState(
    LIVE_SD_FRAMING_SCALE_DEFAULT,
  )
  const [framingOffset, setFramingOffset] = useState<LiveSDFramingOffset>(
    LIVE_SD_FRAMING_OFFSET_DEFAULT,
  )
  const [activeSource, setActiveSource] =
    useState<ActiveLiveSDSource | null>(null)
  const [codexPetMappings, setCodexPetMappings] =
    useState<Readonly<CodexPetAnimationMappings> | null>(null)
  const [activePreviewStateId, setActivePreviewStateId] =
    useState<CodexPetStateId | null>(null)

  const [remoteBaseUrl, setRemoteBaseUrl] = useState('')
  const [remoteCatalog, setRemoteCatalog] =
    useState<PrskRemoteCatalog | null>(null)
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>('idle')
  const [catalogError, setCatalogError] =
    useState<PreviewUiNotice | null>(null)
  const [selectedCharacterKey, setSelectedCharacterKey] =
    useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] =
    useState<string | null>(null)
  const [remoteModelBusy, setRemoteModelBusy] = useState(false)
  const [characterQueryResetKey, setCharacterQueryResetKey] = useState(0)
  const [modelQueryResetKey, setModelQueryResetKey] = useState(0)
  const [animationQueryResetKey, setAnimationQueryResetKey] = useState(0)

  const [status, setStatus] = useState<AppStatus>({
    phase: 'idle',
    messageKey: 'prsk.status.providedSelected',
  })

  const activePreset = presetSession.appliedCatalog.activePresetName
    ? presetSession.appliedCatalog.presets[
        presetSession.appliedCatalog.activePresetName
      ]
    : undefined
  const presetSource = activePreset?.source ?? null
  const activePresetSource = isPrskRecipeSource(presetSource)
    ? presetSource
    : null
  const activePresetSourceKey = recipeSourceKey(activePresetSource)
  const activeSourceKey = recipeSourceKey(activeSource?.recipeSource)

  const characterGroups = useMemo(
    () => groupPrskRemoteCharacterModels(
      remoteCatalog?.characters ?? [],
      locale,
    ),
    [locale, remoteCatalog],
  )
  const characterOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      characterGroups.map(({ key, label, section }) => ({
        group: {
          key: section.key,
          label: section.label,
          searchTerms: prskCharacterUnitSearchTerms(section.key),
        },
        label,
        value: key,
      })),
    [characterGroups],
  )
  const selectedCharacterGroup = useMemo(
    () => characterGroups.find(
      (group) => group.key === selectedCharacterKey,
    ) ?? null,
    [characterGroups, selectedCharacterKey],
  )
  const modelOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      selectedCharacterGroup?.models.map(({ id, label }) => ({
        label,
        value: id,
      })) ?? [],
    [selectedCharacterGroup],
  )
  const animationOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      preview?.animations.map((animation) => ({
        label: animation,
        value: animation,
      })) ?? [],
    [preview],
  )
  const localizedError = error
    ? localizeErrorNotice(locale, t, error)
    : null
  const localizedCatalogError = catalogError
    ? localizeErrorNotice(locale, t, catalogError)
    : null
  const statusMessage = status.phase === 'error' && error
    ? localizeErrorNotice(locale, t, error)
    : t(status.messageKey, status.values)

  const toNotice = useCallback(
    (caughtError: unknown) =>
      toPreviewUiNotice(caughtError, toPrskPreviewUiNotice),
    [],
  )

  const abortRemoteRequests = useCallback(() => {
    catalogRequestRef.current?.abort()
    catalogRequestRef.current = null
    modelRequestRef.current?.abort()
    modelRequestRef.current = null
  }, [])

  const invalidateRemoteCatalog = useCallback(() => {
    abortRemoteRequests()
    catalogGenerationRef.current += 1
    modelGenerationRef.current += 1
    previewGenerationRef.current += 1
    setRemoteCatalog(null)
    setSelectedCharacterKey(null)
    setSelectedModelId(null)
    setCatalogPhase('idle')
    setCatalogError(null)
    setRemoteModelBusy(false)
    setCharacterQueryResetKey((key) => key + 1)
    setModelQueryResetKey((key) => key + 1)
  }, [abortRemoteRequests])

  const activateSession = useCallback((
    nextSession: LiveSDPreviewSession,
    source: ActiveLiveSDSource,
    operationGeneration: number,
  ): boolean => {
    if (
      !mountedRef.current ||
      previewGenerationRef.current !== operationGeneration
    ) {
      nextSession.dispose()
      return false
    }

    try {
      nextSession.setFramingOffset(LIVE_SD_FRAMING_OFFSET_DEFAULT)
      nextSession.setFramingScale(LIVE_SD_FRAMING_SCALE_DEFAULT)
      nextSession.setMirrorX(false)
    } catch (error) {
      nextSession.dispose()
      throw error
    }

    const previousSession = sessionRef.current
    const previousUnsubscribe = sessionErrorUnsubscribeRef.current
    const nextUnsubscribe = nextSession.onError((sessionError) => {
      if (!mountedRef.current || sessionRef.current !== nextSession) {
        return
      }

      sessionErrorUnsubscribeRef.current?.()
      sessionErrorUnsubscribeRef.current = null
      sessionRef.current = null
      const notice = toNotice(sessionError)
      setPreview(null)
      codexPetMappingsRef.current = null
      activePreviewStateIdRef.current = null
      codexPetGlobalMirrorXRef.current = false
      setCodexPetMappings(null)
      setActivePreviewStateId(null)
      setActiveSource(null)
      setAnimationQueryResetKey((key) => key + 1)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    })

    sessionRef.current = nextSession
    sessionErrorUnsubscribeRef.current = nextUnsubscribe
    previousUnsubscribe?.()
    previousSession?.dispose()
    previewLookTargetRef.current = null
    previewLookMovementScaleRef.current =
      CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT
    codexPetMappingsRef.current = null
    activePreviewStateIdRef.current = null
    codexPetGlobalMirrorXRef.current = false
    setFramingScale(LIVE_SD_FRAMING_SCALE_DEFAULT)
    setFramingOffset(LIVE_SD_FRAMING_OFFSET_DEFAULT)
    setCodexPetMappings(null)
    setActivePreviewStateId(null)
    setActiveSource(source)
    setPreview({
      animations: nextSession.animations,
      currentAnimation: nextSession.currentAnimation,
      sourceName: source.atlasBundle.sourceName,
      version: nextSession.version,
    })
    setAnimationQueryResetKey((key) => key + 1)
    setError(null)
    setStatus({
      phase: 'ready',
      messageKey: 'prsk.status.previewPlaying',
      values: { source: source.atlasBundle.sourceName },
    })
    return true
  }, [toNotice])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      previewGenerationRef.current += 1
      abortRemoteRequests()
      sessionErrorUnsubscribeRef.current?.()
      sessionErrorUnsubscribeRef.current = null
      sessionRef.current?.dispose()
      sessionRef.current = null
    }
  }, [abortRemoteRequests])

  useEffect(() => {
    const canvas = canvasRef.current
    const previewFrame = previewFrameRef.current
    if (!canvas || !previewFrame || !preview) {
      return
    }

    const resize = () => {
      sessionRef.current?.resize(
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
  }, [preview])

  const handleSkeletonChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSkeletonFile(event.target.files?.[0] ?? null)
    setError(null)
  }

  const handleArchiveChange = (event: ChangeEvent<HTMLInputElement>) => {
    setArchiveFile(event.target.files?.[0] ?? null)
    setError(null)
  }

  const importLocalPreview = useCallback(async (
    selectedArchive: File | null,
    selectedSkeleton: File | null,
  ) => {
    const canvas = canvasRef.current
    if (!canvas || !selectedArchive || !selectedSkeleton) {
      return
    }

    modelRequestRef.current?.abort()
    modelRequestRef.current = null
    modelGenerationRef.current += 1
    const operationGeneration = previewGenerationRef.current + 1
    previewGenerationRef.current = operationGeneration
    setLocalBusy(true)
    setError(null)
    setStatus({
      phase: 'importing',
      messageKey: 'prsk.status.inspectArchive',
    })

    try {
      const atlasBundle = await prskCharacterArchiveImporter.import(
        selectedArchive,
      )

      if (
        !mountedRef.current ||
        previewGenerationRef.current !== operationGeneration
      ) {
        return
      }

      setStatus({
        phase: 'importing',
        messageKey: 'prsk.status.inspectSkeleton',
      })
      const skeletonData = await loadSharedSkeleton(selectedSkeleton)
      liveSD36Adapter.inspectSkeleton(skeletonData)

      if (
        !mountedRef.current ||
        previewGenerationRef.current !== operationGeneration
      ) {
        return
      }

      setStatus({
        phase: 'loading',
        messageKey: 'prsk.status.createPreview',
      })
      const nextSession = await liveSD36Adapter.createPreview({
        atlasBundle,
        canvas,
        skeletonData,
      })
      activateSession(
        nextSession,
        { atlasBundle, skeletonData },
        operationGeneration,
      )
    } catch (caughtError) {
      if (
        !mountedRef.current ||
        previewGenerationRef.current !== operationGeneration
      ) {
        return
      }

      const notice = toNotice(caughtError)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    } finally {
      if (
        mountedRef.current &&
        previewGenerationRef.current === operationGeneration
      ) {
        setLocalBusy(false)
      }
    }
  }, [activateSession, toNotice])

  const handleResourceSourceChange = (nextSource: PrskResourceSource) => {
    if (nextSource === resourceSource) {
      return
    }

    abortRemoteRequests()
    catalogGenerationRef.current += 1
    modelGenerationRef.current += 1
    previewGenerationRef.current += 1
    setResourceSource(nextSource)
    setLocalBusy(false)
    setRemoteModelBusy(false)
    setRemoteCatalog(null)
    setSelectedCharacterKey(null)
    setSelectedModelId(null)
    setCatalogPhase('idle')
    setCatalogError(null)
    setCharacterQueryResetKey((key) => key + 1)
    setModelQueryResetKey((key) => key + 1)
    setAnimationQueryResetKey((key) => key + 1)
    setError(null)
    setStatus({
      phase: sessionRef.current ? 'ready' : 'idle',
      messageKey:
        nextSource === 'upload'
          ? 'prsk.status.prepareUpload'
          : nextSource === 'provided'
            ? 'prsk.status.providedSelected'
            : 'prsk.status.prepareCustom',
    })
  }

  const handleRemoteBaseUrlChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    invalidateRemoteCatalog()
    setRemoteBaseUrl(event.target.value)
    setError(null)
  }

  const loadRemoteCatalog = async () => {
    if (
      presetSession.selectedPresetName !== null ||
      resourceSource === 'upload' ||
      catalogPhase === 'loading'
    ) {
      return
    }

    let provider
    try {
      provider = resolvePrskRemoteProvider(
        resourceSource === 'provided'
          ? { kind: 'prsk-chibi-viewer' }
          : { kind: 'custom', assetBaseUrl: remoteBaseUrl },
        { development: import.meta.env.DEV },
      )
    } catch (caughtError) {
      const notice = toNotice(caughtError)
      setCatalogPhase('error')
      setCatalogError(notice)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
      return
    }

    const selectedCharacterBeforeReload = selectedCharacterKey
    const selectedModelBeforeReload = selectedModelId
    catalogRequestRef.current?.abort()
    modelRequestRef.current?.abort()
    modelRequestRef.current = null
    const controller = new AbortController()
    catalogRequestRef.current = controller
    const catalogGeneration = catalogGenerationRef.current + 1
    catalogGenerationRef.current = catalogGeneration
    modelGenerationRef.current += 1
    previewGenerationRef.current += 1
    setRemoteCatalog(null)
    setSelectedCharacterKey(null)
    setSelectedModelId(null)
    setRemoteModelBusy(false)
    setCatalogPhase('loading')
    setCatalogError(null)
    setCharacterQueryResetKey((key) => key + 1)
    setModelQueryResetKey((key) => key + 1)
    setError(null)
    setStatus({
      phase: 'loading',
      messageKey: 'prsk.status.loadCatalog',
    })

    try {
      const catalog = await prskRemoteCatalogSource.load({
        provider,
        signal: controller.signal,
      })
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        catalogGenerationRef.current !== catalogGeneration
      ) {
        return
      }

      const nextCharacterGroups = groupPrskRemoteCharacterModels(
        catalog.characters,
        locale,
      )
      const retainedModelSelection = selectedModelBeforeReload
        ? findPrskRemoteModelSelection(
            nextCharacterGroups,
            selectedModelBeforeReload,
          )
        : null
      const retainedCharacterKey = retainedModelSelection?.character.key ?? (
        selectedCharacterBeforeReload && nextCharacterGroups.some(
          (group) => group.key === selectedCharacterBeforeReload,
        )
          ? selectedCharacterBeforeReload
          : null
      )

      setRemoteCatalog(catalog)
      setSelectedCharacterKey(retainedCharacterKey)
      setSelectedModelId(retainedModelSelection?.model.id ?? null)
      setCatalogPhase('ready')
      setStatus({
        phase: sessionRef.current ? 'ready' : 'idle',
        messageKey: 'prsk.status.catalogReady',
        values: { count: nextCharacterGroups.length },
      })
    } catch (caughtError) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        catalogGenerationRef.current !== catalogGeneration
      ) {
        return
      }

      const notice = toNotice(caughtError)
      setCatalogPhase('error')
      setCatalogError(notice)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    } finally {
      if (
        catalogRequestRef.current === controller &&
        catalogGenerationRef.current === catalogGeneration
      ) {
        catalogRequestRef.current = null
      }
    }
  }

  const selectRemoteCharacter = useCallback((characterKey: string) => {
    if (!characterGroups.some((group) => group.key === characterKey)) {
      const notice = toNotice(new PrskRemoteError(
        'REMOTE_SELECTION_INVALID',
        'The selected character is not present in the current catalog.',
        { resource: 'catalog' },
      ))
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
      return
    }

    modelRequestRef.current?.abort()
    modelRequestRef.current = null
    modelGenerationRef.current += 1
    previewGenerationRef.current += 1
    setSelectedCharacterKey(characterKey)
    setSelectedModelId(null)
    setRemoteModelBusy(false)
    setModelQueryResetKey((key) => key + 1)
    setError(null)
  }, [characterGroups, toNotice])

  const loadRemoteModel = useCallback(async (modelId: string) => {
    const canvas = canvasRef.current
    const catalog = remoteCatalog
    if (!canvas || !catalog || resourceSource === 'upload') {
      return
    }
    const modelChoice = selectedCharacterGroup?.models.find(
      (model) => model.id === modelId,
    )
    if (!modelChoice) {
      const notice = toNotice(new PrskRemoteError(
        'REMOTE_SELECTION_INVALID',
        'The selected model does not belong to the current character.',
        { resource: 'catalog' },
      ))
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
      return
    }

    modelRequestRef.current?.abort()
    const controller = new AbortController()
    modelRequestRef.current = controller
    const modelGeneration = modelGenerationRef.current + 1
    modelGenerationRef.current = modelGeneration
    const operationGeneration = previewGenerationRef.current + 1
    previewGenerationRef.current = operationGeneration
    setSelectedModelId(modelId)
    setRemoteModelBusy(true)
    setError(null)
    setStatus({
      phase: 'loading',
      messageKey: 'prsk.status.loadModel',
      values: { character: modelChoice.label },
    })

    try {
      const input = await prskRemoteResourceSource.load({
        catalog,
        characterId: modelId,
        signal: controller.signal,
      })
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        modelGenerationRef.current !== modelGeneration ||
        previewGenerationRef.current !== operationGeneration
      ) {
        return
      }

      liveSD36Adapter.inspectSkeleton(input.skeletonData)
      setStatus({
        phase: 'loading',
        messageKey: 'prsk.status.parseSkeleton',
        values: { character: modelChoice.label },
      })
      const nextSession = await liveSD36Adapter.createPreview({
        atlasBundle: input.atlasBundle,
        canvas,
        skeletonData: input.skeletonData,
      })
      const recipeSource: PrskRecipeSource =
        resourceSource === 'provided'
          ? {
              provider: 'prsk-chibi-viewer',
              characterId: modelId,
            }
          : {
              provider: 'custom',
              assetBaseUrl: catalog.assetBaseUrl,
              characterId: modelId,
            }
      const activated = activateSession(
        nextSession,
        {
          atlasBundle: input.atlasBundle,
          defaultDisplayName: modelChoice.defaultDisplayName,
          recipeSource,
          skeletonData: input.skeletonData,
        },
        operationGeneration,
      )
      if (activated) {
        setSelectedModelId(modelId)
        setCharacterQueryResetKey((key) => key + 1)
        setModelQueryResetKey((key) => key + 1)
      }
    } catch (caughtError) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        modelGenerationRef.current !== modelGeneration ||
        previewGenerationRef.current !== operationGeneration
      ) {
        return
      }

      const notice = toNotice(caughtError)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    } finally {
      if (
        mountedRef.current &&
        modelGenerationRef.current === modelGeneration
      ) {
        if (modelRequestRef.current === controller) {
          modelRequestRef.current = null
        }
        setRemoteModelBusy(false)
      }
    }
  }, [
    activateSession,
    remoteCatalog,
    resourceSource,
    selectedCharacterGroup,
    toNotice,
  ])

  const loadPresetRemoteSource = useCallback(async (
    recipeSource: PrskRecipeSource,
  ) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    let provider
    try {
      provider = resolvePrskRemoteProvider(
        recipeSource.provider === 'prsk-chibi-viewer'
          ? { kind: 'prsk-chibi-viewer' }
          : {
              kind: 'custom',
              assetBaseUrl: recipeSource.assetBaseUrl,
            },
        { development: import.meta.env.DEV },
      )
    } catch (caughtError) {
      const notice = toNotice(caughtError)
      setCatalogPhase('error')
      setCatalogError(notice)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
      return
    }

    abortRemoteRequests()
    const catalogController = new AbortController()
    catalogRequestRef.current = catalogController
    const catalogGeneration = catalogGenerationRef.current + 1
    catalogGenerationRef.current = catalogGeneration
    modelGenerationRef.current += 1
    const operationGeneration = previewGenerationRef.current + 1
    previewGenerationRef.current = operationGeneration
    const nextResourceSource =
      recipeSource.provider === 'prsk-chibi-viewer' ? 'provided' : 'custom'

    setResourceSource(nextResourceSource)
    setRemoteBaseUrl(
      recipeSource.provider === 'custom' ? recipeSource.assetBaseUrl : '',
    )
    setRemoteCatalog(null)
    setSelectedCharacterKey(null)
    setSelectedModelId(null)
    setCatalogPhase('loading')
    setCatalogError(null)
    setRemoteModelBusy(false)
    setCharacterQueryResetKey((key) => key + 1)
    setModelQueryResetKey((key) => key + 1)
    setError(null)
    setStatus({ phase: 'loading', messageKey: 'prsk.status.loadCatalog' })

    let modelController: AbortController | null = null
    let modelGeneration = modelGenerationRef.current
    try {
      const catalog = await prskRemoteCatalogSource.load({
        provider,
        signal: catalogController.signal,
      })
      if (
        !mountedRef.current ||
        catalogController.signal.aborted ||
        catalogGenerationRef.current !== catalogGeneration ||
        previewGenerationRef.current !== operationGeneration
      ) {
        return
      }

      if (catalogRequestRef.current === catalogController) {
        catalogRequestRef.current = null
      }
      const presetSelection = findPrskRemoteModelSelection(
        groupPrskRemoteCharacterModels(catalog.characters, locale),
        recipeSource.characterId,
      )
      setRemoteCatalog(catalog)
      setSelectedCharacterKey(presetSelection?.character.key ?? null)
      setSelectedModelId(presetSelection?.model.id ?? null)
      setCatalogPhase('ready')
      setCharacterQueryResetKey((key) => key + 1)
      setModelQueryResetKey((key) => key + 1)
      setStatus({
        phase: 'loading',
        messageKey: 'prsk.status.loadModel',
        values: {
          character: presetSelection?.model.label ?? recipeSource.characterId,
        },
      })

      modelController = new AbortController()
      modelRequestRef.current = modelController
      modelGeneration = modelGenerationRef.current + 1
      modelGenerationRef.current = modelGeneration
      setRemoteModelBusy(true)
      if (!presetSelection) {
        throw new PrskRemoteError(
          'REMOTE_SELECTION_INVALID',
          'The saved model is not present in the current catalog.',
          { resource: 'catalog' },
        )
      }
      const input = await prskRemoteResourceSource.load({
        catalog,
        characterId: recipeSource.characterId,
        signal: modelController.signal,
      })
      if (
        !mountedRef.current ||
        modelController.signal.aborted ||
        modelGenerationRef.current !== modelGeneration ||
        previewGenerationRef.current !== operationGeneration
      ) {
        return
      }

      liveSD36Adapter.inspectSkeleton(input.skeletonData)
      setStatus({
        phase: 'loading',
        messageKey: 'prsk.status.parseSkeleton',
        values: { character: presetSelection.model.label },
      })
      const nextSession = await liveSD36Adapter.createPreview({
        atlasBundle: input.atlasBundle,
        canvas,
        skeletonData: input.skeletonData,
      })
      const activated = activateSession(
        nextSession,
        {
          atlasBundle: input.atlasBundle,
          defaultDisplayName: presetSelection.model.defaultDisplayName,
          recipeSource,
          skeletonData: input.skeletonData,
        },
        operationGeneration,
      )
      if (activated) {
        setSelectedCharacterKey(presetSelection.character.key)
        setSelectedModelId(presetSelection.model.id)
        setCharacterQueryResetKey((key) => key + 1)
        setModelQueryResetKey((key) => key + 1)
      }
    } catch (caughtError) {
      if (
        !mountedRef.current ||
        catalogController.signal.aborted ||
        modelController?.signal.aborted ||
        catalogGenerationRef.current !== catalogGeneration ||
        previewGenerationRef.current !== operationGeneration
      ) {
        return
      }

      const notice = toNotice(caughtError)
      setCatalogPhase(modelController ? 'ready' : 'error')
      setCatalogError(modelController ? null : notice)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    } finally {
      if (catalogRequestRef.current === catalogController) {
        catalogRequestRef.current = null
      }
      if (modelController && modelRequestRef.current === modelController) {
        modelRequestRef.current = null
      }
      if (
        mountedRef.current &&
        modelGenerationRef.current === modelGeneration
      ) {
        setRemoteModelBusy(false)
      }
    }
  }, [abortRemoteRequests, activateSession, locale, toNotice])

  useEffect(() => {
    if (
      !activePresetSource ||
      !activePresetSourceKey ||
      activePresetSourceKey === activeSourceKey
    ) {
      return
    }
    const loadTimer = window.setTimeout(() => {
      void loadPresetRemoteSource(activePresetSource)
    }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [
    activePresetSource,
    activePresetSourceKey,
    activeSourceKey,
    loadPresetRemoteSource,
    presetSession.loadGeneration,
  ])

  const handlePresetSelectionChange = useCallback((
    presetName: string | null,
  ) => {
    if (presetName === null) {
      abortRemoteRequests()
      catalogGenerationRef.current += 1
      modelGenerationRef.current += 1
      previewGenerationRef.current += 1
      setCatalogPhase((current) =>
        current === 'loading' ? (remoteCatalog ? 'ready' : 'idle') : current,
      )
      setRemoteModelBusy(false)
    }
    presetSession.selectPreset(presetName)
  }, [abortRemoteRequests, presetSession, remoteCatalog])

  const handleLocalPreview = () => {
    if (
      localBusy ||
      resourceSource !== 'upload' ||
      !archiveFile ||
      !skeletonFile
    ) {
      return
    }

    void importLocalPreview(archiveFile, skeletonFile)
  }

  const playAnimation = useCallback((name: string) => {
    try {
      sessionRef.current?.play(name)
      setPreview((current) =>
        current ? { ...current, currentAnimation: name } : current,
      )
      setError(null)
    } catch (caughtError) {
      const notice = toNotice(caughtError)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    }
  }, [toNotice])

  const applyPreviewMirrorX = useCallback((mirrorX: boolean) => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    try {
      session.setMirrorX(mirrorX)
      setError(null)
    } catch (caughtError) {
      const notice = toNotice(caughtError)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    }
  }, [toNotice])

  const handleMappingsChange = useCallback((
    mappings: Readonly<CodexPetAnimationMappings> | null,
  ) => {
    codexPetMappingsRef.current = mappings
    setCodexPetMappings(mappings)
    if (mappings && sessionRef.current) {
      try {
        sessionRef.current.setAnimationMappings(mappings)
        setError(null)
      } catch (caughtError) {
        const notice = toNotice(caughtError)
        setError(notice)
        setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
        return
      }
    }
    const stateId = activePreviewStateIdRef.current
    if (!mappings || !stateId) {
      return
    }
    applyPreviewMirrorX(resolveCodexPetMirrorX(
      codexPetGlobalMirrorXRef.current,
      mappings[stateId].mirrorX,
    ))
  }, [applyPreviewMirrorX, toNotice])

  const handleGlobalMirrorXChange = useCallback((globalMirrorX: boolean) => {
    codexPetGlobalMirrorXRef.current = globalMirrorX
    const stateId = activePreviewStateIdRef.current
    const stateMirrorX = stateId
      ? codexPetMappingsRef.current?.[stateId].mirrorX ?? false
      : false
    applyPreviewMirrorX(resolveCodexPetMirrorX(
      globalMirrorX,
      stateMirrorX,
    ))
  }, [applyPreviewMirrorX])

  const playDirectAnimation = useCallback((name: string) => {
    activePreviewStateIdRef.current = null
    setActivePreviewStateId(null)
    applyPreviewMirrorX(codexPetGlobalMirrorXRef.current)
    playAnimation(name)
  }, [applyPreviewMirrorX, playAnimation])

  const playStateAnimation = useCallback((
    name: string,
    stateId: CodexPetStateId,
    stateMirrorX: boolean,
  ) => {
    activePreviewStateIdRef.current = stateId
    setActivePreviewStateId(stateId)
    applyPreviewMirrorX(resolveCodexPetMirrorX(
      codexPetGlobalMirrorXRef.current,
      stateMirrorX,
    ))
    playAnimation(name)
  }, [applyPreviewMirrorX, playAnimation])

  const applyPreviewLookTarget = useCallback((
    target: LiveSDLookTarget | null,
    movementScale = previewLookMovementScaleRef.current,
  ) => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    try {
      session.setLookTarget(target, movementScale)
      setError(null)
    } catch (caughtError) {
      const notice = toNotice(caughtError)
      setError(notice)
    }
  }, [toNotice])

  const handlePreviewPointerMove = useCallback((
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    if (!preview) {
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
    previewLookTargetRef.current = target
    applyPreviewLookTarget(target)
  }, [applyPreviewLookTarget, preview])

  const clearPreviewLookTarget = useCallback(() => {
    previewLookTargetRef.current = null
    applyPreviewLookTarget(null)
  }, [applyPreviewLookTarget])

  const updatePreviewLookMovementScale = useCallback((nextScale: number) => {
    previewLookMovementScaleRef.current = nextScale
    if (previewLookTargetRef.current) {
      applyPreviewLookTarget(previewLookTargetRef.current, nextScale)
    }
  }, [applyPreviewLookTarget])

  const applyBuilderFraming = useCallback((
    nextScale: number,
    nextOffset: LiveSDFramingOffset,
  ) => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    try {
      session.setFramingScale(nextScale)
      session.setFramingOffset(nextOffset)
      setFramingScale(nextScale)
      setFramingOffset(nextOffset)
      setError(null)
    } catch (caughtError) {
      const notice = toNotice(caughtError)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    }
  }, [toNotice])

  const updateFramingScale = (nextScale: number) => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    try {
      session.setFramingScale(nextScale)
      setFramingScale(nextScale)
      setError(null)
    } catch (caughtError) {
      const notice = toNotice(caughtError)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    }
  }

  const updateFramingOffset = (nextOffset: LiveSDFramingOffset) => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    try {
      session.setFramingOffset(nextOffset)
      setFramingOffset(nextOffset)
      setError(null)
    } catch (caughtError) {
      const notice = toNotice(caughtError)
      setError(notice)
      setStatus({ phase: 'error', messageKey: 'prsk.status.error' })
    }
  }

  const resetFraming = () => {
    updateFramingScale(LIVE_SD_FRAMING_SCALE_DEFAULT)
    updateFramingOffset(LIVE_SD_FRAMING_OFFSET_DEFAULT)
  }

  return (
    <>
      <div className="workspace-grid">
        <aside className="control-panel" aria-label={t('prsk.modelImport')}>
          <CodexPetPresetLoader
            busy={catalogPhase === 'loading' || remoteModelBusy || localBusy}
            catalog={presetSession.catalog}
            description={t('prsk.presetDescription')}
            onLoad={presetSession.loadSelectedPreset}
            onSelectionChange={handlePresetSelectionChange}
            selectedPresetName={presetSession.selectedPresetName}
            selectorTestId="resource-preset-selector"
          />

          <section className="panel-section source-mode-section">
            <div className="step-heading">
              <span>01</span>
              <div>
                <h2>{t('prsk.inputSource')}</h2>
                <p>{t('prsk.inputSourceDescription')}</p>
              </div>
            </div>
            <div
              className="source-mode-toggle"
              role="radiogroup"
              aria-label={t('prsk.inputSource')}
            >
              <label>
                <input
                  checked={resourceSource === 'provided'}
                  name="source-mode"
                  onChange={() => handleResourceSourceChange('provided')}
                  type="radio"
                  value="provided"
                />
                {t('prsk.sourceProvided')}
              </label>
              <label>
                <input
                  checked={resourceSource === 'upload'}
                  name="source-mode"
                  onChange={() => handleResourceSourceChange('upload')}
                  type="radio"
                  value="upload"
                />
                {t('prsk.sourceUpload')}
              </label>
              <label>
                <input
                  checked={resourceSource === 'custom'}
                  name="source-mode"
                  onChange={() => handleResourceSourceChange('custom')}
                  type="radio"
                  value="custom"
                />
                {t('prsk.sourceCustom')}
              </label>
            </div>
          </section>

          {resourceSource === 'upload' ? (
            <>
              <section className="panel-section">
                <div className="step-heading">
                  <span>02</span>
                  <div>
                    <h2>{t('prsk.sharedSkeleton')}</h2>
                    <p>{t('prsk.sharedSkeletonDescription')}</p>
                  </div>
                </div>
                <label className="file-picker">
                  <span>
                    {skeletonFile
                      ? t('prsk.fileSelected')
                      : t('prsk.selectSkel')}
                  </span>
                  <strong>
                    {skeletonFile?.name ?? t('prsk.sharedSkeletonFile')}
                  </strong>
                  <input
                    accept=".skel,application/octet-stream"
                    onChange={handleSkeletonChange}
                    type="file"
                  />
                </label>
              </section>

              <section className="panel-section">
                <div className="step-heading">
                  <span>03</span>
                  <div>
                    <h2>{t('prsk.characterZip')}</h2>
                    <p>{t('prsk.characterZipDescription')}</p>
                  </div>
                </div>
                <label className="file-picker">
                  <span>
                    {archiveFile
                      ? t('prsk.fileSelected')
                      : t('prsk.selectZip')}
                  </span>
                  <strong>
                    {archiveFile?.name ?? t('prsk.characterArchive')}
                  </strong>
                  <input
                    accept=".zip,application/zip"
                    onChange={handleArchiveChange}
                    type="file"
                  />
                </label>
                <p className="input-hint">
                  {t('prsk.archiveLimits')}
                </p>
              </section>

              <button
                className="primary-action"
                disabled={!archiveFile || !skeletonFile || localBusy}
                onClick={handleLocalPreview}
                type="button"
              >
                {localBusy ? t('prsk.preparing') : t('prsk.importPreview')}
              </button>
            </>
          ) : (
            <>
              <section className="panel-section">
                <div className="step-heading">
                  <span>02</span>
                  <div>
                    <h2>{t('prsk.resourceServer')}</h2>
                    <p>{t('prsk.resourceServerDescription')}</p>
                  </div>
                </div>
                {resourceSource === 'custom' ? (
                  <label className="remote-url-field">
                    <span>{t('prsk.assetBaseUrl')}</span>
                    <input
                      aria-label={t('prsk.remoteAssetBaseUrl')}
                      onChange={handleRemoteBaseUrlChange}
                      placeholder="https://provider.example/area_sd"
                      spellCheck="false"
                      type="url"
                      value={remoteBaseUrl}
                    />
                  </label>
                ) : (
                  <div className="provided-resource-card">
                    <strong>{t('prsk.sourceProvided')}</strong>
                    <p>{t('prsk.providedManifestDescription')}</p>
                  </div>
                )}
                {presetSession.selectedPresetName === null ? (
                  <div className="remote-actions">
                    <button
                      className="primary-action primary-action--compact"
                      data-provider-capability="catalog-load"
                      disabled={
                        catalogPhase === 'loading' ||
                        (resourceSource === 'custom' && !remoteBaseUrl.trim())
                      }
                      onClick={() => void loadRemoteCatalog()}
                      type="button"
                    >
                      {t('prsk.load')}
                    </button>
                  </div>
                ) : null}
                {catalogPhase === 'loading' ? (
                  <p className="input-hint" aria-live="polite">
                    {t('prsk.loadingResourceList')}
                  </p>
                ) : null}
                <div className="notice notice--warning remote-disclosure">
                  <p>
                    {t('prsk.remoteDisclosure')}
                  </p>
                </div>
              </section>

              <section className="panel-section remote-character-section">
                <div className="step-heading">
                  <span>03</span>
                  <div>
                    <h2>{t('prsk.character')}</h2>
                    <p>{t('prsk.characterDescription')}</p>
                  </div>
                </div>
                <SearchableCombobox
                  className="character-combobox"
                  disabled={catalogPhase !== 'ready'}
                  disabledMessage={t('prsk.loadListFirst')}
                  emptyMessage={t('prsk.noCharacters')}
                  error={localizedCatalogError}
                  id="remote-character"
                  label={t('prsk.characterSearch')}
                  loading={catalogPhase === 'loading'}
                  loadingMessage={t('prsk.loadingRemoteCatalog')}
                  onChange={selectRemoteCharacter}
                  options={characterOptions}
                  placeholder={t('prsk.characterSearchPlaceholder')}
                  providerCapability="character-selection"
                  queryResetKey={characterQueryResetKey}
                  value={selectedCharacterKey}
                />
                <SearchableCombobox
                  className="model-combobox"
                  disabled={
                    catalogPhase !== 'ready' || !selectedCharacterGroup
                  }
                  disabledMessage={t('prsk.selectCharacterFirst')}
                  emptyMessage={t('prsk.noModels')}
                  id="remote-model"
                  label={t('prsk.modelSearch')}
                  onChange={(modelId) => {
                    void loadRemoteModel(modelId)
                  }}
                  options={modelOptions}
                  placeholder={t('prsk.modelSearchPlaceholder')}
                  providerCapability="model-selection"
                  queryResetKey={modelQueryResetKey}
                  value={selectedModelId}
                />
                {remoteModelBusy ? (
                  <p className="input-hint" aria-live="polite">
                    {t('prsk.loadingSelectedModel')}
                  </p>
                ) : null}
              </section>
            </>
          )}

          <div
            className={`status-card status-card--${status.phase}`}
            aria-atomic="true"
            aria-live="polite"
          >
            <span className="status-card__dot" aria-hidden="true" />
            <div>
              <strong>
                {status.phase === 'ready'
                  ? t('prsk.previewReady')
                  : t('prsk.status')}
              </strong>
              <p>{statusMessage}</p>
            </div>
          </div>

          {error ? (
            <div className="notice notice--error" role="alert">
              <code>{error.code}</code>
              <p>{localizedError}</p>
            </div>
          ) : null}
        </aside>

        <section className="preview-panel" aria-labelledby="preview-title">
          <div className="preview-toolbar">
            <div>
              <p className="toolbar-label">{t('game.prsk')}</p>
              <h2 id="preview-title">
                {preview?.sourceName ?? t('prsk.characterPreview')}
              </h2>
            </div>
            <div className="preview-toolbar__controls">
              <LiveSDFramingControls
                disabled={!preview}
                framingOffset={framingOffset}
                framingScale={framingScale}
                onOffsetChange={updateFramingOffset}
                onReset={resetFraming}
                onScaleChange={updateFramingScale}
              />
              <div className="animation-picker">
                <SearchableCombobox
                  disabled={!preview}
                  disabledMessage={t('prsk.loadModelFirst')}
                  emptyMessage={t('prsk.noAnimations')}
                  id="animation-picker"
                  label={t('prsk.animation')}
                  onChange={playDirectAnimation}
                  options={animationOptions}
                  placeholder={t('prsk.animationSearch')}
                  providerCapability="animation-selection"
                  queryResetKey={animationQueryResetKey}
                  value={preview?.currentAnimation ?? null}
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
              data-testid="livesd-preview-border-box"
              ref={previewFrameRef}
            >
              <span className="preview-border-label">{t('prsk.outputFrame')}</span>
              <canvas
                aria-label={t('prsk.canvasLabel')}
                data-provider-capability="preview"
                onPointerCancel={clearPreviewLookTarget}
                onPointerLeave={clearPreviewLookTarget}
                onPointerMove={handlePreviewPointerMove}
                ref={canvasRef}
              />
            </div>
            {!preview ? (
              <div className="preview-empty">
                <span aria-hidden="true">◇</span>
                <strong>{t('prsk.noCharacter')}</strong>
                <p>{t('prsk.noCharacterHint')}</p>
              </div>
            ) : (
              <div className="preview-meta">
                <span>LiveSD {preview.version}</span>
                <span>{preview.currentAnimation}</span>
              </div>
            )}
          </div>
        </section>

        <CodexPetBuilder
          animations={preview?.animations ?? []}
          defaultStateMirrorX={PRSK_DEFAULT_STATE_MIRROR_X}
          framingOffset={framingOffset}
          framingScale={framingScale}
          onFramingChange={applyBuilderFraming}
          onGlobalMirrorXChange={handleGlobalMirrorXChange}
          onMappingsChange={handleMappingsChange}
          onPresetCatalogChange={presetSession.updateCatalog}
          onPreviewAnimationChange={playStateAnimation}
          onPreviewLookMovementScaleChange={
            updatePreviewLookMovementScale
          }
          recipeSource={activeSource?.recipeSource ?? null}
          presetCatalog={presetSession.appliedCatalog}
          presetLoadGeneration={presetSession.loadGeneration}
          presetRuntime="prsk"
          source={activeSource}
        />
      </div>

      <footer className="app-footer">
        <p>
          {t('prsk.footerPrivacy')}
        </p>
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
