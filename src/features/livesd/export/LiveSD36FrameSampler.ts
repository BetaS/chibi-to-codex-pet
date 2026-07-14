import {
  resolveCodexPetMirrorX,
  type CodexPetAnimationMappings,
} from '../../codex-pet/animationMapping'
import {
  CODEX_PET_ATLAS_HEIGHT,
  CODEX_PET_ATLAS_WIDTH,
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_STANDARD_FRAME_COUNT,
  CODEX_PET_STATES,
  CODEX_PET_TOTAL_FRAME_COUNT,
  type CodexPetStateId,
} from '../../codex-pet/contract'
import {
  assertCodexPetLookMovementScale,
  CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
} from '../../codex-pet/lookMovementScale'
import { resolveAtlasPagePath, type LiveSDAtlasBundle } from '../model'
import {
  liveSD36RuntimeLoader,
  type LiveSD36RuntimeLoader,
  type Spine36Runtime,
} from '../runtime/runtimeLoader'
import {
  loadAtlasImage,
  type AtlasImageLoader,
  type LoadedAtlasImage,
} from '../adapter/atlasImageLoader'
import { appendSkeletonTerminator } from '../adapter/skeletonPadding'
import {
  isLiveSDFrameSamplingError,
  LiveSDFrameSamplingError,
  throwIfSamplingAborted,
} from './errors'
import {
  calculateLiveSDFinalProjection,
  convertLiveSDAlphaPixelBoundsToWorld,
  findLiveSDAlphaPixelBounds,
  LIVE_SD_FRAME_INSET_PIXELS,
  mergeLiveSDWorldBounds,
} from '../rendering/alphaBounds'
import {
  calculateLiveSDCanonicalCoarseProjection,
  LIVE_SD_CANONICAL_BOUNDS_PADDING_RATIO,
} from '../rendering/canonicalProjection'
import {
  assertLiveSDFramingScale,
  LIVE_SD_FRAMING_SCALE_DEFAULT,
} from '../rendering/framingScale'
import {
  assertLiveSDFramingOffset,
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
} from '../rendering/framingOffset'
import { prepareLiveSD2DWebGLState } from '../rendering/prepareLiveSD2DWebGLState'
import { unpremultiplyRgba } from '../rendering/premultipliedAlpha'
import {
  calculateLiveSDLookWorldDelta as calculateSharedLiveSDLookWorldDelta,
  convertLiveSDWorldDeltaToLocal as convertSharedLiveSDWorldDeltaToLocal,
  LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX,
  LIVE_SD_LOOK_VERTICAL_RADIUS_PX,
} from '../rendering/lookTarget'
import type {
  LiveSDFrameSamplerContract,
  LiveSDFrameSamplingInput,
  LiveSDFrameSamplingPhase,
  LiveSDFrameSamplingResult,
} from './types'
import type { LiveSDLookRigFallback } from '../rendering/lookRigFallback'

const TOTAL_PROGRESS_STEPS =
  CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT + 1

export interface LiveSDFrameBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface LiveSDFrameProjection {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface LiveSDPlannedFrame {
  readonly stateId: CodexPetStateId
  readonly row: number
  readonly frameIndex: number
  readonly animationName: string
  readonly animationDuration: number
  readonly sampleTime: number
  readonly mirrorX: boolean
  readonly lookDirectionIndex?: number
  readonly lookDirectionDegrees?: number
}

export interface LiveSDWorldDelta {
  readonly x: number
  readonly y: number
}

export interface LiveSDMatrix2x2 {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
}

export type LiveSDFrameSamplerCanvasKind =
  | 'frame-webgl'
  | 'atlas-2d'
  | 'cell-2d'

export type LiveSDFrameSamplerCanvasFactory = (
  kind: LiveSDFrameSamplerCanvasKind,
  width: number,
  height: number,
) => HTMLCanvasElement

export type LiveSDFrameSamplerPngEncoder = (
  canvas: HTMLCanvasElement,
) => Promise<Blob>

export interface LiveSD36FrameSamplerOptions {
  readonly imageLoader?: AtlasImageLoader
  readonly runtimeLoader?: Pick<LiveSD36RuntimeLoader, 'load'>
  readonly canvasFactory?: LiveSDFrameSamplerCanvasFactory
  readonly pngEncoder?: LiveSDFrameSamplerPngEncoder
  /** Injected by tests; production uses MessageChannel and never wall-clock time. */
  readonly yieldControl?: () => Promise<void>
}

interface RuntimeSamplingSession {
  readonly animations: ReadonlyMap<string, spine.Animation>
  readonly atlas: spine.TextureAtlas
  readonly batcher: spine.webgl.PolygonBatcher
  readonly matrix: spine.webgl.Matrix4
  readonly renderer: spine.webgl.SkeletonRenderer
  readonly shader: spine.webgl.Shader
  readonly skeleton: spine.Skeleton
  dispose(): void
}

function defaultCanvasFactory(
  _kind: LiveSDFrameSamplerCanvasKind,
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
  if (typeof MessageChannel === 'undefined') {
    return Promise.resolve()
  }

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
    // Cleanup failures must not hide the sampling result or its original error.
  }
}

