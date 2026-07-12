import type { CodexPetAnimationMappings } from '../../../codex-pet/animationMapping'
import { recommendCodexPetMappings } from '../../../codex-pet/animationMapping'
import {
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
} from '../../../codex-pet/contract'
import {
  assertCodexPetLookMovementScale,
  CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
} from '../../../codex-pet/lookMovementScale'
import {
  calculateLiveSDFinalProjection,
  findLiveSDAlphaPixelBounds,
  LIVE_SD_FRAME_INSET_PIXELS,
  type LiveSDProjection,
  type LiveSDWorldBounds,
} from '../../rendering/alphaBounds'
import {
  assertLiveSDFramingOffset,
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  type LiveSDFramingOffset,
} from '../../rendering/framingOffset'
import {
  assertLiveSDFramingScale,
  LIVE_SD_FRAMING_SCALE_DEFAULT,
} from '../../rendering/framingScale'
import {
  normalizeLiveSDLookTarget,
  type LiveSDLookTarget,
} from '../../rendering/lookTarget'
import { calibrateGarupaCanonicalProjection } from './canonicalProjection'
import {
  GarupaRenderingError,
  isGarupaRenderingError,
  normalizeGarupaRenderingError,
  throwIfGarupaSamplingAborted,
} from './errors'
import { createGarupaFramePlan } from './framePlan'
import { resolveGarupaDualEyeRig } from './lookRig'
import { applyGarupaPreviewPose } from './pose'
import {
  GARUPA_SPINE_40_RUNTIME_KEY,
  type GarupaAnimationFrameScheduler,
  type GarupaSpine40PreviewInput,
  type GarupaSpine40PreviewCreateOptions,
  type GarupaSpine40PreviewCreator,
  type GarupaSpine40PreviewSession,
  type GarupaSpine40RuntimeAdapter,
  type GarupaSpine40RuntimeSession,
} from './types'
import {
  drawGarupaRuntimeFrame,
  GARUPA_PREVIEW_WEBGL_ATTRIBUTES,
  readGarupaStraightRgba,
} from './webgl'

const browserAnimationFrameScheduler: GarupaAnimationFrameScheduler = {
  cancel(handle) {
    cancelAnimationFrame(handle)
  },
  request(callback) {
    return requestAnimationFrame(callback)
  },
}

export interface GarupaSpine40PreviewFactoryOptions {
  readonly runtimeAdapter: GarupaSpine40RuntimeAdapter
  readonly scheduler?: GarupaAnimationFrameScheduler
  readonly yieldControl?: () => Promise<void>
}

function safely(action: () => void): void {
  try {
    action()
  } catch {
    // Cleanup must not hide the original rendering failure.
  }
}

function assertRuntimeSession(
  adapter: GarupaSpine40RuntimeAdapter,
  session: GarupaSpine40RuntimeSession,
  expectedVersion: string,
): void {
  if (
    adapter.runtimeKey !== GARUPA_SPINE_40_RUNTIME_KEY ||
    session.runtimeKey !== GARUPA_SPINE_40_RUNTIME_KEY ||
    session.adapterIdentity !== adapter.adapterIdentity ||
    session.version !== expectedVersion
  ) {
    throw new GarupaRenderingError(
      'GARUPA_RENDERING_FAILED',
      'The injected Garupa runtime session identity is inconsistent.',
      {
        actualVersion: session.version,
        expectedVersion,
        stage: 'runtime-identity',
      },
    )
  }
}

function animationDurations(
  session: GarupaSpine40RuntimeSession,
): ReadonlyMap<string, number> {
  const durations = new Map<string, number>()
  for (const animation of session.animations) {
    if (
      !animation.name ||
      !Number.isFinite(animation.duration) ||
      animation.duration < 0
    ) {
      throw new GarupaRenderingError(
        'GARUPA_ANIMATION_MISSING',
        'The Garupa runtime returned invalid animation metadata.',
        { stage: 'animation-catalog' },
      )
    }
    durations.set(animation.name, animation.duration)
  }
  if (durations.size === 0) {
    throw new GarupaRenderingError(
      'GARUPA_ANIMATION_MISSING',
      'The Garupa skeleton has no animations.',
      { stage: 'animation-catalog' },
    )
  }
  return durations
}

