import { LiveSDPreviewError } from './errors'
import type {
  LiveSDSkeletonCompatibility,
  LiveSDPreviewSession,
} from './types'
import type { LoadedAtlasImage } from './atlasImageLoader'
import {
  convertLiveSDAlphaPixelBoundsToWorld,
  findLiveSDAlphaPixelBounds,
  type LiveSDProjection,
  type LiveSDWorldBounds,
} from '../rendering/alphaBounds'
import {
  assertLiveSDFramingScale,
  LIVE_SD_FRAMING_SCALE_DEFAULT,
} from '../rendering/framingScale'
import {
  assertLiveSDFramingOffset,
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  LIVE_SD_FRAMING_OFFSET_REFERENCE_HEIGHT,
  LIVE_SD_FRAMING_OFFSET_REFERENCE_WIDTH,
  type LiveSDFramingOffset,
} from '../rendering/framingOffset'
import { prepareLiveSD2DWebGLState } from '../rendering/prepareLiveSD2DWebGLState'
import {
  calculateLiveSDLookWorldDeltaFromTarget,
  convertLiveSDWorldDeltaToLocal,
  LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX,
  LIVE_SD_LOOK_VERTICAL_RADIUS_PX,
  normalizeLiveSDLookTarget,
  type LiveSDLookDelta,
  type LiveSDLookTarget,
} from '../rendering/lookTarget'

const PREVIEW_PADDING_SCALE = 1.2

export interface AnimationFrameScheduler {
  request(callback: FrameRequestCallback): number
  cancel(handle: number): void
}

export const browserAnimationFrameScheduler: AnimationFrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
}

export interface WebGLLiveSDPreviewSessionOptions {
  readonly animationState: spine.AnimationState
  readonly animations: readonly string[]
  readonly atlas: spine.TextureAtlas
  readonly batcher: spine.webgl.PolygonBatcher
  readonly bounds: {
    readonly offset: spine.Vector2
    readonly size: spine.Vector2
  }
  readonly canvas: HTMLCanvasElement
  readonly compatibility: LiveSDSkeletonCompatibility
  readonly gl: WebGLRenderingContext
  readonly images: readonly LoadedAtlasImage[]
  readonly matrix: spine.webgl.Matrix4
  readonly renderer: spine.webgl.SkeletonRenderer
  readonly scheduler?: AnimationFrameScheduler
  readonly shader: spine.webgl.Shader
  readonly skeleton: spine.Skeleton
  readonly version: string
}

function worldBoundsFromVectors(
  bounds: WebGLLiveSDPreviewSessionOptions['bounds'],
): LiveSDWorldBounds {
  const minX = Math.min(bounds.offset.x, bounds.offset.x + bounds.size.x)
  const minY = Math.min(bounds.offset.y, bounds.offset.y + bounds.size.y)
  const maxX = Math.max(bounds.offset.x, bounds.offset.x + bounds.size.x)
  const maxY = Math.max(bounds.offset.y, bounds.offset.y + bounds.size.y)
  if (
    ![minX, minY, maxX, maxY].every(Number.isFinite) ||
    maxX <= minX ||
    maxY <= minY
  ) {
    throw new Error('LiveSD preview bounds must have finite positive dimensions.')
  }
  return { minX, minY, maxX, maxY }
}

