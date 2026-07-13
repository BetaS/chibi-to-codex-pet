import { describe, expect, it, vi } from 'vitest'

import type { CodexPetAnimationMappings } from '../../codex-pet/animationMapping'
import {
  CODEX_PET_ATLAS_HEIGHT,
  CODEX_PET_ATLAS_WIDTH,
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_LOOK_FRAME_COUNT,
  CODEX_PET_STANDARD_FRAME_COUNT,
  CODEX_PET_STATES,
  CODEX_PET_TOTAL_FRAME_COUNT,
} from '../../codex-pet/contract'
import type { LiveSDAtlasBundle } from '../model'
import type { Spine36Runtime } from '../runtime/runtimeLoader'
import {
  calculateLiveSDFrameProjection,
  calculateLiveSDLookWorldDelta,
  calculateLiveSDSampleTimes,
  convertLiveSDWorldDeltaToLocal,
  createLiveSDFramePlan,
  flipWebGLRgbaRows,
  LiveSD36FrameSampler,
  mergeLiveSDFrameBounds,
  type LiveSDFrameSamplerCanvasFactory,
} from './LiveSD36FrameSampler'

function createMappings(): CodexPetAnimationMappings {
  return Object.fromEntries(
    CODEX_PET_STATES.map((state) => [
      state.id,
      {
        animationName: `animation-${state.id}`,
        mirrorX: state.id === 'running-left',
      },
    ]),
  ) as unknown as CodexPetAnimationMappings
}

function createBundle(): LiveSDAtlasBundle {
  return {
    sourceName: 'sampler-test.zip',
    atlasPath: 'sekai_atlas.atlas',
    atlasText: 'page.png\nsize: 2,2\n',
    atlasPages: new Map([['page.png', new Blob(['png'])]]),
  }
}

interface RuntimeFixture {
  readonly runtime: Spine36Runtime
  readonly calls: string[]
  readonly atlasDispose: ReturnType<typeof vi.fn>
  readonly batcherDispose: ReturnType<typeof vi.fn>
  readonly shaderDispose: ReturnType<typeof vi.fn>
  readonly textureDispose: ReturnType<typeof vi.fn>
  readonly matrixOrtho: ReturnType<typeof vi.fn>
  readonly eyeOffsets: readonly { readonly x: number; readonly y: number }[]
  readonly rendererPremultipliedAlphaAtDraw: readonly boolean[]
}

interface RuntimeFixtureOptions {
  readonly eyeAttachmentCount?: number
  readonly eyeAttachmentSize?: number
  readonly eyeBoneMissing?: boolean
  readonly parentMatrix?: {
    readonly a: number
    readonly b: number
    readonly c: number
    readonly d: number
  }
}