class ReadyGarupaSpine40PreviewSession
  implements GarupaSpine40PreviewSession
{
  readonly #animationDurations: ReadonlyMap<string, number>
  readonly #canvas: HTMLCanvasElement
  readonly #compatibility: 'experimental' | 'verified'
  readonly #gl: WebGLRenderingContext
  readonly #listeners = new Set<(error: Error) => void>()
  readonly #runtimeSession: GarupaSpine40RuntimeSession
  readonly #scheduler: GarupaAnimationFrameScheduler
  readonly #visibleBounds: LiveSDWorldBounds
  #animationFrame: number | null = null
  #currentAnimation: string
  #disposed = false
  #elapsed = 0
  #framingOffset: LiveSDFramingOffset = { ...LIVE_SD_FRAMING_OFFSET_DEFAULT }
  #framingScale = LIVE_SD_FRAMING_SCALE_DEFAULT
  #lastTimestamp: number | null = null
  #lookMovementScale = CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT
  #lookTarget: LiveSDLookTarget | null = null
  #mirrorX = false
  readonly adapterIdentity: string
  readonly animations: readonly string[]
  readonly lookRigSupported: boolean
  readonly runtimeKey = GARUPA_SPINE_40_RUNTIME_KEY
  readonly version: string

  constructor(input: {
    readonly animationDurations: ReadonlyMap<string, number>
    readonly canvas: HTMLCanvasElement
    readonly compatibility: 'experimental' | 'verified'
    readonly currentAnimation: string
    readonly gl: WebGLRenderingContext
    readonly lookRigSupported: boolean
    readonly runtimeSession: GarupaSpine40RuntimeSession
    readonly scheduler: GarupaAnimationFrameScheduler
    readonly visibleBounds: LiveSDWorldBounds
  }) {
    this.#animationDurations = input.animationDurations
    this.#canvas = input.canvas
    this.#compatibility = input.compatibility
    this.#currentAnimation = input.currentAnimation
    this.#gl = input.gl
    this.#runtimeSession = input.runtimeSession
    this.#scheduler = input.scheduler
    this.#visibleBounds = input.visibleBounds
    this.adapterIdentity = input.runtimeSession.adapterIdentity
    this.animations = Object.freeze(
      input.runtimeSession.animations.map((animation) => animation.name),
    )
    this.lookRigSupported = input.lookRigSupported
    this.version = input.runtimeSession.version
  }

  get compatibility(): 'experimental' | 'verified' {
    return this.#compatibility
  }

  get currentAnimation(): string {
    return this.#currentAnimation
  }

  get framingOffset(): LiveSDFramingOffset {
    return this.#framingOffset
  }

  get framingScale(): number {
    return this.#framingScale
  }

  start(): void {
    if (this.#disposed || this.#animationFrame !== null) return
    this.#animationFrame = this.#scheduler.request(this.#tick)
  }

  onError(listener: (error: Error) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  play(name: string): void {
    this.#assertReady()
    if (!this.#animationDurations.has(name)) {
      throw new GarupaRenderingError(
        'GARUPA_ANIMATION_MISSING',
        'The requested Garupa animation is unavailable.',
        { animationName: name },
      )
    }
    this.#currentAnimation = name
    this.#elapsed = 0
    this.#lastTimestamp = null
    this.#redraw()
  }

  resize(width: number, height: number): void {
    this.#assertReady()
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new RangeError('Preview dimensions must be positive integers.')
    }
    this.#canvas.width = width
    this.#canvas.height = height
    this.#redraw()
  }

  setFramingOffset(offset: LiveSDFramingOffset): void {
    this.#assertReady()
    assertLiveSDFramingOffset(offset)
    this.#framingOffset = { ...offset }
    this.#redraw()
  }

  setFramingScale(scale: number): void {
    this.#assertReady()
    assertLiveSDFramingScale(scale)
    this.#framingScale = scale
    this.#redraw()
  }

  setLookTarget(target: LiveSDLookTarget | null, movementScale = 1): void {
    this.#assertReady()
    assertCodexPetLookMovementScale(movementScale)
    if (target && !this.lookRigSupported) {
      throw new GarupaRenderingError(
        'GARUPA_LOOK_RIG_UNSUPPORTED',
        'This Garupa source is preview-only because its eye rig is unsupported.',
      )
    }
    this.#lookTarget = target
      ? normalizeLiveSDLookTarget(target.x, target.y)
      : null
    this.#lookMovementScale = movementScale
    this.#redraw()
  }

  setMirrorX(mirrorX: boolean): void {
    this.#assertReady()
    this.#mirrorX = mirrorX
    this.#redraw()
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    if (this.#animationFrame !== null) {
      this.#scheduler.cancel(this.#animationFrame)
      this.#animationFrame = null
    }
    safely(() => this.#runtimeSession.dispose())
    safely(() => {
      this.#gl.clearColor(0, 0, 0, 0)
      this.#gl.clear(this.#gl.COLOR_BUFFER_BIT)
    })
    safely(() => this.#gl.getExtension('WEBGL_lose_context')?.loseContext())
    this.#canvas.width = 1
    this.#canvas.height = 1
    this.#listeners.clear()
  }

  readonly #tick = (timestamp: number): void => {
    if (this.#disposed) return
    if (this.#lastTimestamp !== null) {
      this.#elapsed += Math.max(0, timestamp - this.#lastTimestamp) / 1_000
    }
    this.#lastTimestamp = timestamp

    try {
      this.#drawCurrentFrame()
    } catch (error) {
      const normalized = normalizeGarupaRenderingError(
        error,
        'GARUPA_PREVIEW_RENDER_FAILED',
        'The Garupa preview frame could not be rendered.',
        { stage: 'animation-frame' },
      )
      const listeners = [...this.#listeners]
      this.dispose()
      for (const listener of listeners) listener(normalized)
      return
    }
    this.#animationFrame = this.#scheduler.request(this.#tick)
  }

  #projection(): LiveSDProjection {
    return calculateLiveSDFinalProjection(
      this.#visibleBounds,
      CODEX_PET_CELL_WIDTH,
      CODEX_PET_CELL_HEIGHT,
      LIVE_SD_FRAME_INSET_PIXELS,
      this.#framingScale,
      this.#framingOffset,
      this.#mirrorX,
    )
  }

  #drawCurrentFrame(): void {
    const duration = this.#animationDurations.get(this.#currentAnimation)
    if (duration === undefined) {
      throw new GarupaRenderingError(
        'GARUPA_ANIMATION_MISSING',
        'The active Garupa animation is unavailable.',
        { animationName: this.#currentAnimation },
      )
    }
    const projection = this.#projection()
    this.#runtimeSession.setProjection(projection)
    const target = this.#lookTarget
      ? {
          x: this.#mirrorX ? -this.#lookTarget.x : this.#lookTarget.x,
          y: this.#lookTarget.y,
        }
      : null
    applyGarupaPreviewPose(
      this.#runtimeSession,
      this.#currentAnimation,
      duration,
      this.#elapsed,
      projection,
      target,
      this.#lookMovementScale,
    )
    drawGarupaRuntimeFrame(
      this.#runtimeSession,
      this.#gl,
      this.#canvas.width,
      this.#canvas.height,
      this.#mirrorX,
    )
  }

  #redraw(): void {
    try {
      this.#drawCurrentFrame()
    } catch (error) {
      const normalized = normalizeGarupaRenderingError(
        error,
        'GARUPA_PREVIEW_RENDER_FAILED',
        'The Garupa preview frame could not be rendered.',
        { stage: 'interactive-redraw' },
      )
      this.dispose()
      throw normalized
    }
  }

  #assertReady(): void {
    if (this.#disposed) {
      throw new GarupaRenderingError(
        'GARUPA_PREVIEW_RENDER_FAILED',
        'The Garupa preview session has been disposed.',
        { stage: 'disposed' },
      )
    }
  }
}

export class GarupaSpine40PreviewFactory
  implements GarupaSpine40PreviewCreator
{
  readonly #runtimeAdapter: GarupaSpine40RuntimeAdapter
  readonly #scheduler: GarupaAnimationFrameScheduler
  readonly #yieldControl: () => Promise<void>

  constructor(options: GarupaSpine40PreviewFactoryOptions) {
    this.#runtimeAdapter = options.runtimeAdapter
    this.#scheduler = options.scheduler ?? browserAnimationFrameScheduler
    this.#yieldControl = options.yieldControl ?? (() => Promise.resolve())
  }

  async createPreview(
    input: GarupaSpine40PreviewInput,
    options: GarupaSpine40PreviewCreateOptions = {},
  ): Promise<GarupaSpine40PreviewSession> {
    throwIfGarupaSamplingAborted(options.signal)
    input.canvas.width = CODEX_PET_CELL_WIDTH
    input.canvas.height = CODEX_PET_CELL_HEIGHT
    const gl = input.canvas.getContext('webgl', GARUPA_PREVIEW_WEBGL_ATTRIBUTES)
    if (!gl) {
      throw new GarupaRenderingError(
        'GARUPA_PREVIEW_RENDER_FAILED',
        'WebGL is unavailable for the Garupa preview.',
        { stage: 'context' },
      )
    }

    let runtimeSession: GarupaSpine40RuntimeSession | null = null
    let handedOff = false
    try {
      runtimeSession = await this.#runtimeAdapter.createSession({
        atlasBundle: input.atlasBundle,
        gl,
        signal: options.signal,
        skeletonData: input.skeletonData,
        textureUpload: {
          preserveRgb: true,
          unpackPremultiplyAlpha: false,
        },
      })
      assertRuntimeSession(this.#runtimeAdapter, runtimeSession, input.version)
      const durations = animationDurations(runtimeSession)
      const animationNames = runtimeSession.animations.map(
        (animation) => animation.name,
      )
      const defaultAnimation =
        animationNames.find((animation) => animation === 'Idle') ??
        animationNames[0]
      if (!defaultAnimation) {
        throw new GarupaRenderingError(
          'GARUPA_ANIMATION_MISSING',
          'The Garupa skeleton has no preview animation.',
        )
      }
      const mappings: CodexPetAnimationMappings =
        input.mappings ?? recommendCodexPetMappings(animationNames)
      const plan = createGarupaFramePlan(mappings, durations)
      let canonical
      try {
        canonical = await calibrateGarupaCanonicalProjection({
          frames: plan,
          framingOffset: LIVE_SD_FRAMING_OFFSET_DEFAULT,
          framingScale: LIVE_SD_FRAMING_SCALE_DEFAULT,
          gl,
          session: runtimeSession,
          signal: options.signal,
          throwIfAborted: throwIfGarupaSamplingAborted,
          yieldControl: this.#yieldControl,
        })
      } catch (error) {
        if (
          isGarupaRenderingError(error) &&
          (error.code === 'GARUPA_ANIMATION_MISSING' ||
            error.code === 'GARUPA_RENDERING_FAILED')
        ) {
          throw error
        }
        throw new GarupaRenderingError(
          'GARUPA_PREVIEW_RENDER_FAILED',
          'The Garupa preview could not calibrate a visible first frame.',
          { stage: 'canonical-calibration' },
          { cause: error },
        )
      }
      throwIfGarupaSamplingAborted(options.signal)

      const defaultDuration = durations.get(defaultAnimation)
      if (defaultDuration === undefined) {
        throw new GarupaRenderingError(
          'GARUPA_ANIMATION_MISSING',
          'The default Garupa animation has no duration.',
          { animationName: defaultAnimation },
        )
      }
      let firstFrame: Uint8ClampedArray
      try {
        runtimeSession.setProjection(canonical.projection)
        applyGarupaPreviewPose(
          runtimeSession,
          defaultAnimation,
          defaultDuration,
          0,
          canonical.projection,
          null,
          CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
        )
        drawGarupaRuntimeFrame(
          runtimeSession,
          gl,
          CODEX_PET_CELL_WIDTH,
          CODEX_PET_CELL_HEIGHT,
        )
        firstFrame = readGarupaStraightRgba(
          gl,
          CODEX_PET_CELL_WIDTH,
          CODEX_PET_CELL_HEIGHT,
        )
      } catch (error) {
        throw new GarupaRenderingError(
          'GARUPA_PREVIEW_RENDER_FAILED',
          'The first Garupa preview frame could not be rendered.',
          { stage: 'first-visible-frame' },
          { cause: error },
        )
      }
      if (
        !findLiveSDAlphaPixelBounds(
          firstFrame,
          CODEX_PET_CELL_WIDTH,
          CODEX_PET_CELL_HEIGHT,
        )
      ) {
        throw new GarupaRenderingError(
          'GARUPA_PREVIEW_RENDER_FAILED',
          'The first Garupa preview frame is fully transparent.',
          { stage: 'first-visible-frame' },
        )
      }

      let lookRigSupported = true
      try {
        resolveGarupaDualEyeRig(runtimeSession)
      } catch (error) {
        if (!isGarupaRenderingError(error)) throw error
        lookRigSupported = false
      }

      const ready = new ReadyGarupaSpine40PreviewSession({
        animationDurations: durations,
        canvas: input.canvas,
        compatibility: input.compatibility,
        currentAnimation: defaultAnimation,
        gl,
        lookRigSupported,
        runtimeSession,
        scheduler: this.#scheduler,
        visibleBounds: canonical.visibleBounds,
      })
      handedOff = true
      ready.start()
      return ready
    } catch (error) {
      if (!isGarupaRenderingError(error)) {
        throwIfGarupaSamplingAborted(options.signal)
      }
      throw normalizeGarupaRenderingError(
        error,
        'GARUPA_RENDERING_FAILED',
        'The Garupa Spine 4.0 preview could not be created.',
        { stage: 'create-preview' },
      )
    } finally {
      if (!handedOff) {
        safely(() => runtimeSession?.dispose())
        safely(() => gl.getExtension('WEBGL_lose_context')?.loseContext())
        input.canvas.width = 1
        input.canvas.height = 1
      }
    }
  }
}