export function calculateLiveSDSampleTimes(
  duration: number,
  frameCount: number,
): readonly number[] {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError('Animation duration must be a finite non-negative value.')
  }
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new RangeError('Frame count must be a positive integer.')
  }

  return Array.from(
    { length: frameCount },
    (_, frameIndex) => (duration * frameIndex) / frameCount,
  )
}

export function createLiveSDFramePlan(
  mappings: CodexPetAnimationMappings,
  animationDurations: ReadonlyMap<string, number>,
  globalMirrorX = false,
): readonly LiveSDPlannedFrame[] {
  const frames: LiveSDPlannedFrame[] = []

  for (const state of CODEX_PET_STATES) {
    const mapping = mappings[state.id]
    const duration = animationDurations.get(mapping?.animationName ?? '')
    if (!mapping || duration === undefined) {
      throw new LiveSDFrameSamplingError(
        'ANIMATION_MISSING',
        `${state.id} 상태에 선택된 LiveSD animation을 찾을 수 없습니다.`,
      )
    }

    let sampleTimes: readonly number[]
    try {
      sampleTimes = calculateLiveSDSampleTimes(duration, state.frameCount)
    } catch (error) {
      throw new LiveSDFrameSamplingError(
        'ANIMATION_MISSING',
        `${mapping.animationName} animation의 duration이 올바르지 않습니다.`,
        { cause: error },
      )
    }

    for (let frameIndex = 0; frameIndex < state.frameCount; frameIndex += 1) {
      frames.push({
        stateId: state.id,
        row: state.row,
        frameIndex,
        animationName: mapping.animationName,
        animationDuration: duration,
        sampleTime: sampleTimes[frameIndex] ?? 0,
        mirrorX: resolveCodexPetMirrorX(globalMirrorX, mapping.mirrorX),
      })
    }
  }

  const idleMapping = mappings.idle
  const idleDuration = animationDurations.get(idleMapping?.animationName ?? '')
  if (!idleMapping || idleDuration === undefined) {
    throw new LiveSDFrameSamplingError(
      'ANIMATION_MISSING',
      '대기 상태에 선택된 LiveSD animation을 찾을 수 없습니다.',
    )
  }

  for (const direction of CODEX_PET_LOOK_DIRECTIONS) {
    frames.push({
      stateId: 'idle',
      row: direction.row,
      frameIndex: direction.column,
      animationName: idleMapping.animationName,
      animationDuration: idleDuration,
      sampleTime: 0,
      mirrorX: globalMirrorX,
      lookDirectionIndex: direction.index,
      lookDirectionDegrees: globalMirrorX
        ? (360 - direction.angleDegrees) % 360
        : direction.angleDegrees,
    })
  }

  return frames
}

export function calculateLiveSDLookWorldDelta(
  projection: LiveSDFrameProjection,
  directionDegrees: number,
  horizontalRadiusPx = LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX,
  verticalRadiusPx = LIVE_SD_LOOK_VERTICAL_RADIUS_PX,
): LiveSDWorldDelta {
  return calculateSharedLiveSDLookWorldDelta(
    projection,
    directionDegrees,
    horizontalRadiusPx,
    verticalRadiusPx,
    CODEX_PET_CELL_WIDTH,
    CODEX_PET_CELL_HEIGHT,
  )
}

