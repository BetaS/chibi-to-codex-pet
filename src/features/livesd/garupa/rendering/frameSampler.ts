import {
  CODEX_PET_ATLAS_HEIGHT,
  CODEX_PET_ATLAS_WIDTH,
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
  CODEX_PET_STANDARD_FRAME_COUNT,
  CODEX_PET_TOTAL_FRAME_COUNT,
} from '../../../codex-pet/contract'
import {
  assertCodexPetLookMovementScale,
  CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
} from '../../../codex-pet/lookMovementScale'
import type {
  LiveSDFrameSamplingPhase,
  LiveSDFrameSamplingProgress,
} from '../../export/types'
import {
  assertLiveSDFramingOffset,
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
} from '../../rendering/framingOffset'
import {
  assertLiveSDFramingScale,
  LIVE_SD_FRAMING_SCALE_DEFAULT,
} from '../../rendering/framingScale'
import { calibrateGarupaCanonicalProjection } from './canonicalProjection'
import {
  GarupaRenderingError,
  isGarupaRenderingError,
  throwIfGarupaSamplingAborted,
} from './errors'
import { createGarupaFramePlan } from './framePlan'
import { resolveGarupaDualEyeRig } from './lookRig'
import { applyGarupaPlannedFramePose } from './pose'
import {
  GARUPA_SPINE_40_RUNTIME_KEY,
  type GarupaFrameSamplerCanvasFactory,
  type GarupaFrameSamplerCanvasKind,
  type GarupaFrameSamplerPngEncoder,
  type GarupaFrameSamplingInput,
  type GarupaFrameSamplingResult,
  type GarupaPlannedFrame,
  type GarupaSpine40RuntimeAdapter,
  type GarupaSpine40RuntimeSession,
} from './types'
import {
  drawGarupaRuntimeFrame,
  GARUPA_SAMPLER_WEBGL_ATTRIBUTES,
  readGarupaStraightRgba,
} from './webgl'

const TOTAL_PROGRESS_STEPS =
  CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT + 1

export interface GarupaSpine40FrameSamplerOptions {
  readonly canvasFactory?: GarupaFrameSamplerCanvasFactory
  readonly pngEncoder?: GarupaFrameSamplerPngEncoder
  readonly runtimeAdapter: GarupaSpine40RuntimeAdapter
  readonly yieldControl?: () => Promise<void>
}

function defaultCanvasFactory(
  _kind: GarupaFrameSamplerCanvasKind,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function encodeCanvasAsPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error('Canvas returned an empty PNG Blob.'))
          return
        }
        resolve(blob)
      }, 'image/png')
    } catch (error) {
      reject(error)
    }
  })
}

function yieldWithMessageChannel(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      channel.port2.close()
      resolve()
    }
    channel.port2.postMessage(undefined)
  })
}

function safely(action: () => void): void {
  try {
    action()
  } catch {
    // Cleanup failures must not replace a result or its original error.
  }
}

