import { describe, expect, it, vi } from 'vitest'

import { createSkeletonHeader } from '../../../test/skeletonFixtures'
import type { LiveSDAtlasBundle } from '../model'
import type { Spine36Runtime } from '../runtime/runtimeLoader'
import { LiveSD36Adapter } from './LiveSD36Adapter'
import { appendSkeletonTerminator } from './skeletonPadding'
import type { AnimationFrameScheduler } from './WebGLLiveSDPreviewSession'

interface MockRuntimeOptions {
  readonly atlasError?: Error
  readonly rendererError?: Error
}

interface MockRuntimeFixture {
  readonly calls: string[]
  readonly runtime: Spine36Runtime
  readonly state: {
    readonly animationApply: ReturnType<typeof vi.fn>
    readonly animationUpdate: ReturnType<typeof vi.fn>
    readonly atlasDispose: ReturnType<typeof vi.fn>
    readonly batcherEnd: ReturnType<typeof vi.fn>
    readonly batcherDispose: ReturnType<typeof vi.fn>
    readonly clearTracks: ReturnType<typeof vi.fn>
    readonly eyeBone: spine.Bone
    readonly matrixOrtho: ReturnType<typeof vi.fn>
    readonly parsedBuffers: ArrayBuffer[]
    readonly readSkeletonData: ReturnType<typeof vi.fn>
    readonly rendererDraw: ReturnType<typeof vi.fn>
    readonly rendererPremultipliedAlphaAtDraw: boolean[]
    readonly setAnimation: ReturnType<typeof vi.fn>
    readonly shaderDispose: ReturnType<typeof vi.fn>
    readonly shaderUnbind: ReturnType<typeof vi.fn>
    readonly textureDispose: ReturnType<typeof vi.fn>
    readonly worldTransform: ReturnType<typeof vi.fn>
  }
}

interface SchedulerFixture {
  readonly callbacks: FrameRequestCallback[]
  readonly cancel: ReturnType<typeof vi.fn>
  readonly request: ReturnType<typeof vi.fn>
  readonly scheduler: AnimationFrameScheduler
}

function createScheduler(): SchedulerFixture {
  const callbacks: FrameRequestCallback[] = []
  const request = vi.fn((callback: FrameRequestCallback) => {
    callbacks.push(callback)
    return callbacks.length
  })
  const cancel = vi.fn()

  return {
    callbacks,
    cancel,
    request,
    scheduler: { request, cancel },
  }
}

