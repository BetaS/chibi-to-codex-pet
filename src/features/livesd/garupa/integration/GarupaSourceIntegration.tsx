import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { CodexPetBuilder } from '../../../codex-pet/CodexPetBuilder'
import { resolveCodexPetMirrorX } from '../../../codex-pet/animationMapping'
import type { CodexPetStateId } from '../../../codex-pet/contract'
import type { LiveSDFrameSamplingInput } from '../../export/types'
import {
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  type LiveSDFramingOffset,
} from '../../rendering/framingOffset'
import { LIVE_SD_FRAMING_SCALE_DEFAULT } from '../../rendering/framingScale'
import {
  GarupaSpine40FrameSampler,
  officialGarupaSpine40RuntimeAdapter,
  type GarupaSpine40PreviewSession,
} from '../rendering'
import type { GarupaCanonicalSource } from '../importer'
import {
  SPINE_40_RUNTIME_LICENSE_URL,
  SPINE_40_RUNTIME_NOTICES_URL,
} from '../../runtime/Spine40RuntimeLoader'
import { createDefaultGarupaSourceController } from './createDefaultGarupaSourceController'
import type { GarupaSourceController } from './GarupaSourceController'
import { GarupaSourcePanel } from './GarupaSourcePanel'

const GARUPA_DEFAULT_STATE_MIRROR_X = Object.freeze({
  'running-right': true,
  'running-left': false,
})

export interface GarupaSourceIntegrationProps {
  readonly controllerFactory?: () => GarupaSourceController
}

interface GarupaReadyBuilderProps {
  readonly frameSampler: GarupaSpine40FrameSampler
  readonly preview: GarupaSpine40PreviewSession
  readonly source: GarupaCanonicalSource
}

function GarupaReadyBuilder({
  frameSampler,
  preview,
  source,
}: GarupaReadyBuilderProps) {
  const [framingScale, setFramingScale] = useState(
    LIVE_SD_FRAMING_SCALE_DEFAULT,
  )
  const [framingOffset, setFramingOffset] = useState<LiveSDFramingOffset>(
    LIVE_SD_FRAMING_OFFSET_DEFAULT,
  )
  const [globalMirrorX, setGlobalMirrorX] = useState(false)

  const services = useMemo(
    () => ({
      sample: (input: LiveSDFrameSamplingInput) =>
        frameSampler.sample({
          ...input,
          expectedAdapterIdentity: preview.adapterIdentity,
        }),
    }),
    [frameSampler, preview.adapterIdentity],
  )

  const applyFraming = useCallback((
    nextScale: number,
    nextOffset: LiveSDFramingOffset,
  ) => {
    setFramingScale(nextScale)
    setFramingOffset(nextOffset)
    preview.setFramingScale(nextScale)
    preview.setFramingOffset(nextOffset)
  }, [preview])

  const playStateAnimation = useCallback((
    animationName: string,
    _stateId: CodexPetStateId,
    stateMirrorX: boolean,
  ) => {
    preview.setMirrorX(
      resolveCodexPetMirrorX(globalMirrorX, stateMirrorX),
    )
    preview.play(animationName)
  }, [globalMirrorX, preview])

  const changeGlobalMirror = useCallback((nextMirrorX: boolean) => {
    setGlobalMirrorX(nextMirrorX)
    preview.setMirrorX(nextMirrorX)
  }, [preview])

  return (
    <CodexPetBuilder
      animations={preview.animations}
      defaultStateMirrorX={GARUPA_DEFAULT_STATE_MIRROR_X}
      framingOffset={framingOffset}
      framingScale={framingScale}
      onFramingChange={applyFraming}
      onGlobalMirrorXChange={changeGlobalMirror}
      onPreviewAnimationChange={playStateAnimation}
      recipeSource={null}
      services={services}
      source={source}
    />
  )
}

export function GarupaSourceIntegration({
  controllerFactory = createDefaultGarupaSourceController,
}: GarupaSourceIntegrationProps = {}) {
  const [controller] = useState(controllerFactory)
  const lifecycleGenerationRef = useRef(0)
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
  const activeSource = controllerState.active
    ? controller.getActiveSource()
    : null
  const activePreview = controllerState.active
    ? controller.getActivePreview()
    : null

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

  return (
    <>
      <div className="workspace-grid">
        <GarupaSourcePanel controller={controller} />
        {controllerState.active && activeSource && activePreview ? (
          <GarupaReadyBuilder
            frameSampler={frameSampler}
            key={controllerState.active.generation}
            preview={activePreview}
            source={activeSource}
          />
        ) : (
          <CodexPetBuilder
            animations={[]}
            framingScale={LIVE_SD_FRAMING_SCALE_DEFAULT}
            recipeSource={null}
            source={null}
          />
        )}
      </div>

      <footer className="app-footer">
        <nav aria-label="Spine 4.0 runtime notices">
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