function calculatePreviewProjection(
  bounds: LiveSDWorldBounds,
  targetWidth: number,
  targetHeight: number,
  framingScale = LIVE_SD_FRAMING_SCALE_DEFAULT,
  framingOffset: LiveSDFramingOffset = LIVE_SD_FRAMING_OFFSET_DEFAULT,
  mirrorX = false,
): LiveSDProjection {
  assertLiveSDFramingScale(framingScale)
  assertLiveSDFramingOffset(framingOffset)
  const boundsWidth = bounds.maxX - bounds.minX
  const boundsHeight = bounds.maxY - bounds.minY
  const canvasAspect = targetWidth / targetHeight
  let baseWidth = boundsWidth * PREVIEW_PADDING_SCALE
  let baseHeight = boundsHeight * PREVIEW_PADDING_SCALE

  if (baseWidth / baseHeight < canvasAspect) {
    baseWidth = baseHeight * canvasAspect
  } else {
    baseHeight = baseWidth / canvasAspect
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const baseY = centerY - baseHeight / 2
  const bottomAnchor = (bounds.minY - baseY) / baseHeight
  const width = baseWidth / framingScale
  const height = baseHeight / framingScale
  const offsetWorldX =
    (framingOffset.x / LIVE_SD_FRAMING_OFFSET_REFERENCE_WIDTH) * width
  const offsetWorldY =
    (framingOffset.y / LIVE_SD_FRAMING_OFFSET_REFERENCE_HEIGHT) * height
  return {
    x: centerX - width / 2 + (mirrorX ? offsetWorldX : -offsetWorldX),
    y: bounds.minY - bottomAnchor * height + offsetWorldY,
    width,
    height,
  }
}

function flipPreviewRgbaRows(
  source: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const output = new Uint8Array(source.length)
  const rowBytes = width * 4
  for (let sourceRow = 0; sourceRow < height; sourceRow += 1) {
    const sourceOffset = sourceRow * rowBytes
    const targetOffset = (height - sourceRow - 1) * rowBytes
    output.set(source.subarray(sourceOffset, sourceOffset + rowBytes), targetOffset)
  }
  return output
}

export class WebGLLiveSDPreviewSession implements LiveSDPreviewSession {
  readonly animations: readonly string[]
  readonly compatibility: LiveSDSkeletonCompatibility
  readonly version: string

  readonly #animationState: spine.AnimationState
  readonly #atlas: spine.TextureAtlas
  readonly #batcher: spine.webgl.PolygonBatcher
  readonly #bounds: WebGLLiveSDPreviewSessionOptions['bounds']
  readonly #canvas: HTMLCanvasElement
  readonly #gl: WebGLRenderingContext
  readonly #images: readonly LoadedAtlasImage[]
  readonly #matrix: spine.webgl.Matrix4
  readonly #renderer: spine.webgl.SkeletonRenderer
  readonly #scheduler: AnimationFrameScheduler
  readonly #shader: spine.webgl.Shader
  readonly #skeleton: spine.Skeleton

  #currentAnimation: string
  #cssHeight = 1
  #cssWidth = 1
  #disposed = false
  readonly #errorListeners = new Set<(error: LiveSDPreviewError) => void>()
  #frameHandle: number | null = null
  #framingOffset: LiveSDFramingOffset = LIVE_SD_FRAMING_OFFSET_DEFAULT
  #framingScale = LIVE_SD_FRAMING_SCALE_DEFAULT
  #lastFrameTime: number | null = null
  #lookMovementScale = 1
  #lookTarget: LiveSDLookTarget | null = null
  #lookOffsetBone: spine.Bone | null = null
  #lookOffsetLocal: LiveSDLookDelta = { x: 0, y: 0 }
  #mirrorX = false
  #projection: LiveSDProjection
  #started = false
  #viewBounds: LiveSDWorldBounds

  constructor(options: WebGLLiveSDPreviewSessionOptions) {
    this.animations = Object.freeze([...options.animations])
    this.compatibility = options.compatibility
    this.version = options.version
    this.#animationState = options.animationState
    this.#atlas = options.atlas
    this.#batcher = options.batcher
    this.#bounds = options.bounds
    this.#canvas = options.canvas
    this.#gl = options.gl
    this.#images = options.images
    this.#matrix = options.matrix
    this.#renderer = options.renderer
    this.#scheduler = options.scheduler ?? browserAnimationFrameScheduler
    this.#shader = options.shader
    this.#skeleton = options.skeleton
    this.#viewBounds = worldBoundsFromVectors(this.#bounds)
    this.#projection = calculatePreviewProjection(this.#viewBounds, 1, 1)
    this.#currentAnimation =
      this.animations.find((name) => name === 'pose_default') ??
      this.animations[0] ??
      ''

    if (!this.#currentAnimation) {
      throw new LiveSDPreviewError(
        'ANIMATION_MISSING',
        '공통 스켈레톤에 재생할 애니메이션이 없습니다.',
      )
    }

    this.play(this.#currentAnimation)
    this.resize(
      Math.max(this.#canvas.clientWidth, 1),
      Math.max(this.#canvas.clientHeight, 1),
    )
  }

  get currentAnimation(): string {
    return this.#currentAnimation
  }

  get framingScale(): number {
    return this.#framingScale
  }

  get framingOffset(): LiveSDFramingOffset {
    return { ...this.#framingOffset }
  }

  start(): void {
    if (this.#started || this.#disposed) {
      return
    }

    try {
      this.#calibrateAndDrawCurrentPose()
    } catch (error) {
      throw new LiveSDPreviewError(
        'PREVIEW_RENDER_FAILED',
        'LiveSD WebGL 미리보기의 첫 프레임을 렌더링하지 못했습니다.',
        { cause: error },
      )
    }

    this.#started = true
    this.#frameHandle = this.#scheduler.request(this.#renderFrame)
  }

  onError(listener: (error: LiveSDPreviewError) => void): () => void {
    if (this.#disposed) {
      return () => undefined
    }

    this.#errorListeners.add(listener)
    let subscribed = true

    return () => {
      if (!subscribed) {
        return
      }
      subscribed = false
      this.#errorListeners.delete(listener)
    }
  }

  play(name: string): void {
    if (this.#disposed || !this.animations.includes(name)) {
      throw new LiveSDPreviewError(
        'ANIMATION_UNKNOWN',
        `재생할 수 없는 애니메이션입니다: ${name}`,
      )
    }

    this.#removeAppliedLookOffset()
    this.#skeleton.setToSetupPose()
    this.#animationState.setAnimation(0, name, true)
    this.#currentAnimation = name
    this.#lastFrameTime = null

    if (this.#started) {
      try {
        this.#calibrateAndDrawCurrentPose()
      } catch (error) {
        throw new LiveSDPreviewError(
          'PREVIEW_RENDER_FAILED',
          '선택한 animation의 가시 영역을 보정해 렌더링하지 못했습니다.',
          { cause: error },
        )
      }
    }
  }

  resize(width: number, height: number): void {
    if (this.#disposed) {
      return
    }

    const cssWidth = Math.max(Math.floor(width), 1)
    const cssHeight = Math.max(Math.floor(height), 1)
    this.#cssWidth = cssWidth
    this.#cssHeight = cssHeight
    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1)
    const backingWidth = Math.max(Math.floor(cssWidth * pixelRatio), 1)
    const backingHeight = Math.max(Math.floor(cssHeight * pixelRatio), 1)

    if (this.#canvas.width !== backingWidth) {
      this.#canvas.width = backingWidth
    }
    if (this.#canvas.height !== backingHeight) {
      this.#canvas.height = backingHeight
    }

    this.#gl.viewport(0, 0, backingWidth, backingHeight)
    this.#setProjectionForBounds(this.#viewBounds)

    if (this.#started && this.#lookTarget) {
      this.#drawFrame(0)
    }
  }

  setFramingScale(scale: number): void {
    assertLiveSDFramingScale(scale)
    if (this.#disposed || scale === this.#framingScale) {
      return
    }

    const previousScale = this.#framingScale
    this.#framingScale = scale
    this.#setProjectionForBounds(this.#viewBounds)

    if (!this.#started) {
      return
    }

    try {
      if (this.#lookTarget) {
        this.#applyFrame(0)
      }
      this.#drawAppliedPose()
    } catch (error) {
      this.#framingScale = previousScale
      this.#setProjectionForBounds(this.#viewBounds)
      throw new LiveSDPreviewError(
        'PREVIEW_RENDER_FAILED',
        '선택한 Pet 크기로 LiveSD 미리보기를 렌더링하지 못했습니다.',
        { cause: error },
      )
    }
  }

  setFramingOffset(offset: LiveSDFramingOffset): void {
    assertLiveSDFramingOffset(offset)
    if (
      this.#disposed ||
      (offset.x === this.#framingOffset.x && offset.y === this.#framingOffset.y)
    ) {
      return
    }

    const previousOffset = this.#framingOffset
    this.#framingOffset = { ...offset }
    this.#setProjectionForBounds(this.#viewBounds)

    if (!this.#started) {
      return
    }

    try {
      if (this.#lookTarget) {
        this.#applyFrame(0)
      }
      this.#drawAppliedPose()
    } catch (error) {
      this.#framingOffset = previousOffset
      this.#setProjectionForBounds(this.#viewBounds)
      throw new LiveSDPreviewError(
        'PREVIEW_RENDER_FAILED',
        '선택한 X/Y 위치로 LiveSD 미리보기를 렌더링하지 못했습니다.',
        { cause: error },
      )
    }
  }

  setLookTarget(
    target: LiveSDLookTarget | null,
    movementScale = 1,
  ): void {
    if (this.#disposed) {
      return
    }
    if (!Number.isFinite(movementScale) || movementScale < 0) {
      throw new RangeError('LiveSD look movement scale must be finite and non-negative.')
    }

    const nextTarget = target
      ? normalizeLiveSDLookTarget(target.x, target.y)
      : null
    if (nextTarget && !this.#findLookBone()) {
      throw new LiveSDPreviewError(
        'LOOK_RIG_MISSING',
        '시선을 미리보기할 eye_scale bone을 찾을 수 없습니다.',
      )
    }

    const previousTarget = this.#lookTarget
    const previousMovementScale = this.#lookMovementScale
    this.#lookTarget = nextTarget
    this.#lookMovementScale = movementScale

    if (!this.#started) {
      return
    }

    try {
      this.#drawFrame(0)
    } catch (error) {
      this.#lookTarget = previousTarget
      this.#lookMovementScale = previousMovementScale
      this.#safely(() => this.#drawFrame(0))
      if (error instanceof RangeError) {
        throw new LiveSDPreviewError(
          'LOOK_RIG_MISSING',
          '눈 bone의 좌표 변환이 불안정하여 시선을 미리보기할 수 없습니다.',
          { cause: error },
        )
      }
      throw new LiveSDPreviewError(
        'PREVIEW_RENDER_FAILED',
        '포인터 시선을 LiveSD WebGL 미리보기에 렌더링하지 못했습니다.',
        { cause: error },
      )
    }
  }

  setMirrorX(mirrorX: boolean): void {
    if (this.#disposed || mirrorX === this.#mirrorX) {
      return
    }

    const previousMirrorX = this.#mirrorX
    this.#mirrorX = mirrorX
    this.#setProjectionForBounds(this.#viewBounds)

    if (!this.#started) {
      return
    }

    try {
      if (this.#lookTarget) {
        this.#applyFrame(0)
      }
      this.#drawAppliedPose()
    } catch (error) {
      this.#mirrorX = previousMirrorX
      this.#setProjectionForBounds(this.#viewBounds)
      this.#safely(() => {
        if (this.#lookTarget) {
          this.#applyFrame(0)
        }
        this.#drawAppliedPose()
      })
      throw new LiveSDPreviewError(
        'PREVIEW_RENDER_FAILED',
        '선택한 수평 반전으로 LiveSD 미리보기를 렌더링하지 못했습니다.',
        { cause: error },
      )
    }
  }

  dispose(): void {
    if (this.#disposed) {
      return
    }

    this.#disposed = true
    if (this.#frameHandle !== null) {
      this.#safely(() => this.#scheduler.cancel(this.#frameHandle ?? 0))
      this.#frameHandle = null
    }

    this.#safely(() => this.#animationState.clearTracks())
    this.#safely(() => this.#batcher.dispose())
    this.#safely(() => this.#shader.dispose())
    this.#safely(() => this.#atlas.dispose())
    for (const image of this.#images) {
      this.#safely(() => image.dispose())
    }

    this.#safely(() => {
      this.#gl.clearColor(0, 0, 0, 0)
      this.#gl.clear(this.#gl.COLOR_BUFFER_BIT)
    })
    this.#errorListeners.clear()
  }

  readonly #renderFrame: FrameRequestCallback = (frameTime) => {
    if (this.#disposed) {
      return
    }

    const delta =
      this.#lastFrameTime === null
        ? 0
        : Math.min(Math.max((frameTime - this.#lastFrameTime) / 1000, 0), 0.1)
    this.#lastFrameTime = frameTime

    try {
      this.#drawFrame(delta)
      this.#frameHandle = this.#scheduler.request(this.#renderFrame)
    } catch (error) {
      this.#failRender(error)
    }
  }

  #drawFrame(delta: number): void {
    this.#applyFrame(delta)
    this.#drawAppliedPose()
  }

  #applyFrame(delta: number, applyLookTarget = true): void {
    this.#removeAppliedLookOffset()
    this.#animationState.update(delta)
    this.#animationState.apply(this.#skeleton)
    this.#skeleton.updateWorldTransform()
    if (applyLookTarget) {
      this.#applyLookTargetToCurrentPose()
    }
  }

  #findLookBone(): spine.Bone | null {
    const eyeBone = this.#skeleton.findBone('eye_scale') as spine.Bone | null
    return eyeBone?.parent ? eyeBone : null
  }

  #removeAppliedLookOffset(): void {
    if (this.#lookOffsetBone) {
      this.#lookOffsetBone.x -= this.#lookOffsetLocal.x
      this.#lookOffsetBone.y -= this.#lookOffsetLocal.y
    }
    this.#lookOffsetBone = null
    this.#lookOffsetLocal = { x: 0, y: 0 }
  }

  #applyLookTargetToCurrentPose(): void {
    if (!this.#lookTarget) {
      return
    }

    const eyeBone = this.#findLookBone()
    if (!eyeBone) {
      throw new RangeError('LiveSD eye_scale bone must have a parent transform.')
    }
    const lookTarget = this.#mirrorX
      ? { x: -this.#lookTarget.x, y: this.#lookTarget.y }
      : this.#lookTarget
    const worldDelta = calculateLiveSDLookWorldDeltaFromTarget(
      this.#projection,
      lookTarget,
      LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX * this.#lookMovementScale,
      LIVE_SD_LOOK_VERTICAL_RADIUS_PX * this.#lookMovementScale,
    )
    const localDelta = convertLiveSDWorldDeltaToLocal(
      {
        a: eyeBone.parent.a,
        b: eyeBone.parent.b,
        c: eyeBone.parent.c,
        d: eyeBone.parent.d,
      },
      worldDelta,
    )
    eyeBone.x += localDelta.x
    eyeBone.y += localDelta.y
    this.#lookOffsetBone = eyeBone
    this.#lookOffsetLocal = localDelta
    this.#skeleton.updateWorldTransform()
  }

  #drawAppliedPose(): void {
    prepareLiveSD2DWebGLState(this.#gl)
    this.#gl.clearColor(0, 0, 0, 0)
    this.#gl.clear(this.#gl.COLOR_BUFFER_BIT)
    this.#shader.bind()
    try {
      this.#shader.setUniformi('u_texture', 0)
      this.#shader.setUniform4x4f(
        'u_projTrans',
        this.#matrix.values,
      )
      this.#batcher.begin(this.#shader)
      try {
        this.#renderer.premultipliedAlpha = true
        this.#renderer.draw(this.#batcher, this.#skeleton)
      } finally {
        this.#batcher.end()
      }
    } finally {
      this.#shader.unbind()
    }
  }

  #calibrateAndDrawCurrentPose(): void {
    this.#applyFrame(0, false)
    this.#skeleton.getBounds(this.#bounds.offset, this.#bounds.size, [])
    const coarseBounds = worldBoundsFromVectors(this.#bounds)
    this.#setProjectionForBounds(
      coarseBounds,
      LIVE_SD_FRAMING_SCALE_DEFAULT,
      false,
      LIVE_SD_FRAMING_OFFSET_DEFAULT,
    )
    this.#drawAppliedPose()

    const pixelWidth = this.#canvas.width
    const pixelHeight = this.#canvas.height
    const bottomUpRgba = new Uint8Array(pixelWidth * pixelHeight * 4)
    this.#gl.readPixels(
      0,
      0,
      pixelWidth,
      pixelHeight,
      this.#gl.RGBA,
      this.#gl.UNSIGNED_BYTE,
      bottomUpRgba,
    )
    const topDownRgba = flipPreviewRgbaRows(
      bottomUpRgba,
      pixelWidth,
      pixelHeight,
    )
    const alphaBounds = findLiveSDAlphaPixelBounds(
      topDownRgba,
      pixelWidth,
      pixelHeight,
    )
    if (!alphaBounds) {
      throw new Error('LiveSD preview calibration frame is fully transparent.')
    }

    const visibleBounds = convertLiveSDAlphaPixelBoundsToWorld(
      alphaBounds,
      this.#projection,
      pixelWidth,
      pixelHeight,
    )
    this.#setProjectionForBounds(visibleBounds)
    this.#applyLookTargetToCurrentPose()
    this.#drawAppliedPose()
  }

  #setProjectionForBounds(
    bounds: LiveSDWorldBounds,
    framingScale = this.#framingScale,
    mirrorX = this.#mirrorX,
    framingOffset = this.#framingOffset,
  ): void {
    this.#viewBounds = bounds
    this.#projection = calculatePreviewProjection(
      bounds,
      this.#cssWidth,
      this.#cssHeight,
      framingScale,
      framingOffset,
      mirrorX,
    )
    this.#matrix.ortho2d(
      mirrorX
        ? this.#projection.x + this.#projection.width
        : this.#projection.x,
      this.#projection.y,
      mirrorX ? -this.#projection.width : this.#projection.width,
      this.#projection.height,
    )
  }

  #failRender(cause: unknown): void {
    if (this.#disposed) {
      return
    }

    const error = new LiveSDPreviewError(
      'PREVIEW_RENDER_FAILED',
      'LiveSD WebGL 미리보기를 계속 렌더링하지 못했습니다.',
      { cause },
    )
    const listeners = [...this.#errorListeners]
    this.dispose()

    for (const listener of listeners) {
      this.#safely(() => listener(error))
    }
  }

  #safely(action: () => void): void {
    try {
      action()
    } catch {
      // Cleanup and observer failures must not mask the original render error.
    }
  }
}