function getAnimationDurations(
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

function putFrameInAtlas(
  atlasContext: CanvasRenderingContext2D,
  cellCanvas: HTMLCanvasElement,
  cellContext: CanvasRenderingContext2D,
  frame: GarupaPlannedFrame,
  rgba: Uint8ClampedArray,
): void {
  const imageData = cellContext.createImageData(
    CODEX_PET_CELL_WIDTH,
    CODEX_PET_CELL_HEIGHT,
  )
  imageData.data.set(rgba)
  cellContext.clearRect(0, 0, CODEX_PET_CELL_WIDTH, CODEX_PET_CELL_HEIGHT)
  cellContext.putImageData(imageData, 0, 0)

  const x = frame.column * CODEX_PET_CELL_WIDTH
  const y = frame.row * CODEX_PET_CELL_HEIGHT
  atlasContext.save()
  try {
    if (frame.mirrorX) {
      atlasContext.translate(x + CODEX_PET_CELL_WIDTH, y)
      atlasContext.scale(-1, 1)
      atlasContext.drawImage(cellCanvas, 0, 0)
    } else {
      atlasContext.drawImage(cellCanvas, x, y)
    }
  } finally {
    atlasContext.restore()
  }
}

export class GarupaSpine40FrameSampler {
  readonly #canvasFactory: GarupaFrameSamplerCanvasFactory
  readonly #pngEncoder: GarupaFrameSamplerPngEncoder
  readonly #runtimeAdapter: GarupaSpine40RuntimeAdapter
  readonly #yieldControl: () => Promise<void>

  constructor(options: GarupaSpine40FrameSamplerOptions) {
    this.#canvasFactory = options.canvasFactory ?? defaultCanvasFactory
    this.#pngEncoder = options.pngEncoder ?? encodeCanvasAsPng
    this.#runtimeAdapter = options.runtimeAdapter
    this.#yieldControl = options.yieldControl ?? yieldWithMessageChannel
  }

  async sample(
    input: GarupaFrameSamplingInput,
  ): Promise<GarupaFrameSamplingResult> {
    let atlasCanvas: HTMLCanvasElement | null = null
    let cellCanvas: HTMLCanvasElement | null = null
    let frameCanvas: HTMLCanvasElement | null = null
    let gl: WebGLRenderingContext | null = null
    let runtimeSession: GarupaSpine40RuntimeSession | null = null
    let completedSteps = 0

    const report = (
      phase: LiveSDFrameSamplingPhase,
      frame?: GarupaPlannedFrame,
    ): void => {
      const progress: LiveSDFrameSamplingProgress = {
        completedSteps,
        fraction: Math.min(completedSteps / TOTAL_PROGRESS_STEPS, 1),
        phase,
        totalSteps: TOTAL_PROGRESS_STEPS,
        ...(frame
          ? frame.lookDirectionIndex !== undefined
            ? { lookDirectionIndex: frame.lookDirectionIndex }
            : { frameIndex: frame.frameIndex, stateId: frame.stateId }
          : {}),
      }
      input.onProgress?.(progress)
    }

    try {
      throwIfGarupaSamplingAborted(input.signal)
      const framingScale = input.framingScale ?? LIVE_SD_FRAMING_SCALE_DEFAULT
      const framingOffset = {
        ...(input.framingOffset ?? LIVE_SD_FRAMING_OFFSET_DEFAULT),
      }
      const lookMovementScale =
        input.lookMovementScale ?? CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT
      try {
        assertLiveSDFramingScale(framingScale)
        assertLiveSDFramingOffset(framingOffset)
        assertCodexPetLookMovementScale(lookMovementScale)
      } catch (error) {
        throw new GarupaRenderingError(
          'GARUPA_RENDERING_FAILED',
          'Garupa frame sampling controls are invalid.',
          { stage: 'input' },
          { cause: error },
        )
      }

      report('preparing')
      frameCanvas = this.#canvasFactory(
        'frame-webgl',
        CODEX_PET_CELL_WIDTH,
        CODEX_PET_CELL_HEIGHT,
      )
      atlasCanvas = this.#canvasFactory(
        'atlas-2d',
        CODEX_PET_ATLAS_WIDTH,
        CODEX_PET_ATLAS_HEIGHT,
      )
      cellCanvas = this.#canvasFactory(
        'cell-2d',
        CODEX_PET_CELL_WIDTH,
        CODEX_PET_CELL_HEIGHT,
      )
      frameCanvas.width = CODEX_PET_CELL_WIDTH
      frameCanvas.height = CODEX_PET_CELL_HEIGHT
      atlasCanvas.width = CODEX_PET_ATLAS_WIDTH
      atlasCanvas.height = CODEX_PET_ATLAS_HEIGHT
      cellCanvas.width = CODEX_PET_CELL_WIDTH
      cellCanvas.height = CODEX_PET_CELL_HEIGHT

      gl = frameCanvas.getContext('webgl', GARUPA_SAMPLER_WEBGL_ATTRIBUTES)
      if (!gl) {
        throw new GarupaRenderingError(
          'GARUPA_RENDERING_FAILED',
          'WebGL is unavailable for Garupa frame sampling.',
          { stage: 'context' },
        )
      }
      const atlasContext = atlasCanvas.getContext('2d')
      const cellContext = cellCanvas.getContext('2d')
      if (!atlasContext || !cellContext) {
        throw new GarupaRenderingError(
          'GARUPA_RENDERING_FAILED',
          '2D canvas is unavailable for Garupa atlas assembly.',
          { stage: 'canvas' },
        )
      }
      atlasContext.clearRect(0, 0, CODEX_PET_ATLAS_WIDTH, CODEX_PET_ATLAS_HEIGHT)

      throwIfGarupaSamplingAborted(input.signal)
      runtimeSession = await this.#runtimeAdapter.createSession({
        atlasBundle: input.atlasBundle,
        gl,
        signal: input.signal,
        skeletonData: input.skeletonData,
        textureUpload: {
          preserveRgb: true,
          unpackPremultiplyAlpha: false,
        },
      })
      if (
        this.#runtimeAdapter.runtimeKey !== GARUPA_SPINE_40_RUNTIME_KEY ||
        runtimeSession.runtimeKey !== GARUPA_SPINE_40_RUNTIME_KEY ||
        runtimeSession.adapterIdentity !== this.#runtimeAdapter.adapterIdentity ||
        (input.expectedAdapterIdentity !== undefined &&
          runtimeSession.adapterIdentity !== input.expectedAdapterIdentity)
      ) {
        throw new GarupaRenderingError(
          'GARUPA_RENDERING_FAILED',
          'The Garupa runtime profile changed before frame sampling.',
          { stage: 'runtime-identity' },
        )
      }

      const durations = getAnimationDurations(runtimeSession)
      const framePlan = createGarupaFramePlan(
        input.mappings,
        durations,
        input.globalMirrorX ?? false,
      )
      const standardFrames = framePlan.slice(0, CODEX_PET_STANDARD_FRAME_COUNT)
      const canonical = await calibrateGarupaCanonicalProjection({
        frames: standardFrames,
        framingOffset,
        framingScale,
        gl,
        onCalibrated(frame) {
          completedSteps += 1
          report('calibrating', frame)
        },
        onMeasured(frame) {
          completedSteps += 1
          report('measuring', frame)
        },
        session: runtimeSession,
        signal: input.signal,
        throwIfAborted: throwIfGarupaSamplingAborted,
        yieldControl: this.#yieldControl,
      })

      const idle = framePlan[0]
      if (!idle) {
        throw new GarupaRenderingError(
          'GARUPA_ANIMATION_MISSING',
          'The Garupa frame plan has no idle frame.',
        )
      }
      applyGarupaPlannedFramePose(runtimeSession, idle)
      resolveGarupaDualEyeRig(runtimeSession)

      for (const frame of framePlan) {
        throwIfGarupaSamplingAborted(input.signal)
        const projection = frame.mirrorX
          ? canonical.mirroredProjection
          : canonical.projection
        try {
          runtimeSession.setProjection(projection)
          applyGarupaPlannedFramePose(
            runtimeSession,
            frame,
            projection,
            lookMovementScale,
          )
          drawGarupaRuntimeFrame(
            runtimeSession,
            gl,
            CODEX_PET_CELL_WIDTH,
            CODEX_PET_CELL_HEIGHT,
          )
        } catch (error) {
          if (
            isGarupaRenderingError(error) &&
            error.code === 'GARUPA_LOOK_RIG_UNSUPPORTED'
          ) {
            throw error
          }
          throw new GarupaRenderingError(
            'GARUPA_FRAME_RENDER_FAILED',
            'A Garupa output frame could not be rendered.',
            {
              frameIndex: frame.frameIndex,
              stage: 'rendering',
              stateId: frame.stateId,
            },
            { cause: error },
          )
        }

        let rgba: Uint8ClampedArray
        try {
          rgba = readGarupaStraightRgba(
            gl,
            CODEX_PET_CELL_WIDTH,
            CODEX_PET_CELL_HEIGHT,
          )
        } catch (error) {
          if (isGarupaRenderingError(error)) throw error
          throw new GarupaRenderingError(
            'GARUPA_FRAME_READBACK_FAILED',
            'A Garupa output frame could not be read.',
            {
              frameIndex: frame.frameIndex,
              stage: 'rendering',
              stateId: frame.stateId,
            },
            { cause: error },
          )
        }

        try {
          putFrameInAtlas(
            atlasContext,
            cellCanvas,
            cellContext,
            frame,
            rgba,
          )
        } catch (error) {
          throw new GarupaRenderingError(
            'GARUPA_RENDERING_FAILED',
            'A Garupa frame could not be placed in the output atlas.',
            { stage: 'atlas-assembly' },
            { cause: error },
          )
        }

        completedSteps += 1
        report('rendering', frame)
        throwIfGarupaSamplingAborted(input.signal)
        await this.#yieldControl()
      }

      report('encoding')
      throwIfGarupaSamplingAborted(input.signal)
      let atlasPng: Blob
      try {
        atlasPng = await this.#pngEncoder(atlasCanvas)
        if (atlasPng.size === 0) throw new Error('PNG encoder returned no data.')
      } catch (error) {
        throw new GarupaRenderingError(
          'GARUPA_RENDERING_FAILED',
          'The Garupa output atlas could not be encoded.',
          { stage: 'encoding' },
          { cause: error },
        )
      }
      throwIfGarupaSamplingAborted(input.signal)

      completedSteps += 1
      report('complete')
      return {
        adapterIdentity: runtimeSession.adapterIdentity,
        atlasPng,
        frameCount: framePlan.length,
        height: CODEX_PET_ATLAS_HEIGHT,
        runtimeKey: GARUPA_SPINE_40_RUNTIME_KEY,
        width: CODEX_PET_ATLAS_WIDTH,
      }
    } catch (error) {
      if (isGarupaRenderingError(error)) throw error
      throwIfGarupaSamplingAborted(input.signal)
      throw new GarupaRenderingError(
        'GARUPA_RENDERING_FAILED',
        'Garupa frame sampling failed.',
        { stage: 'sampling' },
        { cause: error },
      )
    } finally {
      safely(() => runtimeSession?.dispose())
      if (gl) {
        safely(() => {
          gl?.clearColor(0, 0, 0, 0)
          gl?.clear(gl.COLOR_BUFFER_BIT)
        })
        safely(() => gl?.getExtension('WEBGL_lose_context')?.loseContext())
      }
      for (const canvas of [frameCanvas, cellCanvas, atlasCanvas]) {
        if (!canvas) continue
        canvas.width = 1
        canvas.height = 1
      }
    }
  }
}