export function convertLiveSDWorldDeltaToLocal(
  parentMatrix: LiveSDMatrix2x2,
  worldDelta: LiveSDWorldDelta,
  determinantEpsilon?: number,
): LiveSDWorldDelta {
  try {
    return convertSharedLiveSDWorldDeltaToLocal(
      parentMatrix,
      worldDelta,
      determinantEpsilon,
    )
  } catch {
    throw new LiveSDFrameSamplingError(
      'LOOK_RIG_MISSING',
      '눈 bone의 좌표 변환이 불안정하여 시선 frame을 만들 수 없습니다.',
    )
  }
}

export function mergeLiveSDFrameBounds(
  current: LiveSDFrameBounds | null,
  next: LiveSDFrameBounds,
): LiveSDFrameBounds {
  return mergeLiveSDWorldBounds(current, next)
}

export function calculateLiveSDFrameProjection(
  bounds: LiveSDFrameBounds,
  paddingRatio = LIVE_SD_CANONICAL_BOUNDS_PADDING_RATIO,
  targetWidth = CODEX_PET_CELL_WIDTH,
  targetHeight = CODEX_PET_CELL_HEIGHT,
): LiveSDFrameProjection {
  try {
    return calculateLiveSDCanonicalCoarseProjection(
      bounds,
      targetWidth,
      targetHeight,
      paddingRatio,
    )
  } catch (error) {
    throw new LiveSDFrameSamplingError(
      'FRAME_BOUNDS_FAILED',
      '선택한 animation의 공통 렌더링 영역을 계산할 수 없습니다.',
      { cause: error },
    )
  }
}

export function flipWebGLRgbaRows(
  source: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const rowBytes = width * 4
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    source.length !== rowBytes * height
  ) {
    throw new RangeError('RGBA source does not match the requested geometry.')
  }

  const output = new Uint8ClampedArray(source.length)
  for (let sourceRow = 0; sourceRow < height; sourceRow += 1) {
    const sourceOffset = sourceRow * rowBytes
    const targetOffset = (height - sourceRow - 1) * rowBytes
    output.set(source.subarray(sourceOffset, sourceOffset + rowBytes), targetOffset)
  }
  return output
}

function frameBoundsFromVectors(
  offset: spine.Vector2,
  size: spine.Vector2,
): LiveSDFrameBounds {
  const minX = Math.min(offset.x, offset.x + size.x)
  const minY = Math.min(offset.y, offset.y + size.y)
  const maxX = Math.max(offset.x, offset.x + size.x)
  const maxY = Math.max(offset.y, offset.y + size.y)
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    throw new Error('Skeleton bounds contain a non-finite value.')
  }
  return { minX, minY, maxX, maxY }
}

function isBoneAtOrBelow(bone: spine.Bone, ancestor: spine.Bone): boolean {
  let current: spine.Bone | null = bone
  while (current) {
    if (current === ancestor) {
      return true
    }
    current = current.parent ?? null
  }
  return false
}

function isVisibleEyeAttachment(slot: spine.Slot, eyeBone: spine.Bone): boolean {
  if (!isBoneAtOrBelow(slot.bone, eyeBone) || slot.color.a <= 0) {
    return false
  }

  const attachment = slot.getAttachment() as
    | (spine.Attachment & {
        readonly color?: { readonly a?: number }
        readonly height?: number
        readonly region?: {
          readonly height?: number
          readonly originalHeight?: number
          readonly originalWidth?: number
          readonly width?: number
        }
        readonly width?: number
      })
    | null
  if (!attachment || (attachment.color?.a ?? 1) <= 0) {
    return false
  }

  const eyeName = `${slot.data.name} ${attachment.name}`
  if (!/eye[lr]/i.test(eyeName) || /eyebrow/i.test(eyeName)) {
    return false
  }

  const width =
    attachment.region?.originalWidth ??
    attachment.region?.width ??
    attachment.width ??
    0
  const height =
    attachment.region?.originalHeight ??
    attachment.region?.height ??
    attachment.height ??
    0
  return Number.isFinite(width) && Number.isFinite(height) && width > 1 && height > 1
}

export function validateLiveSDLookRig(skeleton: spine.Skeleton): spine.Bone {
  const eyeBone = skeleton.findBone('eye_scale') as spine.Bone | null
  const visibleEyeAttachmentCount = eyeBone
    ? skeleton.slots.filter((slot) => isVisibleEyeAttachment(slot, eyeBone)).length
    : 0

  if (!eyeBone || !eyeBone.parent || visibleEyeAttachmentCount < 2) {
    throw new LiveSDFrameSamplingError(
      'LOOK_RIG_MISSING',
      '시선을 렌더링할 eye_scale bone과 좌우 눈 attachment를 찾을 수 없습니다.',
    )
  }
  return eyeBone
}