function createRuntimeFixture(
  mappings: CodexPetAnimationMappings,
  options: RuntimeFixtureOptions = {},
): RuntimeFixture {
  const calls: string[] = []
  const eyeOffsets: { x: number; y: number }[] = []
  const rendererPremultipliedAlphaAtDraw: boolean[] = []
  const textureDispose = vi.fn(() => calls.push('dispose:texture'))
  const atlasDispose = vi.fn(() => {
    calls.push('dispose:atlas')
    textureDispose()
  })
  const batcherDispose = vi.fn(() => calls.push('dispose:batcher'))
  const shaderDispose = vi.fn(() => calls.push('dispose:shader'))
  const matrixOrtho = vi.fn(
    (x: number, y: number, width: number, height: number) => {
      calls.push(`ortho:${x}:${y}:${width}:${height}`)
    },
  )

  interface MockSkeletonShape {
    poseName: string
    poseTime: number
  }

  const durations = new Map(
    CODEX_PET_STATES.map((state) => [mappings[state.id].animationName, state.row + 1]),
  )
  const animations = [...durations].map(([name, duration]) => ({
    name,
    duration,
    apply: vi.fn(
      (
        skeleton: MockSkeletonShape,
        _lastTime: number,
        time: number,
      ) => {
        skeleton.poseName = name
        skeleton.poseTime = time
        calls.push(`apply:${name}:${time}`)
      },
    ),
  })) as unknown as spine.Animation[]
  const skeletonData = { animations } as spine.SkeletonData
  const parentMatrix = options.parentMatrix ?? { a: 1, b: 0, c: 0, d: 1 }
  const eyeParent = {
    ...parentMatrix,
    data: { name: 'F_head' },
    parent: null,
  } as unknown as spine.Bone
  const eyeBone = {
    data: { name: 'eye_scale' },
    parent: eyeParent,
    x: 0,
    y: 0,
  } as spine.Bone
  const eyeAttachmentCount = options.eyeAttachmentCount ?? 2
  const eyeAttachmentSize = options.eyeAttachmentSize ?? 38
  const eyeSlots = Array.from({ length: eyeAttachmentCount }, (_, index) => {
    const side = index % 2 === 0 ? 'L' : 'R'
    return {
      bone: eyeBone,
      color: { a: 1 },
      data: { name: `F_eye${side}` },
      getAttachment: () => ({
        name: `F_eye${side}01_normal`,
        region: {
          originalWidth: eyeAttachmentSize,
          originalHeight: eyeAttachmentSize,
        },
      }),
    } as unknown as spine.Slot
  })

  class MockTextureAtlas {
    constructor(
      _atlasText: string,
      textureLoader: (path: string) => spine.Texture,
    ) {
      calls.push('atlas:create')
      textureLoader('page.png')
    }

    dispose(): void {
      atlasDispose()
    }
  }

  class MockSkeleton implements MockSkeletonShape {
    poseName = ''
    poseTime = 0
    time = 0
    readonly slots = eyeSlots

    constructor(data: spine.SkeletonData) {
      void data
      calls.push('skeleton:create')
    }

    setToSetupPose(): void {
      eyeBone.x = 0
      eyeBone.y = 0
      calls.push('setup')
    }

    updateWorldTransform(): void {
      eyeOffsets.push({ x: eyeBone.x, y: eyeBone.y })
      calls.push(`world:${this.poseName}:${this.poseTime}`)
    }

    findBone(name: string): spine.Bone | null {
      return name === 'eye_scale' && !options.eyeBoneMissing ? eyeBone : null
    }

    getBounds(offset: spine.Vector2, size: spine.Vector2): void {
      const animationIndex = Math.max(
        CODEX_PET_STATES.findIndex(
          (state) => mappings[state.id].animationName === this.poseName,
        ),
        0,
      )
      offset.x = -10 - animationIndex
      offset.y = -20 - this.poseTime
      size.x = 20 + animationIndex * 2
      size.y = 40 + this.poseTime * 2
      calls.push(`bounds:${this.poseName}:${this.poseTime}`)
    }
  }

  class MockVector2 {
    x = 0
    y = 0
  }

  class MockMatrix4 {
    readonly values = new Float32Array(16)
    readonly ortho2d = matrixOrtho
  }

  class MockShader {
    static readonly newTwoColoredTextured = vi.fn(() => new MockShader())

    bind(): void {
      calls.push('shader:bind')
    }

    unbind(): void {
      calls.push('shader:unbind')
    }

    setUniformi(): void {}

    setUniform4x4f(): void {}

    dispose(): void {
      shaderDispose()
    }
  }

  class MockBatcher {
    begin(): void {
      calls.push('batcher:begin')
    }

    end(): void {
      calls.push('batcher:end')
    }

    dispose(): void {
      batcherDispose()
    }
  }

  const runtime = {
    AtlasAttachmentLoader: class {
      constructor(atlas: spine.TextureAtlas) {
        void atlas
      }
    },
    MixDirection: { in: 0 },
    MixPose: { setup: 0 },
    Skeleton: MockSkeleton,
    SkeletonBinary: class {
      constructor(loader: spine.AttachmentLoader) {
        void loader
      }

      readSkeletonData(data: ArrayBuffer): spine.SkeletonData {
        void data
        calls.push('skeleton:parse')
        return skeletonData
      }
    },
    TextureAtlas: MockTextureAtlas,
    Vector2: MockVector2,
    webgl: {
      GLTexture: class {
        constructor(
          context: spine.webgl.ManagedWebGLRenderingContext,
          image: HTMLImageElement,
        ) {
          void context
          void image
          calls.push('texture:create')
        }

        dispose(): void {
          textureDispose()
        }
      },
      ManagedWebGLRenderingContext: class {
        constructor(gl: WebGLRenderingContext) {
          void gl
        }
      },
      Matrix4: MockMatrix4,
      PolygonBatcher: MockBatcher,
      Shader: MockShader,
      SkeletonRenderer: class {
        premultipliedAlpha = false

        constructor(
          context: spine.webgl.ManagedWebGLRenderingContext,
          twoColorTint: boolean,
        ) {
          void context
          void twoColorTint
        }

        draw(_batcher: spine.webgl.PolygonBatcher, skeleton: MockSkeleton): void {
          rendererPremultipliedAlphaAtDraw.push(this.premultipliedAlpha)
          calls.push(`draw:${skeleton.poseName}:${skeleton.poseTime}`)
        }
      },
    },
  } as unknown as Spine36Runtime

  return {
    runtime,
    calls,
    atlasDispose,
    batcherDispose,
    shaderDispose,
    textureDispose,
    matrixOrtho,
    eyeOffsets,
    rendererPremultipliedAlphaAtDraw,
  }
}

interface CanvasFixture {
  readonly canvasFactory: LiveSDFrameSamplerCanvasFactory
  readonly atlasContext: CanvasRenderingContext2D
  readonly cellContext: CanvasRenderingContext2D
  readonly gl: WebGLRenderingContext
  readonly loseContext: ReturnType<typeof vi.fn>
  readonly readPixels: ReturnType<typeof vi.fn>
  readonly atlasCanvas: HTMLCanvasElement
  readonly frameCanvas: HTMLCanvasElement
}

