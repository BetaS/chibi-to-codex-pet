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
  DEVELOPMENT_SKELETON_PATH,
  loadDevelopmentCharacterPack,
  loadDevelopmentSharedSkeleton,
} from './development'
import {
  PJSEK_AI_ASSET_BASE_URL,
  PRSK_CHIBI_VIEWER_CATALOG_URL,
  prskRemoteCatalogSource,
  prskRemoteResourceSource,
  resolvePrskRemoteProvider,
  type PrskRemoteCatalog,
} from './remote'
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from '../ui/SearchableCombobox'
import {
  toPreviewUiNotice,
  type PreviewUiNotice,
} from '../ui/previewError'
import {
  LIVE_SD_FRAMING_SCALE_DEFAULT,
  LIVE_SD_FRAMING_SCALE_MAX,
  LIVE_SD_FRAMING_SCALE_MIN,
  LIVE_SD_FRAMING_SCALE_STEP,
} from '../rendering/framingScale'
import {
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  LIVE_SD_FRAMING_OFFSET_STEP,
  LIVE_SD_FRAMING_OFFSET_X_MAX,
  LIVE_SD_FRAMING_OFFSET_X_MIN,
  LIVE_SD_FRAMING_OFFSET_Y_MAX,
  LIVE_SD_FRAMING_OFFSET_Y_MIN,
  type LiveSDFramingOffset,
} from '../rendering/framingOffset'
import { normalizeLiveSDLookTarget } from '../rendering/lookTarget'
import {
  SPINE_36_RUNTIME_LICENSE_URL,
  SPINE_36_RUNTIME_NOTICES_URL,
} from '../runtime/runtimeLoader'
import { CodexPetBuilder } from '../../codex-pet/CodexPetBuilder'
import { CodexPetStateShortcuts } from '../../codex-pet/CodexPetStateShortcuts'
import {
  resolveCodexPetMirrorX,
  type CodexPetAnimationMappings,
} from '../../codex-pet/animationMapping'
import type { CodexPetStateId } from '../../codex-pet/contract'
import { CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT } from '../../codex-pet/lookMovementScale'
import type { CodexPetRecipeSource } from '../../codex-pet/recipe'
import {
  readCodexPetSettingsPresetCatalog,
  selectCodexPetSettingsPreset,
  type CodexPetSettingsPresetCatalog,
} from '../../codex-pet/settingsPresets'
import { toPrskPreviewUiNotice } from './previewError'

const DEVELOPMENT_DEFAULTS_ENABLED =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
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

function recipeSourceKey(source: CodexPetRecipeSource | null | undefined): string {
  if (!source) {
    return ''
  }
  return source.provider === 'custom'
    ? `${source.provider}:${source.assetBaseUrl}:${source.characterId}`
    : `${source.provider}:${source.characterId}`
}

export interface ActiveLiveSDSource {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly recipeSource?: CodexPetRecipeSource
  readonly skeletonData: ArrayBuffer
}

