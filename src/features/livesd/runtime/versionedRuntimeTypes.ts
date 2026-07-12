export const SPINE_RUNTIME_KEYS = ['spine-3.6', 'spine-4.0'] as const

export type SpineRuntimeKey = (typeof SPINE_RUNTIME_KEYS)[number]

export interface SpineRuntimeSkeletonHeader {
  readonly hash: string | null
  readonly majorMinor: string
  readonly runtimeKey: SpineRuntimeKey
  readonly version: string
}

export interface SpineRuntimeAnimation {
  readonly duration: number
  readonly name: string
}

export interface SpineRuntimeBounds {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export type SpineRuntimeProjection = SpineRuntimeBounds

export interface SpineRuntimeDrawOrderEntry {
  readonly attachmentName: string | null
  readonly boneName: string
  readonly slotName: string
}

export type SpineRuntimeAtlasImage = HTMLImageElement | ImageBitmap

export interface SpineRuntimeSessionInput {
  readonly atlasText: string
  readonly gl: WebGLRenderingContext
  readonly resolveAtlasPage: (pageName: string) => SpineRuntimeAtlasImage
  readonly skeletonData: ArrayBuffer
}

export interface SpineRuntimeSession {
  readonly adapterIdentity: string
  readonly animations: readonly SpineRuntimeAnimation[]
  readonly currentAnimation: string
  readonly premultipliedAlpha: boolean
  readonly runtimeKey: SpineRuntimeKey
  readonly skeletonVersion: string
  applyAnimationAt(name: string, time: number, loop?: boolean): void
  dispose(): void
  draw(projection: SpineRuntimeProjection): void
  getBounds(): SpineRuntimeBounds
  getDrawOrder(): readonly SpineRuntimeDrawOrderEntry[]
  play(name: string, loop?: boolean): void
  update(delta: number): void
}

export interface SpineRuntimeProfileAdapter {
  readonly adapterIdentity: string
  readonly runtimeKey: SpineRuntimeKey
  createSession(input: SpineRuntimeSessionInput): Promise<SpineRuntimeSession>
  load(): Promise<void>
}

export interface SpineRuntimeSelection {
  readonly adapter: SpineRuntimeProfileAdapter
  readonly header: SpineRuntimeSkeletonHeader
}

export interface SpineRuntimeBoundHandoff<T> {
  readonly adapterIdentity: string
  readonly canonicalBounds: SpineRuntimeBounds | null
  readonly runtimeKey: SpineRuntimeKey
  readonly source: T
}