function createCanvasFixture(
  options: {
    readonly emptyReadbackAt?: number
    readonly readbackFails?: boolean
  } = {},
): CanvasFixture {
  const loseContext = vi.fn()
  let readbackIndex = 0
  const readPixels = vi.fn(
    (
      _x: number,
      _y: number,
      _width: number,
      _height: number,
      _format: number,
      _type: number,
      pixels: ArrayBufferView,
    ) => {
      if (options.readbackFails) {
        throw new Error('readback exploded')
      }
      const bytes = new Uint8Array(
        pixels.buffer,
        pixels.byteOffset,
        pixels.byteLength,
      )
      bytes.fill(0)
      if (readbackIndex !== options.emptyReadbackAt) {
        for (let y = 52; y <= 155; y += 1) {
          for (let x = 48; x <= 143; x += 1) {
            bytes[(y * CODEX_PET_CELL_WIDTH + x) * 4 + 3] = 255
          }
        }
        const semiTransparentOffset =
          (52 * CODEX_PET_CELL_WIDTH + 48) * 4
        bytes.set([32, 16, 8, 64], semiTransparentOffset)
      }
      readbackIndex += 1
    },
  )
  const gl = {
    COLOR_BUFFER_BIT: 0x4000,
    CULL_FACE: 0x0b44,
    DEPTH_TEST: 0x0b71,
    NO_ERROR: 0,
    POLYGON_OFFSET_FILL: 0x8037,
    RGBA: 0x1908,
    SCISSOR_TEST: 0x0c11,
    STENCIL_TEST: 0x0b90,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    UNSIGNED_BYTE: 0x1401,
    clear: vi.fn(),
    clearColor: vi.fn(),
    depthMask: vi.fn(),
    disable: vi.fn(),
    getError: vi.fn(() => 0),
    getExtension: vi.fn((name: string) =>
      name === 'WEBGL_lose_context' ? { loseContext } : null,
    ),
    pixelStorei: vi.fn(),
    readPixels,
    viewport: vi.fn(),
  } as unknown as WebGLRenderingContext

  function create2dContext(): CanvasRenderingContext2D {
    return {
      clearRect: vi.fn(),
      createImageData: vi.fn((width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
        colorSpace: 'srgb',
      })),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D
  }

  const atlasContext = create2dContext()
  const cellContext = create2dContext()
  const canvases = new Map<string, HTMLCanvasElement>()
  const canvasFactory: LiveSDFrameSamplerCanvasFactory = (
    kind,
    width,
    height,
  ) => {
    const context =
      kind === 'frame-webgl'
        ? gl
        : kind === 'atlas-2d'
          ? atlasContext
          : cellContext
    const canvas = {
      width,
      height,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement
    canvases.set(kind, canvas)
    return canvas
  }

  return {
    canvasFactory,
    atlasContext,
    cellContext,
    gl,
    loseContext,
    readPixels,
    get atlasCanvas() {
      const canvas = canvases.get('atlas-2d')
      if (!canvas) {
        throw new Error('Atlas canvas has not been created yet.')
      }
      return canvas
    },
    get frameCanvas() {
      const canvas = canvases.get('frame-webgl')
      if (!canvas) {
        throw new Error('Frame canvas has not been created yet.')
      }
      return canvas
    },
  }
}

function createSamplerFixture(
  options: RuntimeFixtureOptions & {
    readonly emptyReadbackAt?: number
    readonly readbackFails?: boolean
  } = {},
) {
  const mappings = createMappings()
  const runtime = createRuntimeFixture(mappings, options)
  const canvas = createCanvasFixture(options)
  const imageDispose = vi.fn()
  const pngEncoder = vi.fn(async () => new Blob(['png'], { type: 'image/png' }))
  const sampler = new LiveSD36FrameSampler({
    canvasFactory: canvas.canvasFactory,
    imageLoader: vi.fn(async () => ({
      image: {} as HTMLImageElement,
      dispose: imageDispose,
    })),
    pngEncoder,
    runtimeLoader: { load: vi.fn(async () => runtime.runtime) },
    yieldControl: vi.fn(async () => undefined),
  })

  return { mappings, runtime, canvas, imageDispose, pngEncoder, sampler }
}

describe('LiveSD36FrameSampler pure helpers', () => {
  it('endpoint를 중복하지 않는 명시적 sample time을 계산한다', () => {
    expect(calculateLiveSDSampleTimes(4, 4)).toEqual([0, 1, 2, 3])
    expect(calculateLiveSDSampleTimes(1, 6)).toEqual([
      0,
      1 / 6,
      2 / 6,
      3 / 6,
      4 / 6,
      5 / 6,
    ])
  })

  it('57개 표준 pose 뒤에 idle time=0 기반 16방향 look pose를 배치한다', () => {
    const mappings = createMappings()
    const durations = new Map(
      CODEX_PET_STATES.map((state) => [mappings[state.id].animationName, 4]),
    )
    const frames = createLiveSDFramePlan(mappings, durations)

    expect(frames).toHaveLength(CODEX_PET_TOTAL_FRAME_COUNT)
    expect(frames.slice(6, 14).map((frame) => frame.sampleTime)).toEqual([
      0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5,
    ])
    expect(frames.filter((frame) => frame.mirrorX)).toHaveLength(8)
    expect(frames.filter((frame) => frame.mirrorX).every(
      (frame) => frame.stateId === 'running-left',
    )).toBe(true)
    const lookFrames = frames.slice(CODEX_PET_STANDARD_FRAME_COUNT)
    expect(lookFrames).toHaveLength(CODEX_PET_LOOK_FRAME_COUNT)
    expect(lookFrames.map((frame) => ({
      index: frame.lookDirectionIndex,
      degrees: frame.lookDirectionDegrees,
      row: frame.row,
      column: frame.frameIndex,
    }))).toEqual(
      CODEX_PET_LOOK_DIRECTIONS.map((direction) => ({
        index: direction.index,
        degrees: direction.angleDegrees,
        row: direction.row,
        column: direction.column,
      })),
    )
    expect(lookFrames.every((frame) =>
      frame.animationName === mappings.idle.animationName &&
      frame.sampleTime === 0 &&
      frame.mirrorX === false
    )).toBe(true)
  })

  it('전체 반전을 상태별 반전과 XOR하고 look 수평 의미를 보정한다', () => {
    const mappings = createMappings()
    const durations = new Map(
      CODEX_PET_STATES.map((state) => [mappings[state.id].animationName, 4]),
    )
    const frames = createLiveSDFramePlan(mappings, durations, true)
    const rightFrames = frames.filter(
      (frame) => frame.stateId === 'running-right' && frame.row === 1,
    )
    const leftFrames = frames.filter(
      (frame) => frame.stateId === 'running-left' && frame.row === 2,
    )
    expect(rightFrames.every((frame) => frame.mirrorX)).toBe(true)
    expect(leftFrames.every((frame) => !frame.mirrorX)).toBe(true)

    const lookFrames = frames.slice(CODEX_PET_STANDARD_FRAME_COUNT)
    expect(lookFrames.every((frame) => frame.mirrorX)).toBe(true)
    expect(lookFrames.map((frame) => frame.lookDirectionDegrees)).toEqual(
      CODEX_PET_LOOK_DIRECTIONS.map(
        (direction) => (360 - direction.angleDegrees) % 360,
      ),
    )
  })

  it('final cell pixel 반경으로 cardinal world delta를 계산한다', () => {
    const projection = { x: -96, y: -104, width: 192, height: 208 }

    expect(calculateLiveSDLookWorldDelta(projection, 0)).toEqual({ x: 0, y: 1.5 })
    expect(calculateLiveSDLookWorldDelta(projection, 90).x).toBeCloseTo(2)
    expect(calculateLiveSDLookWorldDelta(projection, 90).y).toBeCloseTo(0)
    expect(calculateLiveSDLookWorldDelta(projection, 180).y).toBeCloseTo(-1.5)
  })

  it('world delta를 정방향과 90도 회전 parent의 local delta로 변환한다', () => {
    expect(
      convertLiveSDWorldDeltaToLocal(
        { a: 1, b: 0, c: 0, d: 1 },
        { x: 2, y: 1.5 },
      ),
    ).toEqual({ x: 2, y: 1.5 })

    const rotated = convertLiveSDWorldDeltaToLocal(
      { a: 0, b: -1, c: 1, d: 0 },
      { x: 2, y: 0 },
    )
    expect(rotated.x).toBeCloseTo(0)
    expect(rotated.y).toBeCloseTo(-2)
  })

  it('특이 parent matrix는 안정적인 look rig 오류로 차단한다', () => {
    expect(() =>
      convertLiveSDWorldDeltaToLocal(
        { a: 1, b: 2, c: 2, d: 4 },
        { x: 1, y: 1 },
      ),
    ).toThrow(expect.objectContaining({ code: 'LOOK_RIG_MISSING' }))
  })

  it('bounds 합집합에 10% edge padding과 cell aspect를 적용한다', () => {
    const union = mergeLiveSDFrameBounds(
      { minX: -10, minY: -20, maxX: 10, maxY: 20 },
      { minX: -15, minY: -10, maxX: 25, maxY: 30 },
    )
    expect(union).toEqual({ minX: -15, minY: -20, maxX: 25, maxY: 30 })

    const projection = calculateLiveSDFrameProjection(union)
    expect(projection.width / projection.height).toBeCloseTo(
      CODEX_PET_CELL_WIDTH / CODEX_PET_CELL_HEIGHT,
    )
    expect(projection.width).toBeGreaterThanOrEqual(40 * 1.2)
    expect(projection.height).toBeGreaterThanOrEqual(50 * 1.2)
  })

  it('WebGL bottom-up RGBA rows를 canvas top-down 순서로 뒤집는다', () => {
    const bottomRow = [1, 2, 3, 4, 5, 6, 7, 8]
    const topRow = [11, 12, 13, 14, 15, 16, 17, 18]
    expect(
      [...flipWebGLRgbaRows(new Uint8Array([...bottomRow, ...topRow]), 2, 2)],
    ).toEqual([...topRow, ...bottomRow])
  })
})

describe('LiveSD36FrameSampler', () => {
  it('57개 표준 alpha calibration의 공통 final projection으로 표준 57개와 look 16개 cell을 조립한다', async () => {
    const fixture = createSamplerFixture()
    const progress = vi.fn()
    const result = await fixture.sampler.sample({
      atlasBundle: createBundle(),
      skeletonData: new Uint8Array([1, 2, 3]).buffer,
      mappings: fixture.mappings,
      onProgress: progress,
    })

    expect(result).toEqual({
      atlasPng: expect.any(Blob),
      width: CODEX_PET_ATLAS_WIDTH,
      height: CODEX_PET_ATLAS_HEIGHT,
      frameCount: CODEX_PET_TOTAL_FRAME_COUNT,
    })
    expect(fixture.runtime.calls.filter((call) => call === 'skeleton:parse')).toHaveLength(1)
    expect(fixture.runtime.calls.filter((call) => call.startsWith('apply:'))).toHaveLength(
      CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT,
    )
    expect(fixture.runtime.calls.filter((call) => call.startsWith('bounds:'))).toHaveLength(
      CODEX_PET_STANDARD_FRAME_COUNT,
    )
    expect(fixture.runtime.calls.filter((call) => call.startsWith('draw:'))).toHaveLength(
      CODEX_PET_STANDARD_FRAME_COUNT + CODEX_PET_TOTAL_FRAME_COUNT,
    )
    const lastBounds = fixture.runtime.calls.reduce(
      (lastIndex, call, index) =>
        call.startsWith('bounds:') ? index : lastIndex,
      -1,
    )
    const firstDraw = fixture.runtime.calls.findIndex((call) =>
      call.startsWith('draw:'),
    )
    expect(firstDraw).toBeGreaterThan(lastBounds)
    expect(fixture.runtime.matrixOrtho).toHaveBeenCalledTimes(2)
    const coarseProjectionWidth = fixture.runtime.matrixOrtho.mock.calls[0]?.[2]
    const finalProjectionWidth = fixture.runtime.matrixOrtho.mock.calls[1]?.[2]
    expect(finalProjectionWidth).toBeLessThan(coarseProjectionWidth)
    expect(fixture.canvas.readPixels).toHaveBeenCalledTimes(
      CODEX_PET_STANDARD_FRAME_COUNT + CODEX_PET_TOTAL_FRAME_COUNT,
    )
    expect(fixture.canvas.atlasContext.drawImage).toHaveBeenCalledTimes(
      CODEX_PET_TOTAL_FRAME_COUNT,
    )
    expect(fixture.canvas.atlasContext.scale).toHaveBeenCalledTimes(8)
    expect(fixture.canvas.atlasContext.translate).toHaveBeenNthCalledWith(
      1,
      CODEX_PET_CELL_WIDTH,
      CODEX_PET_CELL_HEIGHT * 2,
    )
    expect(fixture.canvas.atlasContext.translate).toHaveBeenNthCalledWith(
      8,
      CODEX_PET_CELL_WIDTH * 8,
      CODEX_PET_CELL_HEIGHT * 2,
    )
    const lookWorldUpdates = fixture.runtime.eyeOffsets.slice(
      -CODEX_PET_LOOK_FRAME_COUNT * 2,
    )
    expect(lookWorldUpdates).toHaveLength(CODEX_PET_LOOK_FRAME_COUNT * 2)
    for (let index = 0; index < CODEX_PET_LOOK_FRAME_COUNT; index += 1) {
      expect(lookWorldUpdates[index * 2]).toEqual({ x: 0, y: 0 })
    }
    expect(lookWorldUpdates[1]?.y).toBeGreaterThan(0)
    expect(lookWorldUpdates[9]?.x).toBeGreaterThan(0)
    expect(lookWorldUpdates[17]?.y).toBeLessThan(0)
    expect(lookWorldUpdates[25]?.x).toBeLessThan(0)
    expect(fixture.pngEncoder).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.frameCanvas.getContext).toHaveBeenCalledWith(
      'webgl',
      expect.objectContaining({
        depth: false,
        premultipliedAlpha: true,
        stencil: false,
      }),
    )
    expect(fixture.canvas.gl.pixelStorei).toHaveBeenCalledWith(
      fixture.canvas.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      0,
    )
    expect(fixture.runtime.rendererPremultipliedAlphaAtDraw).toHaveLength(
      CODEX_PET_STANDARD_FRAME_COUNT + CODEX_PET_TOTAL_FRAME_COUNT,
    )
    expect(
      fixture.runtime.rendererPremultipliedAlphaAtDraw.every(Boolean),
    ).toBe(true)
    const firstImageData = vi.mocked(
      fixture.canvas.cellContext.putImageData,
    ).mock.calls[0]?.[0]
    const semiTransparentOffset =
      ((CODEX_PET_CELL_HEIGHT - 1 - 52) * CODEX_PET_CELL_WIDTH + 48) * 4
    expect(
      [...(firstImageData?.data.slice(
        semiTransparentOffset,
        semiTransparentOffset + 4,
      ) ?? [])],
    ).toEqual([128, 64, 32, 64])
    expect(fixture.canvas.gl.disable).toHaveBeenCalledTimes(
      (CODEX_PET_STANDARD_FRAME_COUNT + CODEX_PET_TOTAL_FRAME_COUNT) * 5,
    )
    expect(fixture.canvas.gl.depthMask).toHaveBeenCalledTimes(
      CODEX_PET_STANDARD_FRAME_COUNT + CODEX_PET_TOTAL_FRAME_COUNT,
    )
    expect(progress).toHaveBeenLastCalledWith({
      phase: 'complete',
      completedSteps:
        CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT + 1,
      totalSteps:
        CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT + 1,
      fraction: 1,
    })
    expect(progress).toHaveBeenCalledWith({
      phase: 'rendering',
      completedSteps:
        CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT,
      totalSteps:
        CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT + 1,
      fraction:
        (CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT) /
        (CODEX_PET_STANDARD_FRAME_COUNT * 2 +
          CODEX_PET_TOTAL_FRAME_COUNT +
          1),
      lookDirectionIndex: 15,
    })

    expect(fixture.runtime.batcherDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.shaderDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.textureDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it('80% 확대율은 calibration과 진행률을 유지하고 final 공통 projection만 축소한다', async () => {
    const automatic = createSamplerFixture()
    const scaled = createSamplerFixture()
    const scaledProgress = vi.fn()

    await automatic.sampler.sample({
      atlasBundle: createBundle(),
      skeletonData: new Uint8Array([1]).buffer,
      mappings: automatic.mappings,
    })
    await scaled.sampler.sample({
      atlasBundle: createBundle(),
      framingScale: 0.8,
      skeletonData: new Uint8Array([1]).buffer,
      mappings: scaled.mappings,
      onProgress: scaledProgress,
    })

    expect(scaled.runtime.matrixOrtho.mock.calls[0]).toEqual(
      automatic.runtime.matrixOrtho.mock.calls[0],
    )
    const automaticFinal = automatic.runtime.matrixOrtho.mock.calls[1]
    const scaledFinal = scaled.runtime.matrixOrtho.mock.calls[1]
    expect(scaledFinal?.[2]).toBeCloseTo((automaticFinal?.[2] ?? 0) / 0.8)
    expect(scaledFinal?.[3]).toBeCloseTo((automaticFinal?.[3] ?? 0) / 0.8)
    expect((scaledFinal?.[0] ?? 0) + (scaledFinal?.[2] ?? 0) / 2).toBeCloseTo(
      (automaticFinal?.[0] ?? 0) + (automaticFinal?.[2] ?? 0) / 2,
    )
    expect(scaled.canvas.readPixels).toHaveBeenCalledTimes(
      CODEX_PET_STANDARD_FRAME_COUNT + CODEX_PET_TOTAL_FRAME_COUNT,
    )
    expect(scaledProgress).toHaveBeenLastCalledWith({
      phase: 'complete',
      completedSteps:
        CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT + 1,
      totalSteps:
        CODEX_PET_STANDARD_FRAME_COUNT * 2 + CODEX_PET_TOTAL_FRAME_COUNT + 1,
      fraction: 1,
    })

    const scaledLookUpdates = scaled.runtime.eyeOffsets.slice(
      -CODEX_PET_LOOK_FRAME_COUNT * 2,
    )
    expect(
      ((scaledLookUpdates[1]?.y ?? 0) / (scaledFinal?.[3] ?? 1)) *
        CODEX_PET_CELL_HEIGHT,
    ).toBeCloseTo(1.5)
  })

  it('눈 이동 배율을 두 cardinal 반경에 동일하게 적용한다', async () => {
    const automatic = createSamplerFixture()
    const scaled = createSamplerFixture()

    await automatic.sampler.sample({
      atlasBundle: createBundle(),
      skeletonData: new Uint8Array([1]).buffer,
      mappings: automatic.mappings,
    })
    await scaled.sampler.sample({
      atlasBundle: createBundle(),
      lookMovementScale: 1.5,
      skeletonData: new Uint8Array([1]).buffer,
      mappings: scaled.mappings,
    })

    const automaticLookUpdates = automatic.runtime.eyeOffsets.slice(
      -CODEX_PET_LOOK_FRAME_COUNT * 2,
    )
    const scaledLookUpdates = scaled.runtime.eyeOffsets.slice(
      -CODEX_PET_LOOK_FRAME_COUNT * 2,
    )
    for (let index = 1; index < scaledLookUpdates.length; index += 2) {
      expect(scaledLookUpdates[index]?.x).toBeCloseTo(
        (automaticLookUpdates[index]?.x ?? 0) * 1.5,
      )
      expect(scaledLookUpdates[index]?.y).toBeCloseTo(
        (automaticLookUpdates[index]?.y ?? 0) * 1.5,
      )
    }
    expect(scaled.runtime.matrixOrtho.mock.calls).toEqual(
      automatic.runtime.matrixOrtho.mock.calls,
    )
  })

  it.each([0.49, 1.51, Number.NaN])(
    '잘못된 눈 이동량 %s를 canvas 생성 전에 거부한다',
    async (lookMovementScale) => {
      const fixture = createSamplerFixture()
      const progress = vi.fn()

      await expect(
        fixture.sampler.sample({
          atlasBundle: createBundle(),
          lookMovementScale,
          skeletonData: new Uint8Array([1]).buffer,
          mappings: fixture.mappings,
          onProgress: progress,
        }),
      ).rejects.toMatchObject({
        code: 'LOOK_MOVEMENT_SCALE_INVALID',
        message: expect.stringContaining('50% 이상 150% 이하'),
      })

      expect(fixture.runtime.calls).toEqual([])
      expect(progress).not.toHaveBeenCalled()
      expect(fixture.pngEncoder).not.toHaveBeenCalled()
      expect(() => fixture.canvas.frameCanvas).toThrow(
        'Frame canvas has not been created yet.',
      )
    },
  )

  it.each([0.79, 1.51, Number.NaN])(
    '잘못된 확대율 %s를 canvas 생성 전에 거부한다',
    async (framingScale) => {
      const fixture = createSamplerFixture()
      const progress = vi.fn()

      await expect(
        fixture.sampler.sample({
          atlasBundle: createBundle(),
          framingScale,
          skeletonData: new Uint8Array([1]).buffer,
          mappings: fixture.mappings,
          onProgress: progress,
        }),
      ).rejects.toMatchObject({
        code: 'FRAMING_SCALE_INVALID',
        message: expect.stringContaining('80% 이상 150% 이하'),
      })

      expect(fixture.runtime.calls).toEqual([])
      expect(progress).not.toHaveBeenCalled()
      expect(fixture.pngEncoder).not.toHaveBeenCalled()
      expect(() => fixture.canvas.frameCanvas).toThrow(
        'Frame canvas has not been created yet.',
      )
    },
  )

  it.each([
    { x: 97, y: 0 },
    { x: 0, y: 105 },
    { x: 0.5, y: 0 },
  ])('잘못된 framing offset $x,$y를 canvas 생성 전에 거부한다', async (framingOffset) => {
    const fixture = createSamplerFixture()
    const progress = vi.fn()

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        framingOffset,
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
        onProgress: progress,
      }),
    ).rejects.toMatchObject({ code: 'FRAMING_OFFSET_INVALID' })

    expect(fixture.runtime.calls).toEqual([])
    expect(progress).not.toHaveBeenCalled()
    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(() => fixture.canvas.frameCanvas).toThrow(
      'Frame canvas has not been created yet.',
    )
  })

  it('표준 calibration frame이 완전 투명이면 state와 frame을 포함해 중단한다', async () => {
    const fixture = createSamplerFixture({ emptyReadbackAt: 0 })

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
      }),
    ).rejects.toMatchObject({
      code: 'FRAME_BOUNDS_FAILED',
      message: expect.stringContaining('idle 1번 calibration frame'),
    })

    expect(
      fixture.runtime.calls.filter((call) => call.startsWith('draw:')),
    ).toHaveLength(1)
    expect(fixture.canvas.readPixels).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.matrixOrtho).toHaveBeenCalledTimes(1)
    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['eye_scale bone 누락', { eyeBoneMissing: true }],
    ['표시 가능한 눈 attachment 부족', { eyeAttachmentCount: 1 }],
    ['1×1 placeholder 눈 attachment', { eyeAttachmentSize: 1 }],
  ] as const)('%s을 LOOK_RIG_MISSING으로 차단하고 자원을 정리한다', async (_label, options) => {
    const fixture = createSamplerFixture(options)

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
      }),
    ).rejects.toMatchObject({ code: 'LOOK_RIG_MISSING' })

    expect(fixture.runtime.calls.filter((call) => call.startsWith('draw:'))).toHaveLength(
      CODEX_PET_STANDARD_FRAME_COUNT * 2,
    )
    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['eye_scale bone 누락', { eyeBoneMissing: true }],
    ['표시 가능한 눈 attachment 부족', { eyeAttachmentCount: 1 }],
    ['불안정한 eye parent matrix', {
      parentMatrix: { a: 1, b: 2, c: 2, d: 4 },
    }],
  ] as const)('%s이면 static look fallback으로 73 frame을 완성한다', async (_label, options) => {
    const fixture = createSamplerFixture(options)

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        lookRigFallback: 'static',
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
      }),
    ).resolves.toMatchObject({
      frameCount: CODEX_PET_TOTAL_FRAME_COUNT,
      height: CODEX_PET_ATLAS_HEIGHT,
      width: CODEX_PET_ATLAS_WIDTH,
    })

    expect(
      fixture.runtime.calls.filter((call) => call.startsWith('draw:')),
    ).toHaveLength(
      CODEX_PET_STANDARD_FRAME_COUNT + CODEX_PET_TOTAL_FRAME_COUNT,
    )
    expect(fixture.pngEncoder).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it('특이 eye parent matrix를 LOOK_RIG_MISSING으로 차단한다', async () => {
    const fixture = createSamplerFixture({
      parentMatrix: { a: 1, b: 2, c: 2, d: 4 },
    })

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
      }),
    ).rejects.toMatchObject({
      code: 'LOOK_RIG_MISSING',
      message: expect.stringContaining('좌표 변환'),
    })

    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it('progress callback에서 abort하면 다음 frame 전에 중단하고 모든 자원을 한 번 정리한다', async () => {
    const fixture = createSamplerFixture()
    const controller = new AbortController()

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
        signal: controller.signal,
        onProgress(progress) {
          if (progress.phase === 'measuring' && progress.completedSteps === 1) {
            controller.abort('test cancellation')
          }
        },
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' })

    expect(fixture.runtime.calls.filter((call) => call.startsWith('bounds:'))).toHaveLength(1)
    expect(fixture.runtime.calls.filter((call) => call.startsWith('draw:'))).toHaveLength(0)
    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(fixture.runtime.batcherDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.shaderDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it('alpha calibration 진행 callback에서 abort하면 다음 calibration frame 전에 중단한다', async () => {
    const fixture = createSamplerFixture()
    const controller = new AbortController()

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
        signal: controller.signal,
        onProgress(progress) {
          if (progress.phase === 'calibrating') {
            controller.abort('calibration cancellation')
          }
        },
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' })

    expect(
      fixture.runtime.calls.filter((call) => call.startsWith('bounds:')),
    ).toHaveLength(CODEX_PET_STANDARD_FRAME_COUNT)
    expect(
      fixture.runtime.calls.filter((call) => call.startsWith('draw:')),
    ).toHaveLength(1)
    expect(fixture.canvas.readPixels).toHaveBeenCalledTimes(1)
    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it('look frame 진행 callback에서 abort하면 남은 방향과 PNG를 만들지 않고 정리한다', async () => {
    const fixture = createSamplerFixture()
    const controller = new AbortController()

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
        signal: controller.signal,
        onProgress(progress) {
          if (
            progress.phase === 'rendering' &&
            progress.lookDirectionIndex === 0
          ) {
            controller.abort('look cancellation')
          }
        },
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' })

    expect(fixture.runtime.calls.filter((call) => call.startsWith('draw:'))).toHaveLength(
      CODEX_PET_STANDARD_FRAME_COUNT * 2 + 1,
    )
    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(fixture.runtime.batcherDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.shaderDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it('encoding 진행 callback에서 abort하면 PNG encoder를 호출하지 않고 정리한다', async () => {
    const fixture = createSamplerFixture()
    const controller = new AbortController()

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
        signal: controller.signal,
        onProgress(progress) {
          if (progress.phase === 'encoding') {
            controller.abort('encoding cancellation')
          }
        },
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' })

    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(fixture.runtime.batcherDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.shaderDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })

  it('WebGL readback 오류를 안정적인 한국어 sampling 오류로 정규화하고 정리한다', async () => {
    const fixture = createSamplerFixture({ readbackFails: true })

    await expect(
      fixture.sampler.sample({
        atlasBundle: createBundle(),
        skeletonData: new Uint8Array([1]).buffer,
        mappings: fixture.mappings,
      }),
    ).rejects.toMatchObject({
      code: 'FRAME_READBACK_FAILED',
      message: expect.stringContaining('frame pixel을 읽지 못했습니다'),
    })

    expect(fixture.runtime.calls.filter((call) => call.startsWith('draw:'))).toHaveLength(1)
    expect(fixture.pngEncoder).not.toHaveBeenCalled()
    expect(fixture.runtime.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.runtime.textureDispose).toHaveBeenCalledTimes(1)
    expect(fixture.imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.loseContext).toHaveBeenCalledTimes(1)
  })
})
