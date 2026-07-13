import type { CodexPetAnimationMappings } from '../../codex-pet/animationMapping'
import type { CodexPetStateId } from '../../codex-pet/contract'
import type { LiveSDAtlasBundle } from '../model'
import type { LiveSDFramingOffset } from '../rendering/framingOffset'
import type { LiveSDLookRigFallback } from '../rendering/lookRigFallback'

export type LiveSDFrameSamplingPhase =
  | 'preparing'
  | 'measuring'
  | 'calibrating'
  | 'rendering'
  | 'encoding'
  | 'complete'

export interface LiveSDFrameSamplingProgress {
  readonly phase: LiveSDFrameSamplingPhase
  readonly completedSteps: number
  readonly totalSteps: number
  /** A normalized value in the inclusive range 0...1. */
  readonly fraction: number
  readonly stateId?: CodexPetStateId
  readonly frameIndex?: number
  readonly lookDirectionIndex?: number
}

export interface LiveSDFrameSamplingInput {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly globalMirrorX?: boolean
  /** Relative to the automatic alpha-safe projection. */
  readonly framingScale?: number
  /** Final 192×208 cell pixel offset; positive X is right and positive Y is down. */
  readonly framingOffset?: LiveSDFramingOffset
  /** Relative to the calibrated 2px × 1.5px Codex Pet look radius. */
  readonly lookMovementScale?: number
  /** Render look cells without eye offsets when this source has no usable rig. */
  readonly lookRigFallback?: LiveSDLookRigFallback
  readonly skeletonData: ArrayBuffer
  readonly mappings: CodexPetAnimationMappings
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: LiveSDFrameSamplingProgress) => void
}

export interface LiveSDFrameSamplingResult {
  readonly atlasPng: Blob
  readonly width: number
  readonly height: number
  readonly frameCount: number
}

export interface LiveSDFrameSamplerContract {
  sample(input: LiveSDFrameSamplingInput): Promise<LiveSDFrameSamplingResult>
}
