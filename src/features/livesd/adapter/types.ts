import type { CodexPetAnimationMappings } from '../../codex-pet/animationMapping'
import type { LiveSDAtlasBundle } from '../model'
import type { LiveSDLookTarget } from '../rendering/lookTarget'
import type { LiveSDFramingOffset } from '../rendering/framingOffset'
import type { LiveSDPreviewError } from './errors'

export type LiveSDSkeletonCompatibility =
  | 'best_effort'
  | 'experimental'
  | 'verified'

export interface LiveSDSkeletonHeader {
  readonly hash: string | null
  readonly version: string
  readonly compatibility: LiveSDSkeletonCompatibility
}

export interface LiveSD36PreviewInput {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly canvas: HTMLCanvasElement
  readonly skeletonData: ArrayBuffer
}

export interface LiveSDPreviewSession {
  readonly animations: readonly string[]
  readonly compatibility: LiveSDSkeletonCompatibility
  readonly currentAnimation: string
  readonly framingOffset: LiveSDFramingOffset
  readonly framingScale: number
  readonly version: string
  onError(listener: (error: LiveSDPreviewError) => void): () => void
  play(name: string): void
  resize(width: number, height: number): void
  setAnimationMappings(mappings: Readonly<CodexPetAnimationMappings>): void
  setFramingOffset(offset: LiveSDFramingOffset): void
  setFramingScale(scale: number): void
  setLookTarget(target: LiveSDLookTarget | null, movementScale?: number): void
  setMirrorX(mirrorX: boolean): void
  dispose(): void
}

export interface LiveSD36AdapterContract {
  inspectSkeleton(data: ArrayBuffer): LiveSDSkeletonHeader
  createPreview(input: LiveSD36PreviewInput): Promise<LiveSDPreviewSession>
}