function createMockRuntime(
  animationNames: readonly string[],
  options: MockRuntimeOptions = {},
): MockRuntimeFixture {
  const calls: string[] = []
  const textureDispose = vi.fn(() => calls.push('dispose:Texture'))
  const atlasDispose = vi.fn(() => {
    calls.push('dispose:Atlas')
    textureDispose()
  })
  const batcherDispose = vi.fn(() => calls.push('dispose:Batcher'))
  const shaderDispose = vi.fn(() => calls.push('dispose:Shader'))
  const clearTracks = vi.fn(() => calls.push('dispose:Tracks'))
  const setAnimation = vi.fn()
  const animationUpdate = vi.fn()
  const animationApply = vi.fn()
  const worldTransform = vi.fn()
  const eyeBone = {
    parent: { a: 1, b: 0, c: 0, d: 1 },
    x: 0,
    y: 0,
  } as unknown as spine.Bone
  const rendererDraw = vi.fn()
  const rendererPremultipliedAlphaAtDraw: boolean[] = []
  const matrixOrtho = vi.fn()
  const parsedBuffers: ArrayBuffer[] = []
  const readSkeletonData = vi.fn((data: ArrayBuffer) => {
    calls.push('readSkeletonData')
    parsedBuffers.push(data)
    return {
      animations: animationNames.map((name) => ({ name })),
    }
  })

  class MockTextureAtlas {
    constructor(_text: string, loader: (path: string) => unknown) {
      loader('page.png')
      if (options.atlasError) {
        throw options.atlasError
      }
      calls.push('TextureAtlas')
    }

    dispose = atlasDispose
  }

  class MockSkeleton {
    data: unknown

    constructor(data: unknown) {
      calls.push('Skeleton')
      this.data = data
    }

    setToSetupPose = vi.fn()
    updateWorldTransform = worldTransform
    findBone(name: string) {
      return name === 'eye_scale' ? eyeBone : null
    }

    getBounds(
      offset: { x: number; y: number },
      size: { x: number; y: number },
    ) {
      offset.x = -10
      offset.y = -20
      size.x = 20
      size.y = 40
    }
  }

  class MockAnimationState {
    constructor(data: unknown) {
      void data
      calls.push('AnimationState')
    }

    setAnimation = setAnimation
    update = animationUpdate
    apply = animationApply
    clearTracks = clearTracks
  }

  const shader = {
    bind: vi.fn(),
    dispose: shaderDispose,
    setUniform4x4f: vi.fn(),
    setUniformi: vi.fn(),
    unbind: vi.fn(),
  }
  const batcherEnd = vi.fn()
  const batcher = {
    begin: vi.fn(),
    dispose: batcherDispose,
    end: batcherEnd,
  }

  const runtime = {
    TextureAtlas: MockTextureAtlas,
    AtlasAttachmentLoader: class {
      constructor(atlas: unknown) {
        void atlas
        calls.push('AtlasAttachmentLoader')
      }
    },
    SkeletonBinary: class {
      constructor(loader: unknown) {
        void loader
        calls.push('SkeletonBinary')
      }

      readSkeletonData(data: ArrayBuffer) {
        return readSkeletonData(data)
      }
    },
    Skeleton: MockSkeleton,
    AnimationStateData: class {
      constructor(data: unknown) {
        void data
        calls.push('AnimationStateData')
      }
    },
    AnimationState: MockAnimationState,
    Vector2: class {
      x = 0
      y = 0
    },
    webgl: {
      ManagedWebGLRenderingContext: class {
        constructor(gl: unknown) {
          void gl
          calls.push('ManagedWebGLRenderingContext')
        }
      },
      GLTexture: class {
        constructor(context: unknown, image: unknown) {
          void context
          void image
          calls.push('GLTexture')
        }

        dispose = textureDispose
      },
      Matrix4: class {
        values = new Float32Array(16)
        ortho2d = matrixOrtho
      },
      Shader: {
        newTwoColoredTextured: vi.fn(() => {
          calls.push('Shader')
          return shader
        }),
      },
      PolygonBatcher: class {
        constructor() {
          calls.push('PolygonBatcher')
          return batcher
        }
      },
      SkeletonRenderer: class {
        premultipliedAlpha = false

        constructor() {
          if (options.rendererError) {
            throw options.rendererError
          }
          calls.push('SkeletonRenderer')
        }

        draw(...args: unknown[]) {
          rendererPremultipliedAlphaAtDraw.push(this.premultipliedAlpha)
          rendererDraw(...args)
        }
      },
    },
  } as unknown as Spine36Runtime

  return {
    calls,
    runtime,
    state: {
      animationApply,
      animationUpdate,
      atlasDispose,
      batcherEnd,
      batcherDispose,
      clearTracks,
      eyeBone,
      matrixOrtho,
      parsedBuffers,
      readSkeletonData,
      rendererDraw,
      rendererPremultipliedAlphaAtDraw,
      setAnimation,
      shaderDispose,
      shaderUnbind: shader.unbind,
      textureDispose,
      worldTransform,
    },
  }
}

