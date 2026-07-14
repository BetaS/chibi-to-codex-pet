import {
  resolveCodexPetMirrorX,
  type CodexPetAnimationMappings,
} from '../../../codex-pet/animationMapping'
import {
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_STATES,
  CODEX_PET_TOTAL_FRAME_COUNT,
} from '../../../codex-pet/contract'
import { GarupaRenderingError } from './errors'
import type { GarupaPlannedFrame } from './types'

export function calculateGarupaSampleTimes(
  duration: number,
  frameCount: number,
): readonly number[] {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError('Animation duration must be finite and non-negative.')
  }
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new RangeError('Frame count must be a positive integer.')
  }

  return Array.from(
    { length: frameCount },
    (_, frameIndex) => (duration * frameIndex) / frameCount,
  )
}

export function createGarupaFramePlan(
  mappings: CodexPetAnimationMappings,
  animationDurations: ReadonlyMap<string, number>,
  globalMirrorX = false,
): readonly GarupaPlannedFrame[] {
  const frames: GarupaPlannedFrame[] = []

  for (const state of CODEX_PET_STATES) {
    const mapping = mappings[state.id]
    const duration = animationDurations.get(mapping?.animationName ?? '')
    if (!mapping || duration === undefined) {
      throw new GarupaRenderingError(
        'GARUPA_ANIMATION_MISSING',
        'A mapped Garupa animation is missing.',
        { stateId: state.id },
      )
    }

    let sampleTimes: readonly number[]
    try {
      sampleTimes = calculateGarupaSampleTimes(duration, state.frameCount)
    } catch (error) {
      throw new GarupaRenderingError(
        'GARUPA_ANIMATION_MISSING',
        'A mapped Garupa animation has an invalid duration.',
        { animationName: mapping.animationName, stateId: state.id },
        { cause: error },
      )
    }

    for (let frameIndex = 0; frameIndex < state.frameCount; frameIndex += 1) {
      frames.push({
        animationDuration: duration,
        animationName: mapping.animationName,
        column: frameIndex,
        frameIndex,
        mirrorX: resolveCodexPetMirrorX(globalMirrorX, mapping.mirrorX),
        row: state.row,
        sampleTime: sampleTimes[frameIndex] ?? 0,
        stateId: state.id,
      })
    }
  }

  const idleMapping = mappings.idle
  const idleDuration = animationDurations.get(idleMapping?.animationName ?? '')
  if (!idleMapping || idleDuration === undefined) {
    throw new GarupaRenderingError(
      'GARUPA_ANIMATION_MISSING',
      'The idle Garupa animation is missing.',
      { stateId: 'idle' },
    )
  }

  for (const direction of CODEX_PET_LOOK_DIRECTIONS) {
    frames.push({
      animationDuration: idleDuration,
      animationName: idleMapping.animationName,
      column: direction.column,
      frameIndex: direction.column,
      lookDirectionDegrees: globalMirrorX
        ? (360 - direction.angleDegrees) % 360
        : direction.angleDegrees,
      lookDirectionIndex: direction.index,
      mirrorX: globalMirrorX,
      row: direction.row,
      sampleTime: 0,
      stateId: 'idle',
    })
  }

  if (frames.length !== CODEX_PET_TOTAL_FRAME_COUNT) {
    throw new GarupaRenderingError(
      'GARUPA_RENDERING_FAILED',
      'The Garupa frame plan has an invalid size.',
      { actual: frames.length, expected: CODEX_PET_TOTAL_FRAME_COUNT },
    )
  }

  return frames
}
