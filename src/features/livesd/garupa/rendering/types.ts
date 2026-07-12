import type { CodexPetAnimationMappings } from '../../../codex-pet/animationMapping'
import type { CodexPetStateId } from '../../../codex-pet/contract'
import type { LiveSDFrameSamplingProgress } from '../../export/types'
import type { LiveSDAtlasBundle } from '../../model'
import type {
  LiveSDProjection,
  LiveSDWorldBounds,
} from '../../rendering/alphaBounds'
import type { LiveSDFramingOffset } from '../../rendering/framingOffset'
import type { LiveSDLookTarget } from '../../rendering/lookTarget'

export const GARUPA_SPINE_40_RUNTIME_KEY = 'spine-4.0' as const
export const GARUPA_LOOK_RIG_PROFILE = 'garupa-dual-eye-v1' as const

export interface GarupaSpine40Source {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly skeletonData: ArrayBuffer
  readonly version: string
  readonly compatibility: 'experimental' | 'verified'
}

export interface GarupaRuntimeAnimation {
  readonly name: string
  readonly duration: number
}

/** A version-independent mutable bone view owned by the runtime adapter. */
export interface GarupaRuntimeBone {
  readonly name: string
  readonly parent: GarupaRuntimeBone | null
  x: number
  y: number
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
}

export interface GarupaRuntimeAttachment {
  readonly name: string
  readonly alpha: number
  readonly width: number
  readonly height: number
}

export interface GarupaRuntimeSlot {
  readonly name: string
  readonly bone: GarupaRuntimeBone
  readonly alpha: number
  readonly attachment: GarupaRuntimeAttachment | null
}

export interface GarupaRuntimeApplyAnimationInput {
  readonly animationName: string
  readonly duration: number
  readonly loop: boolean
  /** The adapter must restore setup pose before applying this frame. */
  readonly resetToSetupPose: true
  readonly time: number
}

export interface GarupaRuntimeDrawOptions {
  readonly blend: 'src-alpha-one-minus-src-alpha'
  readonly layerOrder: 'runtime-draw-order'
  readonly mirrorX: boolean
  readonly premultipliedAlpha: false
}

/**
 * Consumer-facing Spine 4.0 facade. Implementations own every Spine/WebGL
 * object they create and release them from `dispose()` exactly once.
 */
export interface GarupaSpine40RuntimeSession {
  readonly adapterIdentity: string
  readonly animations: readonly GarupaRuntimeAnimation[]
  readonly runtimeKey: typeof GARUPA_SPINE_40_RUNTIME_KEY
  readonly slots: readonly GarupaRuntimeSlot[]
  readonly version: string
  applyAnimation(input: GarupaRuntimeApplyAnimationInput): void
  dispose(): void
  draw(options: GarupaRuntimeDrawOptions): void
  findBone(name: string): GarupaRuntimeBone | null
  getBounds(): LiveSDWorldBounds
  setProjection(projection: LiveSDProjection): void
  updateWorldTransform(): void
}

export interface GarupaSpine40RuntimeCreateInput {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly gl: WebGLRenderingContext
  readonly signal?: AbortSignal
  readonly skeletonData: ArrayBuffer
  readonly textureUpload: {
    readonly preserveRgb: true
    readonly unpackPremultiplyAlpha: false
  }
}

export interface GarupaSpine40RuntimeAdapter {
  readonly adapterIdentity: string
  readonly runtimeKey: typeof GARUPA_SPINE_40_RUNTIME_KEY
  createSession(
    input: GarupaSpine40RuntimeCreateInput,
  ): Promise<GarupaSpine40RuntimeSession>
}

export interface GarupaPlannedFrame {
  readonly animationDuration: number
  readonly animationName: string
  readonly column: number
  readonly frameIndex: number
  readonly lookDirectionDegrees?: number
  readonly lookDirectionIndex?: number
  readonly mirrorX: boolean
  readonly row: number
  readonly sampleTime: number
  readonly stateId: CodexPetStateId
}

export interface GarupaCanonicalProjection {
  readonly coarseProjection: LiveSDProjection
  readonly mirroredProjection: LiveSDProjection
  readonly projection: LiveSDProjection
  readonly visibleBounds: LiveSDWorldBounds
}

export interface GarupaAnimationFrameScheduler {
  cancel(handle: number): void
  request(callback: FrameRequestCallback): number
}

export interface GarupaSpine40PreviewInput extends GarupaSpine40Source {
  readonly canvas: HTMLCanvasElement
  readonly mappings?: CodexPetAnimationMappings
}

export interface GarupaSpine40PreviewCreateOptions {
  readonly signal?: AbortSignal
}

export interface GarupaSpine40PreviewSession {
  readonly adapterIdentity: string
  readonly animations: readonly string[]
  readonly compatibility: 'experimental' | 'verified'
  readonly currentAnimation: string
  readonly framingOffset: LiveSDFramingOffset
  readonly framingScale: number
  readonly lookRigSupported: boolean
  readonly runtimeKey: typeof GARUPA_SPINE_40_RUNTIME_KEY
  readonly version: string
  dispose(): void
  onError(listener: (error: Error) => void): () => void
  play(name: string): void
  resize(width: number, height: number): void
  setFramingOffset(offset: LiveSDFramingOffset): void
  setFramingScale(scale: number): void
  setLookTarget(target: LiveSDLookTarget | null, movementScale?: number): void
  setMirrorX(mirrorX: boolean): void
}

export interface GarupaSpine40PreviewCreator {
  createPreview(
    input: GarupaSpine40PreviewInput,
    options?: GarupaSpine40PreviewCreateOptions,
  ): Promise<GarupaSpine40PreviewSession>
}

export interface GarupaFrameSamplingInput {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly expectedAdapterIdentity?: string
  readonly framingOffset?: LiveSDFramingOffset
  readonly framingScale?: number
  readonly globalMirrorX?: boolean
  readonly lookMovementScale?: number
  readonly mappings: CodexPetAnimationMappings
  readonly onProgress?: (progress: LiveSDFrameSamplingProgress) => void
  readonly signal?: AbortSignal
  readonly skeletonData: ArrayBuffer
}

export interface GarupaFrameSamplingResult {
  readonly adapterIdentity: string
  readonly atlasPng: Blob
  readonly frameCount: number
  readonly height: number
  readonly runtimeKey: typeof GARUPA_SPINE_40_RUNTIME_KEY
  readonly width: number
}

export type GarupaFrameSamplerCanvasKind =
  | 'atlas-2d'
  | 'cell-2d'
  | 'frame-webgl'

export type GarupaFrameSamplerCanvasFactory = (
  kind: GarupaFrameSamplerCanvasKind,
  width: number,
  height: number,
) => HTMLCanvasElement

export type GarupaFrameSamplerPngEncoder = (
  canvas: HTMLCanvasElement,
) => Promise<Blob>