function catalogTargetText(
  source: PrskResourceSource,
  baseUrl: string,
  catalog: PrskRemoteCatalog | null,
  emptyValue: string,
): string {
  if (catalog) {
    return catalog.requestOrigins.join(' · ')
  }

  if (source === 'provided') {
    return `${new URL(PRSK_CHIBI_VIEWER_CATALOG_URL).origin} · ${new URL(PJSEK_AI_ASSET_BASE_URL).origin}`
  }

  try {
    return new URL(baseUrl).origin
  } catch {
    return baseUrl.trim() || emptyValue
  }
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
  const [presetCatalog, setPresetCatalog] =
    useState<CodexPetSettingsPresetCatalog>(() =>
      readCodexPetSettingsPresetCatalog(),
    )
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
  const [selectedCharacterId, setSelectedCharacterId] =
    useState<string | null>(null)
  const [remoteModelBusy, setRemoteModelBusy] = useState(false)
  const [characterQueryResetKey, setCharacterQueryResetKey] = useState(0)
  const [animationQueryResetKey, setAnimationQueryResetKey] = useState(0)

  const [status, setStatus] = useState<AppStatus>({
    phase: 'idle',
    messageKey: 'prsk.status.providedSelected',
  })

  const activePreset = presetCatalog.activePresetName
    ? presetCatalog.presets[presetCatalog.activePresetName]
    : undefined
  const activePresetSource = activePreset?.source ?? null
  const activePresetSourceKey = recipeSourceKey(activePresetSource)
  const activeSourceKey = recipeSourceKey(activeSource?.recipeSource)

  const characterOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      remoteCatalog?.characters.map(({ id, label }) => ({
        label,
        value: id,
      })) ?? [],
    [remoteCatalog],
  )
  const animationOptions = useMemo<readonly SearchableComboboxOption[]>(
    () =>
      preview?.animations.map((animation) => ({
        label: animation,
        value: animation,
      })) ?? [],
    [preview],
  )
  const remoteTargetText = catalogTargetText(
    resourceSource,
    remoteBaseUrl,
    remoteCatalog,
    t('prsk.remoteTargetPlaceholder'),
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
    setSelectedCharacterId(null)
    setCatalogPhase('idle')
    setCatalogError(null)
    setRemoteModelBusy(false)
    setCharacterQueryResetKey((key) => key + 1)
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
    if (!canvas) {
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
      messageKey: selectedArchive
        ? 'prsk.status.inspectArchive'
        : 'prsk.status.readDevelopmentCharacter',
    })

    try {
      let atlasBundle
      if (selectedArchive) {
        atlasBundle = await prskCharacterArchiveImporter.import(selectedArchive)
      } else if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
        atlasBundle = await loadDevelopmentCharacterPack()
      } else {
        throw new Error('Production local preview requires an archive file.')
      }

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
      const skeletonData = await loadSharedSkeleton(
        selectedSkeleton,
        DEVELOPMENT_DEFAULTS_ENABLED
          ? { fallback: () => loadDevelopmentSharedSkeleton() }
          : {},
      )
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
    setSelectedCharacterId(null)
    setCatalogPhase('idle')
    setCatalogError(null)
    setCharacterQueryResetKey((key) => key + 1)
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
    if (resourceSource === 'upload' || catalogPhase === 'loading') {
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

    const selectedCharacterBeforeReload = selectedCharacterId
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
    setSelectedCharacterId(null)
    setRemoteModelBusy(false)
    setCatalogPhase('loading')
    setCatalogError(null)
    setCharacterQueryResetKey((key) => key + 1)
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

      setRemoteCatalog(catalog)
      setSelectedCharacterId(
        selectedCharacterBeforeReload &&
          catalog.characters.some(
            (option) => option.id === selectedCharacterBeforeReload,
          )
          ? selectedCharacterBeforeReload
          : null,
      )
      setCatalogPhase('ready')
      setStatus({
        phase: sessionRef.current ? 'ready' : 'idle',
        messageKey: 'prsk.status.catalogReady',
        values: { count: catalog.characters.length },
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

  const loadRemoteCharacter = useCallback(async (characterId: string) => {
    const canvas = canvasRef.current
    const catalog = remoteCatalog
    if (!canvas || !catalog || resourceSource === 'upload') {
      return
    }

    modelRequestRef.current?.abort()
    const controller = new AbortController()
    modelRequestRef.current = controller
    const modelGeneration = modelGenerationRef.current + 1
    modelGenerationRef.current = modelGeneration
    const operationGeneration = previewGenerationRef.current + 1
    previewGenerationRef.current = operationGeneration
    setRemoteModelBusy(true)
    setError(null)
    setStatus({
      phase: 'loading',
      messageKey: 'prsk.status.loadModel',
      values: { character: characterId },
    })

    try {
      const input = await prskRemoteResourceSource.load({
        catalog,
        characterId,
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
        values: { character: characterId },
      })
      const nextSession = await liveSD36Adapter.createPreview({
        atlasBundle: input.atlasBundle,
        canvas,
        skeletonData: input.skeletonData,
      })
      const recipeSource: CodexPetRecipeSource =
        resourceSource === 'provided'
          ? {
              provider: 'prsk-chibi-viewer',
              characterId,
            }
          : {
              provider: 'custom',
              assetBaseUrl: catalog.assetBaseUrl,
              characterId,
            }
      const activated = activateSession(
        nextSession,
        {
          atlasBundle: input.atlasBundle,
          recipeSource,
          skeletonData: input.skeletonData,
        },
        operationGeneration,
      )
      if (activated) {
        setSelectedCharacterId(characterId)
        setCharacterQueryResetKey((key) => key + 1)
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
  }, [activateSession, remoteCatalog, resourceSource, toNotice])

  const loadPresetRemoteSource = useCallback(async (
    recipeSource: CodexPetRecipeSource,
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
    setSelectedCharacterId(null)
    setCatalogPhase('loading')
    setCatalogError(null)
    setRemoteModelBusy(false)
    setCharacterQueryResetKey((key) => key + 1)
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
      setRemoteCatalog(catalog)
      setSelectedCharacterId(recipeSource.characterId)
      setCatalogPhase('ready')
      setCharacterQueryResetKey((key) => key + 1)
      setStatus({
        phase: 'loading',
        messageKey: 'prsk.status.loadModel',
        values: { character: recipeSource.characterId },
      })

      modelController = new AbortController()
      modelRequestRef.current = modelController
      modelGeneration = modelGenerationRef.current + 1
      modelGenerationRef.current = modelGeneration
      setRemoteModelBusy(true)
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
        values: { character: recipeSource.characterId },
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
          recipeSource,
          skeletonData: input.skeletonData,
        },
        operationGeneration,
      )
      if (activated) {
        setSelectedCharacterId(recipeSource.characterId)
        setCharacterQueryResetKey((key) => key + 1)
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
  }, [abortRemoteRequests, activateSession, toNotice])

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
  ])

  const handlePresetSelectionChange = useCallback((
    presetName: string | null,
  ) => {
    abortRemoteRequests()
    catalogGenerationRef.current += 1
    modelGenerationRef.current += 1
    previewGenerationRef.current += 1
    setCatalogPhase((current) =>
      current === 'loading' ? (remoteCatalog ? 'ready' : 'idle') : current,
    )
    setRemoteModelBusy(false)
    setPresetCatalog(selectCodexPetSettingsPreset(presetName))
  }, [abortRemoteRequests, remoteCatalog])

  const handleLocalPreview = () => {
    if (localBusy || resourceSource !== 'upload') {
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

  const framingScalePercent = Math.round(framingScale * 100)

  return (
    <>
      <div className="workspace-grid">
        <aside className="control-panel" aria-label={t('prsk.modelImport')}>
          <section className="panel-section preset-selection-section">
            <div className="step-heading">
              <span>00</span>
              <div>
                <h2>{t('builder.preset')}</h2>
                <p>{t('prsk.presetDescription')}</p>
              </div>
            </div>
            <label className="codex-pet-preset-selector resource-preset-selector">
              <span>{t('builder.preset')}</span>
              <select
                data-testid="resource-preset-selector"
                onChange={(event) =>
                  handlePresetSelectionChange(event.target.value || null)
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
          </section>

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
                      : DEVELOPMENT_DEFAULTS_ENABLED
                        ? t('prsk.defaultLink')
                        : t('prsk.selectSkel')}
                  </span>
                  <strong>
                    {skeletonFile?.name ??
                      (DEVELOPMENT_DEFAULTS_ENABLED
                        ? 'base_model/sekai_skeleton.skel'
                        : t('prsk.sharedSkeletonFile'))}
                  </strong>
                  <input
                    accept=".skel,application/octet-stream"
                    onChange={handleSkeletonChange}
                    type="file"
                  />
                </label>
                {DEVELOPMENT_DEFAULTS_ENABLED && !skeletonFile ? (
                  <p className="input-hint">
                    {t('prsk.developmentSkeletonHint', {
                      path: DEVELOPMENT_SKELETON_PATH,
                    })}
                  </p>
                ) : null}
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
                      : DEVELOPMENT_DEFAULTS_ENABLED
                        ? t('prsk.defaultLink')
                        : t('prsk.selectZip')}
                  </span>
                  <strong>
                    {archiveFile?.name ??
                      (DEVELOPMENT_DEFAULTS_ENABLED
                        ? t('prsk.defaultCharacterFiles')
                        : t('prsk.characterArchive'))}
                  </strong>
                  <input
                    accept=".zip,application/zip"
                    onChange={handleArchiveChange}
                    type="file"
                  />
                </label>
                <p className="input-hint">
                  {DEVELOPMENT_DEFAULTS_ENABLED && !archiveFile
                    ? t('prsk.developmentArchiveHint')
                    : t('prsk.archiveLimits')}
                </p>
              </section>

              <button
                className="primary-action"
                disabled={
                  ((!archiveFile || !skeletonFile) &&
                    !DEVELOPMENT_DEFAULTS_ENABLED) ||
                  localBusy
                }
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
                    <strong>prsk-chibi-viewer manifest</strong>
                    <p>{t('prsk.providedManifestDescription')}</p>
                  </div>
                )}
                <div className="remote-actions">
                  <button
                    className="primary-action primary-action--compact"
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
                {catalogPhase === 'loading' ? (
                  <p className="input-hint" aria-live="polite">
                    {t('prsk.loadingResourceList')}
                  </p>
                ) : null}
                <p className="remote-origin">
                  <strong>{t('prsk.requestTargets')}</strong>
                  <code>{remoteTargetText}</code>
                </p>
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
                  onChange={(characterId) => {
                    void loadRemoteCharacter(characterId)
                  }}
                  options={characterOptions}
                  placeholder={t('prsk.characterSearchPlaceholder')}
                  queryResetKey={characterQueryResetKey}
                  value={selectedCharacterId}
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
              <p className="toolbar-label">WebGL preview</p>
              <h2 id="preview-title">
                {preview?.sourceName ?? t('prsk.characterPreview')}
              </h2>
            </div>
            <div className="preview-toolbar__controls">
              <fieldset
                className="framing-scale-control"
                disabled={!preview}
              >
                <legend>{t('prsk.framing')}</legend>
                <div className="framing-scale-control__input-row">
                  <label htmlFor="pet-framing-scale">{t('prsk.petSize')}</label>
                  <input
                    aria-label={t('prsk.petSizeSlider')}
                    aria-valuetext={t('common.percentValue', {
                      value: framingScalePercent,
                    })}
                    id="pet-framing-scale"
                    max={LIVE_SD_FRAMING_SCALE_MAX * 100}
                    min={LIVE_SD_FRAMING_SCALE_MIN * 100}
                    onChange={(event) =>
                      updateFramingScale(Number(event.target.value) / 100)
                    }
                    step={LIVE_SD_FRAMING_SCALE_STEP * 100}
                    type="range"
                    value={framingScalePercent}
                  />
                  <output htmlFor="pet-framing-scale">
                    {framingScalePercent}%
                  </output>
                </div>
                <div className="framing-scale-control__input-row">
                  <label htmlFor="pet-framing-offset-x">{t('prsk.offsetX')}</label>
                  <input
                    aria-label={t('prsk.offsetXSlider')}
                    aria-valuetext={t('common.pixelValue', {
                      value: framingOffset.x,
                    })}
                    id="pet-framing-offset-x"
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
                  <output htmlFor="pet-framing-offset-x">
                    {t('common.pixelValue', { value: framingOffset.x })}
                  </output>
                </div>
                <div className="framing-scale-control__input-row">
                  <label htmlFor="pet-framing-offset-y">{t('prsk.offsetY')}</label>
                  <input
                    aria-label={t('prsk.offsetYSlider')}
                    aria-valuetext={t('common.pixelValue', {
                      value: framingOffset.y,
                    })}
                    id="pet-framing-offset-y"
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
                  <output htmlFor="pet-framing-offset-y">
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
                  disabledMessage={t('prsk.loadModelFirst')}
                  emptyMessage={t('prsk.noAnimations')}
                  id="animation-picker"
                  label={t('prsk.animation')}
                  onChange={playDirectAnimation}
                  options={animationOptions}
                  placeholder={t('prsk.animationSearch')}
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
          onPresetCatalogChange={setPresetCatalog}
          onPreviewAnimationChange={playStateAnimation}
          onPreviewLookMovementScaleChange={
            updatePreviewLookMovementScale
          }
          recipeSource={activeSource?.recipeSource ?? null}
          presetCatalog={presetCatalog}
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