function applyPlannedFrame(
  runtime: Spine36Runtime,
  session: RuntimeSamplingSession,
  frame: LiveSDPlannedFrame,
  projection?: LiveSDFrameProjection,
  lookMovementScale = CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
  lookRigFallback?: LiveSDLookRigFallback,
): void {
  const animation = session.animations.get(frame.animationName)
  if (!animation) {
    throw new Error(`Missing parsed animation: ${frame.animationName}`)
  }

  session.skeleton.setToSetupPose()
  session.skeleton.time = frame.sampleTime
  animation.apply(
    session.skeleton,
    0,
    frame.sampleTime,
    frame.animationDuration > 0,
    [],
    1,
    runtime.MixPose.setup,
    runtime.MixDirection.in,
  )

  if (frame.lookDirectionDegrees !== undefined) {
    if (!projection) {
      throw new Error('Look frame rendering requires a canonical projection.')
    }

    // Resolve the animated parent transform before converting the screen/world
    // gaze delta. The second update applies the local eye offset to descendants.
    session.skeleton.updateWorldTransform()
    try {
      const eyeBone = validateLiveSDLookRig(session.skeleton)
      const worldDelta = calculateLiveSDLookWorldDelta(
        projection,
        frame.lookDirectionDegrees,
        LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX * lookMovementScale,
        LIVE_SD_LOOK_VERTICAL_RADIUS_PX * lookMovementScale,
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
    } catch (error) {
      if (
        lookRigFallback !== 'static' ||
        !isLiveSDFrameSamplingError(error) ||
        error.code !== 'LOOK_RIG_MISSING'
      ) {
        throw error
      }
    }
  }
  session.skeleton.updateWorldTransform()
}

function drawRuntimeFrame(
  session: RuntimeSamplingSession,
  gl: WebGLRenderingContext,
): void {
  prepareLiveSD2DWebGLState(gl)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  session.shader.bind()
  try {
    session.shader.setUniformi('u_texture', 0)
    session.shader.setUniform4x4f('u_projTrans', session.matrix.values)
    session.batcher.begin(session.shader)
    try {
      session.renderer.premultipliedAlpha = true
      session.renderer.draw(session.batcher, session.skeleton)
    } finally {
      session.batcher.end()
    }
  } finally {
    session.shader.unbind()
  }
}

function readWebGLFrame(gl: WebGLRenderingContext): Uint8ClampedArray {
  const pixels = new Uint8Array(
    CODEX_PET_CELL_WIDTH * CODEX_PET_CELL_HEIGHT * 4,
  )
  gl.readPixels(
    0,
    0,
    CODEX_PET_CELL_WIDTH,
    CODEX_PET_CELL_HEIGHT,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  )

  const error = gl.getError()
  if (error !== gl.NO_ERROR) {
    throw new Error(`WebGL readback failed with error ${error}.`)
  }
  return unpremultiplyRgba(
    flipWebGLRgbaRows(
      pixels,
      CODEX_PET_CELL_WIDTH,
      CODEX_PET_CELL_HEIGHT,
    ),
  )
}

function putFrameInAtlas(
  atlasContext: CanvasRenderingContext2D,
  cellCanvas: HTMLCanvasElement,
  cellContext: CanvasRenderingContext2D,
  frame: LiveSDPlannedFrame,
  rgba: Uint8ClampedArray,
): void {
  const imageData = cellContext.createImageData(
    CODEX_PET_CELL_WIDTH,
    CODEX_PET_CELL_HEIGHT,
  )
  imageData.data.set(rgba)
  cellContext.clearRect(0, 0, CODEX_PET_CELL_WIDTH, CODEX_PET_CELL_HEIGHT)
  cellContext.putImageData(imageData, 0, 0)

  const x = frame.frameIndex * CODEX_PET_CELL_WIDTH
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

function createRuntimeSamplingSession(
  runtime: Spine36Runtime,
  gl: WebGLRenderingContext,
  atlasBundle: LiveSDAtlasBundle,
  skeletonBytes: ArrayBuffer,
  imageByPath: ReadonlyMap<string, LoadedAtlasImage>,
): RuntimeSamplingSession {
  const textures: spine.webgl.GLTexture[] = []
  let atlas: spine.TextureAtlas | null = null
  let batcher: spine.webgl.PolygonBatcher | null = null
  let shader: spine.webgl.Shader | null = null
  let disposed = false

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    if (batcher) {
      safely(() => batcher?.dispose())
    }
    if (shader) {
      safely(() => shader?.dispose())
    }
    if (atlas) {
      safely(() => atlas?.dispose())
    } else {
      for (const texture of textures) {
        safely(() => texture.dispose())
      }
    }
  }

  try {
    const managedContext = new runtime.webgl.ManagedWebGLRenderingContext(gl)
    try {
      atlas = new runtime.TextureAtlas(atlasBundle.atlasText, (pageReference) => {
        const pagePath = resolveAtlasPagePath(
          atlasBundle.atlasPath,
          pageReference,
        )
        const loadedImage = imageByPath.get(pagePath)
        if (!loadedImage) {
          throw new Error(`Missing decoded atlas page: ${pagePath}`)
        }
        const texture = new runtime.webgl.GLTexture(
          managedContext,
          loadedImage.image,
        )
        textures.push(texture)
        return texture
      })
    } catch (error) {
      throw new LiveSDFrameSamplingError(
        'ATLAS_RUNTIME_PARSE_FAILED',
        'LiveSD runtime이 sekai_atlas.atlas를 해석하지 못했습니다.',
        { cause: error },
      )
    }

    const attachmentLoader = new runtime.AtlasAttachmentLoader(atlas)
    const skeletonBinary = new runtime.SkeletonBinary(attachmentLoader)
    let skeletonData: spine.SkeletonData
    try {
      skeletonData = skeletonBinary.readSkeletonData(
        appendSkeletonTerminator(skeletonBytes),
      )
    } catch (error) {
      throw new LiveSDFrameSamplingError(
        'SKELETON_PARSE_FAILED',
        '공통 스켈레톤을 LiveSD 3.6 runtime으로 파싱하지 못했습니다.',
        { cause: error },
      )
    }

    const animations = new Map(
      skeletonData.animations.map((animation) => [animation.name, animation]),
    )
    if (animations.size === 0) {
      throw new LiveSDFrameSamplingError(
        'ANIMATION_MISSING',
        '공통 스켈레톤에 샘플링할 animation이 없습니다.',
      )
    }

    const skeleton = new runtime.Skeleton(skeletonData)
    const matrix = new runtime.webgl.Matrix4()
    shader = runtime.webgl.Shader.newTwoColoredTextured(managedContext)
    batcher = new runtime.webgl.PolygonBatcher(managedContext, true)
    const renderer = new runtime.webgl.SkeletonRenderer(managedContext, true)

    return {
      animations,
      atlas,
      batcher,
      matrix,
      renderer,
      shader,
      skeleton,
      dispose,
    }
  } catch (error) {
    dispose()
    throw error
  }
}

export class LiveSD36FrameSampler implements LiveSDFrameSamplerContract {
  readonly #canvasFactory: LiveSDFrameSamplerCanvasFactory
  readonly #imageLoader: AtlasImageLoader
  readonly #pngEncoder: LiveSDFrameSamplerPngEncoder
  readonly #runtimeLoader: Pick<LiveSD36RuntimeLoader, 'load'>
  readonly #yieldControl: () => Promise<void>

  constructor(options: LiveSD36FrameSamplerOptions = {}) {
    this.#canvasFactory = options.canvasFactory ?? defaultCanvasFactory
    this.#imageLoader = options.imageLoader ?? loadAtlasImage
    this.#pngEncoder = options.pngEncoder ?? encodeCanvasAsPng
    this.#runtimeLoader = options.runtimeLoader ?? liveSD36RuntimeLoader
    this.#yieldControl = options.yieldControl ?? yieldWithMessageChannel
  }

  async sample(
    input: LiveSDFrameSamplingInput,
  ): Promise<LiveSDFrameSamplingResult> {
    const images = new Map<string, LoadedAtlasImage>()
    let atlasCanvas: HTMLCanvasElement | null = null
    let cellCanvas: HTMLCanvasElement | null = null
    let frameCanvas: HTMLCanvasElement | null = null
    let gl: WebGLRenderingContext | null = null
    let runtimeSession: RuntimeSamplingSession | null = null
    let completedSteps = 0

    const report = (
      phase: LiveSDFrameSamplingPhase,
      frame?: LiveSDPlannedFrame,
    ) => {
      input.onProgress?.({
        phase,
        completedSteps,
        totalSteps: TOTAL_PROGRESS_STEPS,
        fraction: Math.min(completedSteps / TOTAL_PROGRESS_STEPS, 1),
        ...(frame
          ? frame.lookDirectionIndex !== undefined
            ? { lookDirectionIndex: frame.lookDirectionIndex }
            : { stateId: frame.stateId, frameIndex: frame.frameIndex }
          : {}),
      })
    }

    try {
      throwIfSamplingAborted(input.signal)
      const framingScale =
        input.framingScale ?? LIVE_SD_FRAMING_SCALE_DEFAULT
      try {
        assertLiveSDFramingScale(framingScale)
      } catch (error) {
        throw new LiveSDFrameSamplingError(
          'FRAMING_SCALE_INVALID',
          'Codex Pet 확대율은 80% 이상 150% 이하여야 합니다.',
          { cause: error },
        )
      }
      const framingOffset = {
        ...(input.framingOffset ?? LIVE_SD_FRAMING_OFFSET_DEFAULT),
      }
      try {
        assertLiveSDFramingOffset(framingOffset)
      } catch (error) {
        throw new LiveSDFrameSamplingError(
          'FRAMING_OFFSET_INVALID',
          'Codex Pet X/Y 위치가 허용된 cell pixel 범위를 벗어났습니다.',
          { cause: error },
        )
      }
      const lookMovementScale =
        input.lookMovementScale ?? CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT
      try {
        assertCodexPetLookMovementScale(lookMovementScale)
      } catch (error) {
        throw new LiveSDFrameSamplingError(
          'LOOK_MOVEMENT_SCALE_INVALID',
          '눈 이동량은 50% 이상 150% 이하여야 합니다.',
          { cause: error },
        )
      }
      report('preparing')
      throwIfSamplingAborted(input.signal)

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

      gl = frameCanvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        depth: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        stencil: false,
      })
      if (!gl) {
        throw new LiveSDFrameSamplingError(
          'WEBGL_UNSUPPORTED',
          '이 브라우저에서는 Codex Pet 프레임을 생성할 수 없습니다.',
        )
      }

      const atlasContext = atlasCanvas.getContext('2d')
      const cellContext = cellCanvas.getContext('2d')
      if (!atlasContext || !cellContext) {
        throw new LiveSDFrameSamplingError(
          'CANVAS_UNSUPPORTED',
          '이 브라우저에서는 PNG atlas를 조립할 수 없습니다.',
        )
      }
      atlasContext.clearRect(0, 0, CODEX_PET_ATLAS_WIDTH, CODEX_PET_ATLAS_HEIGHT)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      gl.viewport(0, 0, CODEX_PET_CELL_WIDTH, CODEX_PET_CELL_HEIGHT)

      let runtime: Spine36Runtime
      try {
        runtime = await this.#runtimeLoader.load()
      } catch (error) {
        throw new LiveSDFrameSamplingError(
          'RUNTIME_LOAD_FAILED',
          'LiveSD 3.6 runtime을 불러오지 못했습니다.',
          { cause: error },
        )
      }
      throwIfSamplingAborted(input.signal)

      for (const [path, blob] of input.atlasBundle.atlasPages) {
        try {
          const image = await this.#imageLoader(blob, path)
          images.set(path, image)
        } catch (error) {
          throw new LiveSDFrameSamplingError(
            'ATLAS_IMAGE_DECODE_FAILED',
            `atlas PNG를 디코딩할 수 없습니다: ${path}`,
            { cause: error },
          )
        }
        throwIfSamplingAborted(input.signal)
      }

      runtimeSession = createRuntimeSamplingSession(
        runtime,
        gl,
        input.atlasBundle,
        input.skeletonData,
        images,
      )
      const animationDurations = new Map(
        [...runtimeSession.animations].map(([name, animation]) => [
          name,
          animation.duration,
        ]),
      )
      const framePlan = createLiveSDFramePlan(
        input.mappings,
        animationDurations,
        input.globalMirrorX ?? false,
      )
      const standardFramePlan = framePlan.slice(
        0,
        CODEX_PET_STANDARD_FRAME_COUNT,
      )

      let unionBounds: LiveSDFrameBounds | null = null
      const boundsOffset = new runtime.Vector2()
      const boundsSize = new runtime.Vector2()
      for (const frame of standardFramePlan) {
        throwIfSamplingAborted(input.signal)
        try {
          applyPlannedFrame(runtime, runtimeSession, frame)
          runtimeSession.skeleton.getBounds(boundsOffset, boundsSize, [])
          unionBounds = mergeLiveSDFrameBounds(
            unionBounds,
            frameBoundsFromVectors(boundsOffset, boundsSize),
          )
        } catch (error) {
          throw new LiveSDFrameSamplingError(
            'FRAME_BOUNDS_FAILED',
            `${frame.stateId} ${frame.frameIndex + 1}번 frame 영역을 계산하지 못했습니다.`,
            { cause: error },
          )
        }

        completedSteps += 1
        report('measuring', frame)
        throwIfSamplingAborted(input.signal)
        await this.#yieldControl()
      }

      if (!unionBounds) {
        throw new LiveSDFrameSamplingError(
          'FRAME_BOUNDS_FAILED',
          '샘플링할 LiveSD frame이 없습니다.',
        )
      }
      const coarseProjection = calculateLiveSDFrameProjection(unionBounds)
      runtimeSession.matrix.ortho2d(
        coarseProjection.x,
        coarseProjection.y,
        coarseProjection.width,
        coarseProjection.height,
      )

      let visibleBounds: LiveSDFrameBounds | null = null
      for (const frame of standardFramePlan) {
        throwIfSamplingAborted(input.signal)
        try {
          applyPlannedFrame(runtime, runtimeSession, frame)
          drawRuntimeFrame(runtimeSession, gl)
        } catch (error) {
          throw new LiveSDFrameSamplingError(
            'FRAME_RENDER_FAILED',
            `${frame.stateId} ${frame.frameIndex + 1}번 calibration frame을 렌더링하지 못했습니다.`,
            { cause: error },
          )
        }

        let rgba: Uint8ClampedArray
        try {
          rgba = readWebGLFrame(gl)
        } catch (error) {
          throw new LiveSDFrameSamplingError(
            'FRAME_READBACK_FAILED',
            `${frame.stateId} ${frame.frameIndex + 1}번 calibration frame pixel을 읽지 못했습니다.`,
            { cause: error },
          )
        }

        const alphaBounds = findLiveSDAlphaPixelBounds(
          rgba,
          CODEX_PET_CELL_WIDTH,
          CODEX_PET_CELL_HEIGHT,
        )
        if (!alphaBounds) {
          throw new LiveSDFrameSamplingError(
            'FRAME_BOUNDS_FAILED',
            `${frame.stateId} ${frame.frameIndex + 1}번 calibration frame에 표시 가능한 alpha pixel이 없습니다.`,
          )
        }

        try {
          visibleBounds = mergeLiveSDFrameBounds(
            visibleBounds,
            convertLiveSDAlphaPixelBoundsToWorld(
              alphaBounds,
              coarseProjection,
              CODEX_PET_CELL_WIDTH,
              CODEX_PET_CELL_HEIGHT,
            ),
          )
        } catch (error) {
          throw new LiveSDFrameSamplingError(
            'FRAME_BOUNDS_FAILED',
            `${frame.stateId} ${frame.frameIndex + 1}번 calibration frame 영역을 계산하지 못했습니다.`,
            { cause: error },
          )
        }

        completedSteps += 1
        report('calibrating', frame)
        throwIfSamplingAborted(input.signal)
        await this.#yieldControl()
      }

      if (!visibleBounds) {
        throw new LiveSDFrameSamplingError(
          'FRAME_BOUNDS_FAILED',
          '표시 가능한 LiveSD calibration frame이 없습니다.',
        )
      }

      let projection: LiveSDFrameProjection
      let mirroredProjection: LiveSDFrameProjection
      try {
        projection = calculateLiveSDFinalProjection(
          visibleBounds,
          CODEX_PET_CELL_WIDTH,
          CODEX_PET_CELL_HEIGHT,
          LIVE_SD_FRAME_INSET_PIXELS,
          framingScale,
          framingOffset,
          false,
        )
        mirroredProjection = calculateLiveSDFinalProjection(
          visibleBounds,
          CODEX_PET_CELL_WIDTH,
          CODEX_PET_CELL_HEIGHT,
          LIVE_SD_FRAME_INSET_PIXELS,
          framingScale,
          framingOffset,
          true,
        )
      } catch (error) {
        throw new LiveSDFrameSamplingError(
          'FRAME_BOUNDS_FAILED',
          '선택한 animation의 가시 렌더링 영역을 계산할 수 없습니다.',
          { cause: error },
        )
      }
      let appliedProjection: LiveSDFrameProjection | null = null
      for (const frame of framePlan) {
        throwIfSamplingAborted(input.signal)
        const frameProjection = frame.mirrorX
          ? mirroredProjection
          : projection
        try {
          if (
            !appliedProjection ||
            frameProjection.x !== appliedProjection.x ||
            frameProjection.y !== appliedProjection.y ||
            frameProjection.width !== appliedProjection.width ||
            frameProjection.height !== appliedProjection.height
          ) {
            runtimeSession.matrix.ortho2d(
              frameProjection.x,
              frameProjection.y,
              frameProjection.width,
              frameProjection.height,
            )
            appliedProjection = frameProjection
          }
          applyPlannedFrame(
            runtime,
            runtimeSession,
            frame,
            frameProjection,
            lookMovementScale,
            input.lookRigFallback,
          )
          drawRuntimeFrame(runtimeSession, gl)
        } catch (error) {
          if (
            isLiveSDFrameSamplingError(error) &&
            error.code === 'LOOK_RIG_MISSING'
          ) {
            throw error
          }
          throw new LiveSDFrameSamplingError(
            'FRAME_RENDER_FAILED',
            `${frame.stateId} ${frame.frameIndex + 1}번 frame을 렌더링하지 못했습니다.`,
            { cause: error },
          )
        }

        let rgba: Uint8ClampedArray
        try {
          rgba = readWebGLFrame(gl)
        } catch (error) {
          throw new LiveSDFrameSamplingError(
            'FRAME_READBACK_FAILED',
            `${frame.stateId} ${frame.frameIndex + 1}번 frame pixel을 읽지 못했습니다.`,
            { cause: error },
          )
        }
        putFrameInAtlas(atlasContext, cellCanvas, cellContext, frame, rgba)

        completedSteps += 1
        report('rendering', frame)
        throwIfSamplingAborted(input.signal)
        await this.#yieldControl()
      }

      throwIfSamplingAborted(input.signal)
      report('encoding')
      throwIfSamplingAborted(input.signal)
      let atlasPng: Blob
      try {
        atlasPng = await this.#pngEncoder(atlasCanvas)
        if (atlasPng.size === 0) {
          throw new Error('PNG encoder returned an empty Blob.')
        }
      } catch (error) {
        throw new LiveSDFrameSamplingError(
          'PNG_ENCODING_FAILED',
          'Codex Pet spritesheet PNG를 인코딩하지 못했습니다.',
          { cause: error },
        )
      }
      throwIfSamplingAborted(input.signal)

      completedSteps += 1
      report('complete')
      throwIfSamplingAborted(input.signal)
      return {
        atlasPng,
        width: CODEX_PET_ATLAS_WIDTH,
        height: CODEX_PET_ATLAS_HEIGHT,
        frameCount: framePlan.length,
      }
    } catch (error) {
      if (isLiveSDFrameSamplingError(error)) {
        throw error
      }
      throwIfSamplingAborted(input.signal)
      throw new LiveSDFrameSamplingError(
        'SAMPLING_FAILED',
        'Codex Pet 프레임 생성 중 알 수 없는 오류가 발생했습니다.',
        { cause: error },
      )
    } finally {
      runtimeSession?.dispose()
      for (const image of images.values()) {
        safely(() => image.dispose())
      }
      if (gl) {
        safely(() => {
          gl?.clearColor(0, 0, 0, 0)
          gl?.clear(gl.COLOR_BUFFER_BIT)
        })
        safely(() => gl?.getExtension('WEBGL_lose_context')?.loseContext())
      }
      for (const canvas of [frameCanvas, cellCanvas, atlasCanvas]) {
        if (canvas) {
          canvas.width = 1
          canvas.height = 1
        }
      }
    }
  }
}

export const liveSD36FrameSampler = new LiveSD36FrameSampler()