function createCanvas(): {
  readonly canvas: HTMLCanvasElement
  readonly gl: WebGLRenderingContext
} {
  const canvas = document.createElement('canvas')
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: 640 },
    clientHeight: { configurable: true, value: 480 },
  })

  const readPixels = vi.fn(
    (
      _x: number,
      _y: number,
      width: number,
      height: number,
      _format: number,
      _type: number,
      pixels: ArrayBufferView,
    ) => {
      const bytes = new Uint8Array(
        pixels.buffer,
        pixels.byteOffset,
        pixels.byteLength,
      )
      const left = Math.floor(width / 4)
      const right = Math.ceil((width * 3) / 4)
      const bottom = Math.floor(height / 4)
      const top = Math.ceil((height * 3) / 4)
      for (let row = bottom; row < top; row += 1) {
        for (let column = left; column < right; column += 1) {
          bytes[(row * width + column) * 4 + 3] = 255
        }
      }
    },
  )
  const gl = {
    COLOR_BUFFER_BIT: 0x4000,
    CULL_FACE: 0x0b44,
    DEPTH_TEST: 0x0b71,
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
    pixelStorei: vi.fn(),
    readPixels,
    viewport: vi.fn(),
  } as unknown as WebGLRenderingContext
  vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
  return { canvas, gl }
}

function createBundle(
  atlasPages: ReadonlyMap<string, Blob> = new Map([
    ['page.png', new Blob(['png'], { type: 'image/png' })],
  ]),
): LiveSDAtlasBundle {
  return {
    sourceName: 'character.zip',
    atlasPath: 'sekai_atlas.atlas',
    atlasText: 'page.png\nsize: 1,1\n',
    atlasPages,
  }
}

function loadedImage(dispose = vi.fn()) {
  return {
    image: document.createElement('img'),
    dispose,
  }
}

