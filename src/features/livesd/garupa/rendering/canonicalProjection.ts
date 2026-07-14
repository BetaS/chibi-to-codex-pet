import {
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
  CODEX_PET_STANDARD_FRAME_COUNT,
} from '../../../codex-pet/contract'
import {
  calculateLiveSDFinalProjection,
  convertLiveSDAlphaPixelBoundsToWorld,
  findLiveSDAlphaPixelBounds,
  LIVE_SD_FRAME_INSET_PIXELS,
  mergeLiveSDWorldBounds,
  type LiveSDWorldBounds,
} from '../../rendering/alphaBounds'
import { calculateLiveSDCanonicalCoarseProjection } from '../../rendering/canonicalProjection'
import type { LiveSDFramingOffset } from '../../rendering/framingOffset'
import { GarupaRenderingError, isGarupaRenderingError } from './errors'
import { applyGarupaPlannedFramePose } from './pose'
import type {
  GarupaCanonicalProjection,
  GarupaPlannedFrame,
  GarupaSpine40RuntimeSession,
} from './types'
import { drawGarupaRuntimeFrame, readGarupaStraightRgba } from './webgl'

export interface CalibrateGarupaCanonicalProjectionInput {
  readonly frames: readonly GarupaPlannedFrame[]
  readonly framingOffset: LiveSDFramingOffset
  readonly framingScale: number
  readonly gl: WebGLRenderingContext
  readonly onCalibrated?: (frame: GarupaPlannedFrame) => void
  readonly onMeasured?: (frame: GarupaPlannedFrame) => void
  readonly session: GarupaSpine40RuntimeSession
  readonly signal?: AbortSignal
  readonly throwIfAborted: (signal?: AbortSignal) => void
  readonly yieldControl: () => Promise<void>
}

function frameContext(frame: GarupaPlannedFrame): {
  readonly frameIndex: number
  readonly stateId: string
} {
  return { frameIndex: frame.frameIndex, stateId: frame.stateId }
}

export async function calibrateGarupaCanonicalProjection(
  input: CalibrateGarupaCanonicalProjectionInput,
): Promise<GarupaCanonicalProjection> {
  const frames = input.frames.slice(0, CODEX_PET_STANDARD_FRAME_COUNT)
  if (frames.length !== CODEX_PET_STANDARD_FRAME_COUNT) {
    throw new GarupaRenderingError(
      'GARUPA_FRAME_RENDER_FAILED',
      'Garupa canonical calibration requires all standard frames.',
      {
        actual: frames.length,
        expected: CODEX_PET_STANDARD_FRAME_COUNT,
        stage: 'measuring',
      },
    )
  }

  let coarseBounds: LiveSDWorldBounds | null = null
  for (const frame of frames) {
    input.throwIfAborted(input.signal)
    try {
      applyGarupaPlannedFramePose(input.session, frame)
      coarseBounds = mergeLiveSDWorldBounds(
        coarseBounds,
        input.session.getBounds(),
      )
    } catch (error) {
      throw new GarupaRenderingError(
        'GARUPA_FRAME_RENDER_FAILED',
        'A Garupa frame could not be measured.',
        { ...frameContext(frame), stage: 'measuring' },
        { cause: error },
      )
    }
    input.onMeasured?.(frame)
    input.throwIfAborted(input.signal)
    await input.yieldControl()
  }

  if (!coarseBounds) {
    throw new GarupaRenderingError(
      'GARUPA_FRAME_RENDER_FAILED',
      'Garupa canonical calibration produced no coarse bounds.',
      { stage: 'measuring' },
    )
  }

  let coarseProjection
  try {
    coarseProjection = calculateLiveSDCanonicalCoarseProjection(
      coarseBounds,
      CODEX_PET_CELL_WIDTH,
      CODEX_PET_CELL_HEIGHT,
    )
  } catch (error) {
    throw new GarupaRenderingError(
      'GARUPA_FRAME_RENDER_FAILED',
      'Garupa coarse projection could not be calculated.',
      { stage: 'measuring' },
      { cause: error },
    )
  }
  input.session.setProjection(coarseProjection)

  let visibleBounds: LiveSDWorldBounds | null = null
  for (const frame of frames) {
    input.throwIfAborted(input.signal)
    try {
      applyGarupaPlannedFramePose(input.session, frame)
      drawGarupaRuntimeFrame(
        input.session,
        input.gl,
        CODEX_PET_CELL_WIDTH,
        CODEX_PET_CELL_HEIGHT,
      )
    } catch (error) {
      throw new GarupaRenderingError(
        'GARUPA_FRAME_RENDER_FAILED',
        'A Garupa calibration frame could not be rendered.',
        { ...frameContext(frame), stage: 'calibrating' },
        { cause: error },
      )
    }

    let rgba: Uint8ClampedArray
    try {
      rgba = readGarupaStraightRgba(
        input.gl,
        CODEX_PET_CELL_WIDTH,
        CODEX_PET_CELL_HEIGHT,
      )
    } catch (error) {
      if (isGarupaRenderingError(error)) throw error
      throw new GarupaRenderingError(
        'GARUPA_FRAME_READBACK_FAILED',
        'A Garupa calibration frame could not be read.',
        { ...frameContext(frame), stage: 'calibrating' },
        { cause: error },
      )
    }

    const alphaBounds = findLiveSDAlphaPixelBounds(
      rgba,
      CODEX_PET_CELL_WIDTH,
      CODEX_PET_CELL_HEIGHT,
    )
    if (!alphaBounds) {
      throw new GarupaRenderingError(
        'GARUPA_FRAME_RENDER_FAILED',
        'A Garupa calibration frame has no visible pixels.',
        { ...frameContext(frame), stage: 'calibrating' },
      )
    }

    try {
      visibleBounds = mergeLiveSDWorldBounds(
        visibleBounds,
        convertLiveSDAlphaPixelBoundsToWorld(
          alphaBounds,
          coarseProjection,
          CODEX_PET_CELL_WIDTH,
          CODEX_PET_CELL_HEIGHT,
        ),
      )
    } catch (error) {
      throw new GarupaRenderingError(
        'GARUPA_FRAME_RENDER_FAILED',
        'Garupa visible bounds could not be calibrated.',
        { ...frameContext(frame), stage: 'calibrating' },
        { cause: error },
      )
    }

    input.onCalibrated?.(frame)
    input.throwIfAborted(input.signal)
    await input.yieldControl()
  }

  if (!visibleBounds) {
    throw new GarupaRenderingError(
      'GARUPA_FRAME_RENDER_FAILED',
      'Garupa canonical calibration produced no visible bounds.',
      { stage: 'calibrating' },
    )
  }

  try {
    return {
      coarseProjection,
      mirroredProjection: calculateLiveSDFinalProjection(
        visibleBounds,
        CODEX_PET_CELL_WIDTH,
        CODEX_PET_CELL_HEIGHT,
        LIVE_SD_FRAME_INSET_PIXELS,
        input.framingScale,
        input.framingOffset,
        true,
      ),
      projection: calculateLiveSDFinalProjection(
        visibleBounds,
        CODEX_PET_CELL_WIDTH,
        CODEX_PET_CELL_HEIGHT,
        LIVE_SD_FRAME_INSET_PIXELS,
        input.framingScale,
        input.framingOffset,
        false,
      ),
      visibleBounds,
    }
  } catch (error) {
    throw new GarupaRenderingError(
      'GARUPA_FRAME_RENDER_FAILED',
      'Garupa final projection could not be calculated.',
      { stage: 'projection' },
      { cause: error },
    )
  }
}