describe('LiveSD36Adapter', () => {
  it('generic bundle, cross-version NUL 복사본, 첫 draw, 기본 pose와 중복 dispose를 검증한다', async () => {
    const fixture = createMockRuntime(['walk', 'pose_default', 'idle'])
    const { canvas, gl } = createCanvas()
    const imageDispose = vi.fn()
    const scheduler = createScheduler()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage(imageDispose)),
      scheduler: scheduler.scheduler,
    })
    const skeletonData = createSkeletonHeader('3.3')
    const original = new Uint8Array(skeletonData).slice()

    const session = await adapter.createPreview({
      canvas,
      atlasBundle: createBundle(),
      skeletonData,
    })

    const parsed = fixture.state.parsedBuffers[0]
    expect(parsed).toBeDefined()
    expect(parsed).not.toBe(skeletonData)
    expect(parsed?.byteLength).toBe(skeletonData.byteLength + 1)
    expect(
      new Uint8Array(parsed ?? new ArrayBuffer())[skeletonData.byteLength],
    ).toBe(0)
    expect(new Uint8Array(skeletonData)).toEqual(original)
    expect(session.compatibility).toBe('best_effort')
    expect(session.version).toBe('3.3')
    expect(canvas.getContext).toHaveBeenCalledWith('webgl', {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
      stencil: false,
    })
    expect(gl.pixelStorei).toHaveBeenCalledWith(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      0,
    )
    expect(fixture.state.rendererDraw).toHaveBeenCalledTimes(2)
    expect(fixture.state.rendererPremultipliedAlphaAtDraw).toEqual([
      true,
      true,
    ])
    expect(gl.readPixels).toHaveBeenCalledTimes(1)
    expect(fixture.state.matrixOrtho).toHaveBeenCalledTimes(3)
    expect(fixture.state.matrixOrtho.mock.calls[2]?.[2]).toBeLessThan(
      fixture.state.matrixOrtho.mock.calls[1]?.[2] ?? 0,
    )
    const disable = vi.mocked(gl.disable)
    expect(disable.mock.calls.slice(0, 5)).toEqual([
      [gl.DEPTH_TEST],
      [gl.CULL_FACE],
      [gl.SCISSOR_TEST],
      [gl.STENCIL_TEST],
      [gl.POLYGON_OFFSET_FILL],
    ])
    expect(gl.depthMask).toHaveBeenCalledTimes(2)
    expect(gl.depthMask).toHaveBeenLastCalledWith(false)
    expect(disable.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.state.rendererDraw.mock.invocationCallOrder[0] ?? 0,
    )
    expect(scheduler.request).toHaveBeenCalledTimes(1)
    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(480)
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, 640, 480)

    const orderedCalls = [
      'GLTexture',
      'TextureAtlas',
      'AtlasAttachmentLoader',
      'SkeletonBinary',
      'readSkeletonData',
      'Skeleton',
      'AnimationStateData',
      'AnimationState',
      'Shader',
      'PolygonBatcher',
      'SkeletonRenderer',
    ]
    for (let index = 1; index < orderedCalls.length; index += 1) {
      expect(fixture.calls.indexOf(orderedCalls[index] ?? '')).toBeGreaterThan(
        fixture.calls.indexOf(orderedCalls[index - 1] ?? ''),
      )
    }

    expect(session.currentAnimation).toBe('pose_default')
    expect(session.framingScale).toBe(1)
    session.play('idle')
    expect(session.currentAnimation).toBe('idle')
    expect(fixture.state.rendererDraw).toHaveBeenCalledTimes(4)
    expect(gl.readPixels).toHaveBeenCalledTimes(2)
    expect(gl.depthMask).toHaveBeenCalledTimes(4)
    expect(() => session.play('missing')).toThrowError(
      expect.objectContaining({ code: 'ANIMATION_UNKNOWN' }),
    )
    expect(session.currentAnimation).toBe('idle')

    session.dispose()
    session.dispose()
    expect(scheduler.cancel).toHaveBeenCalledTimes(1)
    expect(fixture.state.clearTracks).toHaveBeenCalledTimes(1)
    expect(fixture.state.atlasDispose).toHaveBeenCalledTimes(1)
    expect(fixture.state.textureDispose).toHaveBeenCalledTimes(1)
    expect(fixture.state.batcherDispose).toHaveBeenCalledTimes(1)
    expect(fixture.state.shaderDispose).toHaveBeenCalledTimes(1)
    expect(imageDispose).toHaveBeenCalledTimes(1)
  })

  it('cached visible bounds에서 Pet 크기와 위치를 다시 투영하고 animation과 resize에 framing을 유지한다', async () => {
    const fixture = createMockRuntime(['pose_default', 'idle'])
    const { canvas, gl } = createCanvas()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage()),
      scheduler: createScheduler().scheduler,
    })
    const session = await adapter.createPreview({
      canvas,
      atlasBundle: createBundle(),
      skeletonData: createSkeletonHeader('3.6.53'),
    })
    const projection = () => {
      const call = fixture.state.matrixOrtho.mock.calls.at(-1)
      if (!call) {
        throw new Error('Expected an orthographic projection')
      }
      return {
        x: Number(call[0]),
        y: Number(call[1]),
        width: Number(call[2]),
        height: Number(call[3]),
      }
    }
    const baseProjection = projection()
    const drawsBeforeScale = fixture.state.rendererDraw.mock.calls.length
    const readsBeforeScale = vi.mocked(gl.readPixels).mock.calls.length
    const animationAppliesBeforeScale = fixture.state.animationApply.mock.calls.length
    const worldUpdatesBeforeScale = fixture.state.worldTransform.mock.calls.length
    const animationsBeforeScale = fixture.state.setAnimation.mock.calls.length

    session.setFramingScale(0.8)

    const scaledProjection = projection()
    expect(session.framingScale).toBe(0.8)
    expect(scaledProjection.width).toBeCloseTo(baseProjection.width / 0.8)
    expect(scaledProjection.height).toBeCloseTo(baseProjection.height / 0.8)
    expect(scaledProjection.x + scaledProjection.width / 2).toBeCloseTo(
      baseProjection.x + baseProjection.width / 2,
    )
    const visibleBottom = -12.1
    expect(
      (visibleBottom - scaledProjection.y) / scaledProjection.height,
    ).toBeCloseTo(
      (visibleBottom - baseProjection.y) / baseProjection.height,
    )
    expect(fixture.state.rendererDraw).toHaveBeenCalledTimes(drawsBeforeScale + 1)
    expect(gl.readPixels).toHaveBeenCalledTimes(readsBeforeScale)
    expect(fixture.state.animationApply).toHaveBeenCalledTimes(
      animationAppliesBeforeScale,
    )
    expect(fixture.state.worldTransform).toHaveBeenCalledTimes(
      worldUpdatesBeforeScale,
    )
    expect(fixture.state.setAnimation).toHaveBeenCalledTimes(
      animationsBeforeScale,
    )

    const projectionCountBeforeInvalid = fixture.state.matrixOrtho.mock.calls.length
    expect(() => session.setFramingScale(0.79)).toThrow(RangeError)
    expect(() => session.setFramingScale(1.51)).toThrow(RangeError)
    expect(() => session.setFramingScale(Number.NaN)).toThrow(RangeError)
    expect(session.framingScale).toBe(0.8)
    expect(fixture.state.matrixOrtho).toHaveBeenCalledTimes(
      projectionCountBeforeInvalid,
    )

    const beforeOffset = projection()
    session.setFramingOffset({ x: 12, y: 8 })
    const offsetProjection = projection()
    expect(session.framingOffset).toEqual({ x: 12, y: 8 })
    expect(((beforeOffset.x - offsetProjection.x) / offsetProjection.width) * 192).toBeCloseTo(12)
    expect(((offsetProjection.y - beforeOffset.y) / offsetProjection.height) * 208).toBeCloseTo(8)
    expect(() => session.setFramingOffset({ x: 97, y: 0 })).toThrow(RangeError)
    expect(() => session.setFramingOffset({ x: 0, y: 0.5 })).toThrow(RangeError)

    session.resize(320, 360)
    expect(session.framingScale).toBe(0.8)
    expect(session.framingOffset).toEqual({ x: 12, y: 8 })
    session.play('idle')
    expect(session.framingScale).toBe(0.8)
    expect(session.framingOffset).toEqual({ x: 12, y: 8 })
    expect(session.currentAnimation).toBe('idle')
    const coarseAnimationProjection =
      fixture.state.matrixOrtho.mock.calls.at(-2)
    expect(coarseAnimationProjection?.[2]).toBeCloseTo(128 / 3)
    expect(coarseAnimationProjection?.[3]).toBeCloseTo(48)
    const animationScaledProjection = projection()
    const readsAfterPlay = vi.mocked(gl.readPixels).mock.calls.length
    const animationsAfterPlay = fixture.state.setAnimation.mock.calls.length

    session.setFramingScale(1)

    const animationBaseProjection = projection()
    expect(animationScaledProjection.width).toBeCloseTo(
      animationBaseProjection.width / 0.8,
    )
    expect(animationScaledProjection.height).toBeCloseTo(
      animationBaseProjection.height / 0.8,
    )
    expect(gl.readPixels).toHaveBeenCalledTimes(readsAfterPlay)
    expect(fixture.state.setAnimation).toHaveBeenCalledTimes(animationsAfterPlay)
    session.dispose()
  })

  it('수평 반전을 중심 negative-width projection으로 적용하고 calibration은 canonical 방향을 유지한다', async () => {
    const fixture = createMockRuntime(['pose_default', 'idle'])
    const { canvas, gl } = createCanvas()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage()),
      scheduler: createScheduler().scheduler,
    })
    const session = await adapter.createPreview({
      canvas,
      atlasBundle: createBundle(),
      skeletonData: createSkeletonHeader('3.6.53'),
    })
    const baseProjection = fixture.state.matrixOrtho.mock.calls.at(-1)
    if (!baseProjection) {
      throw new Error('Expected the initial projection')
    }
    const readsBeforeMirror = vi.mocked(gl.readPixels).mock.calls.length
    const animationsBeforeMirror = fixture.state.setAnimation.mock.calls.length
    const drawsBeforeMirror = fixture.state.rendererDraw.mock.calls.length

    session.setMirrorX(true)

    expect(fixture.state.matrixOrtho).toHaveBeenLastCalledWith(
      Number(baseProjection[0]) + Number(baseProjection[2]),
      baseProjection[1],
      -Number(baseProjection[2]),
      baseProjection[3],
    )
    expect(gl.readPixels).toHaveBeenCalledTimes(readsBeforeMirror)
    expect(fixture.state.setAnimation).toHaveBeenCalledTimes(
      animationsBeforeMirror,
    )
    expect(fixture.state.rendererDraw).toHaveBeenCalledTimes(
      drawsBeforeMirror + 1,
    )

    session.setMirrorX(true)
    expect(fixture.state.rendererDraw).toHaveBeenCalledTimes(
      drawsBeforeMirror + 1,
    )

    session.resize(320, 360)
    expect(Number(fixture.state.matrixOrtho.mock.calls.at(-1)?.[2])).toBeLessThan(0)
    session.play('idle')
    const coarseProjection = fixture.state.matrixOrtho.mock.calls.at(-2)
    const mirroredAnimationProjection = fixture.state.matrixOrtho.mock.calls.at(-1)
    expect(Number(coarseProjection?.[2])).toBeGreaterThan(0)
    expect(Number(mirroredAnimationProjection?.[2])).toBeLessThan(0)

    session.setMirrorX(false)
    const restoredProjection = fixture.state.matrixOrtho.mock.calls.at(-1)
    expect(Number(restoredProjection?.[2])).toBeGreaterThan(0)
    session.dispose()
  })

  it('animation pose 뒤에 pointer look을 합성하고 frame 간 누적 없이 해제한다', async () => {
    const fixture = createMockRuntime(['pose_default', 'walk'])
    fixture.state.animationApply.mockImplementation(() => {
      fixture.state.eyeBone.x = 10
      fixture.state.eyeBone.y = 5
    })
    const scheduler = createScheduler()
    const { canvas } = createCanvas()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage()),
      scheduler: scheduler.scheduler,
    })
    const session = await adapter.createPreview({
      canvas,
      atlasBundle: createBundle(),
      skeletonData: createSkeletonHeader('3.6.53'),
    })

    session.setLookTarget({ x: 1, y: 0 }, 0.5)
    const halfScaleX = fixture.state.eyeBone.x
    expect(halfScaleX).toBeGreaterThan(10)
    expect(fixture.state.eyeBone.y).toBeCloseTo(5)

    session.setLookTarget({ x: 1, y: 0 }, 1.5)
    const fullScaleX = fixture.state.eyeBone.x
    expect(fullScaleX - 10).toBeCloseTo((halfScaleX - 10) * 3)

    session.setMirrorX(true)
    const mirroredX = fixture.state.eyeBone.x
    expect(mirroredX).toBeLessThan(10)
    expect(10 - mirroredX).toBeCloseTo(fullScaleX - 10)

    session.setMirrorX(false)
    expect(fixture.state.eyeBone.x).toBeCloseTo(fullScaleX)

    scheduler.callbacks[0]?.(16)
    expect(fixture.state.eyeBone.x).toBeCloseTo(fullScaleX)
    expect(fixture.state.eyeBone.y).toBeCloseTo(5)
    expect(fixture.state.animationUpdate).toHaveBeenLastCalledWith(0)

    session.play('walk')
    expect(session.currentAnimation).toBe('walk')
    expect(fixture.state.eyeBone.x).toBeCloseTo(fullScaleX)

    session.setLookTarget(null, 1.5)
    expect(fixture.state.eyeBone.x).toBeCloseTo(10)
    expect(fixture.state.eyeBone.y).toBeCloseTo(5)
    session.dispose()
  })

  it.each([
    ['3.6.99', 'experimental'],
    ['3.7.0', 'best_effort'],
  ] as const)('%s parser 성공을 %s session으로 허용한다', async (version, compatibility) => {
    const fixture = createMockRuntime(['idle'])
    const { canvas } = createCanvas()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage()),
      scheduler: createScheduler().scheduler,
    })

    const session = await adapter.createPreview({
      canvas,
      atlasBundle: createBundle(),
      skeletonData: createSkeletonHeader(version),
    })

    expect(session.compatibility).toBe(compatibility)
    session.dispose()
  })

  it('pose_default가 없으면 첫 애니메이션을 선택한다', async () => {
    const fixture = createMockRuntime(['first', 'second'])
    const { canvas } = createCanvas()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage()),
      scheduler: createScheduler().scheduler,
    })

    const session = await adapter.createPreview({
      canvas,
      atlasBundle: createBundle(),
      skeletonData: createSkeletonHeader('3.6.53'),
    })

    expect(session.currentAnimation).toBe('first')
    session.dispose()
  })

  it('parser 실패에 실제 input version과 runtime 3.6만 포함하고 자원을 정리한다', async () => {
    const fixture = createMockRuntime(['idle'])
    fixture.state.readSkeletonData.mockImplementation(() => {
      throw new Error('parse failed')
    })
    const { canvas } = createCanvas()
    const imageDispose = vi.fn()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage(imageDispose)),
    })

    await expect(
      adapter.createPreview({
        canvas,
        atlasBundle: createBundle(),
        skeletonData: createSkeletonHeader('3.3'),
      }),
    ).rejects.toMatchObject({
      code: 'SKELETON_PARSE_FAILED',
      message: expect.stringMatching(/3\.3.*3\.6/),
    })
    expect(fixture.state.atlasDispose).toHaveBeenCalledTimes(1)
    expect(imageDispose).toHaveBeenCalledTimes(1)
  })

  it('첫 frame draw 실패를 ready 이전 오류로 반환하고 소유 자원을 정리한다', async () => {
    const fixture = createMockRuntime(['idle'])
    fixture.state.rendererDraw.mockImplementation(() => {
      throw new Error('draw failed')
    })
    const { canvas } = createCanvas()
    const imageDispose = vi.fn()
    const scheduler = createScheduler()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage(imageDispose)),
      scheduler: scheduler.scheduler,
    })

    await expect(
      adapter.createPreview({
        canvas,
        atlasBundle: createBundle(),
        skeletonData: createSkeletonHeader('3.6.53'),
      }),
    ).rejects.toMatchObject({ code: 'PREVIEW_RENDER_FAILED' })

    expect(scheduler.request).not.toHaveBeenCalled()
    expect(fixture.state.batcherEnd).toHaveBeenCalledTimes(1)
    expect(fixture.state.shaderUnbind).toHaveBeenCalledTimes(1)
    expect(fixture.state.clearTracks).toHaveBeenCalledTimes(1)
    expect(fixture.state.batcherDispose).toHaveBeenCalledTimes(1)
    expect(fixture.state.shaderDispose).toHaveBeenCalledTimes(1)
    expect(fixture.state.atlasDispose).toHaveBeenCalledTimes(1)
    expect(imageDispose).toHaveBeenCalledTimes(1)
  })

  it('후속 frame 실패를 한 번 알리고 스스로 dispose한다', async () => {
    const fixture = createMockRuntime(['idle'])
    const { canvas } = createCanvas()
    const scheduler = createScheduler()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage()),
      scheduler: scheduler.scheduler,
    })
    const session = await adapter.createPreview({
      canvas,
      atlasBundle: createBundle(),
      skeletonData: createSkeletonHeader('3.6.53'),
    })
    const listener = vi.fn()
    session.onError(listener)
    fixture.state.rendererDraw.mockImplementation(() => {
      throw new Error('later draw failed')
    })

    scheduler.callbacks[0]?.(16)
    scheduler.callbacks[0]?.(32)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PREVIEW_RENDER_FAILED' }),
    )
    expect(scheduler.cancel).toHaveBeenCalledTimes(1)
    expect(fixture.state.atlasDispose).toHaveBeenCalledTimes(1)
    session.dispose()
    expect(fixture.state.atlasDispose).toHaveBeenCalledTimes(1)
  })

  it('오류 구독 해제 후에도 render 실패 자원은 정리하되 listener는 호출하지 않는다', async () => {
    const fixture = createMockRuntime(['idle'])
    const { canvas } = createCanvas()
    const scheduler = createScheduler()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage()),
      scheduler: scheduler.scheduler,
    })
    const session = await adapter.createPreview({
      canvas,
      atlasBundle: createBundle(),
      skeletonData: createSkeletonHeader('3.6.53'),
    })
    const listener = vi.fn()
    const unsubscribe = session.onError(listener)
    unsubscribe()
    unsubscribe()
    fixture.state.rendererDraw.mockImplementation(() => {
      throw new Error('later draw failed')
    })

    scheduler.callbacks[0]?.(16)

    expect(listener).not.toHaveBeenCalled()
    expect(fixture.state.atlasDispose).toHaveBeenCalledTimes(1)
  })

  it('부분 image decode 실패를 구분하고 이미 decode한 image를 정리한다', async () => {
    const fixture = createMockRuntime(['idle'])
    const { canvas } = createCanvas()
    const firstDispose = vi.fn()
    const imageLoader = vi
      .fn()
      .mockResolvedValueOnce(loadedImage(firstDispose))
      .mockRejectedValueOnce(new Error('decode failed'))
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader,
    })
    const pages = new Map([
      ['page.png', new Blob(['png'])],
      ['second.png', new Blob(['png'])],
    ])

    await expect(
      adapter.createPreview({
        canvas,
        atlasBundle: createBundle(pages),
        skeletonData: createSkeletonHeader('3.6.53'),
      }),
    ).rejects.toMatchObject({ code: 'ATLAS_IMAGE_DECODE_FAILED' })
    expect(firstDispose).toHaveBeenCalledTimes(1)
  })

  it.each([
    {
      expectedCode: 'ATLAS_RUNTIME_PARSE_FAILED',
      fixture: () => createMockRuntime(['idle'], { atlasError: new Error('atlas') }),
    },
    {
      expectedCode: 'PREVIEW_RENDERER_CREATE_FAILED',
      fixture: () =>
        createMockRuntime(['idle'], { rendererError: new Error('renderer') }),
    },
    {
      expectedCode: 'ANIMATION_MISSING',
      fixture: () => createMockRuntime([]),
    },
  ])('$expectedCode 초기화 실패에서 생성된 자원을 정리한다', async ({
    expectedCode,
    fixture: createFixture,
  }) => {
    const fixture = createFixture()
    const { canvas } = createCanvas()
    const imageDispose = vi.fn()
    const adapter = new LiveSD36Adapter({
      runtimeLoader: { load: vi.fn(async () => fixture.runtime) },
      imageLoader: vi.fn(async () => loadedImage(imageDispose)),
    })

    await expect(
      adapter.createPreview({
        canvas,
        atlasBundle: createBundle(),
        skeletonData: createSkeletonHeader('3.6.53'),
      }),
    ).rejects.toMatchObject({ code: expectedCode })

    expect(imageDispose).toHaveBeenCalledTimes(1)
    expect(fixture.state.textureDispose).toHaveBeenCalledTimes(1)
  })

  it('padding helper가 항상 별도 버퍼를 만든다', () => {
    const source = new Uint8Array([1, 2, 3]).buffer
    const padded = appendSkeletonTerminator(source)

    expect(padded).not.toBe(source)
    expect([...new Uint8Array(padded)]).toEqual([1, 2, 3, 0])
    expect([...new Uint8Array(source)]).toEqual([1, 2, 3])
  })

  it('WebGL context가 없으면 runtime을 호출하지 않는다', async () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    const runtimeLoad = vi.fn()
    const adapter = new LiveSD36Adapter({ runtimeLoader: { load: runtimeLoad } })

    await expect(
      adapter.createPreview({
        canvas,
        atlasBundle: createBundle(),
        skeletonData: createSkeletonHeader('3.6.53'),
      }),
    ).rejects.toMatchObject({ code: 'WEBGL_UNSUPPORTED' })
    expect(runtimeLoad).not.toHaveBeenCalled()
  })
})
