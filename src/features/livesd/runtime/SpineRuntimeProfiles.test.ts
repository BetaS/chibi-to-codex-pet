import { describe, expect, it, vi } from 'vitest'
import type * as Spine40 from '@esotericsoftware/spine-webgl'

import {
  createSkeletonHeader,
  createSpine40SkeletonHeader,
} from '../../../test/skeletonFixtures'
import type { Spine40Runtime } from './Spine40RuntimeLoader'
import { Spine36RuntimeProfileAdapter } from './Spine36RuntimeProfileAdapter'
import { Spine40RuntimeProfileAdapter } from './Spine40RuntimeProfileAdapter'
import type { Spine36Runtime } from './runtimeLoader'

interface GlFixture {
  readonly disable: ReturnType<typeof vi.fn>
  readonly gl: WebGLRenderingContext
  readonly pixelStorei: ReturnType<typeof vi.fn>
}

function createGlFixture(): GlFixture {
  const disable = vi.fn()
  const pixelStorei = vi.fn()
  const gl = {
    COLOR_BUFFER_BIT: 0x4000,
    CULL_FACE: 0x0b44,
    DEPTH_TEST: 0x0b71,
    POLYGON_OFFSET_FILL: 0x8037,
    SCISSOR_TEST: 0x0c11,
    STENCIL_TEST: 0x0b90,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    clear: vi.fn(),
    clearColor: vi.fn(),
    depthMask: vi.fn(),
    disable,
    pixelStorei,
  } as unknown as WebGLRenderingContext
  return { disable, gl, pixelStorei }
}

interface RuntimeProfileFixture {
  readonly animationApply: ReturnType<typeof vi.fn>
  readonly atlasDispose: ReturnType<typeof vi.fn>
  readonly batcherDispose: ReturnType<typeof vi.fn>
  readonly batcherEnd: ReturnType<typeof vi.fn>
  readonly capturedBinary: () => ArrayBuffer | Uint8Array | null
  readonly clearTracks: ReturnType<typeof vi.fn>
  readonly draw: ReturnType<typeof vi.fn>
  readonly matrixOrtho: ReturnType<typeof vi.fn>
  readonly rendererPmaAtDraw: readonly boolean[]
  readonly runtime: Spine36Runtime | Spine40Runtime
  readonly shaderDispose: ReturnType<typeof vi.fn>
  readonly textureDispose: ReturnType<typeof vi.fn>
}

function createSpine36Fixture(): RuntimeProfileFixture {
  let binary: ArrayBuffer | null = null
  const rendererPmaAtDraw: boolean[] = []
  const animationApply = vi.fn()
  const textureDispose = vi.fn()
  const atlasDispose = vi.fn(() => textureDispose())
  const batcherDispose = vi.fn()
  const shaderDispose = vi.fn()
  const clearTracks = vi.fn()
  const batcherEnd = vi.fn()
  const matrixOrtho = vi.fn()
  const draw = vi.fn()
  const animation = {
    duration: 2,
    name: 'pose_default',
    apply: animationApply,
  } as unknown as spine.Animation
  const skeletonData = {
    animations: [animation],
    version: '3.6.53D4',
  } as spine.SkeletonData

  class TextureAtlas {
    readonly texture: { dispose(): void }

    constructor(
      _text: string,
      textureLoader: (pageName: string) => { dispose(): void },
    ) {
      this.texture = textureLoader('page.png')
    }

    dispose(): void {
      atlasDispose()
    }
  }

  class Skeleton {
    readonly drawOrder = [
      {
        bone: { data: { name: 'root' } },
        data: { name: 'body-slot' },
        getAttachment: () => ({ name: 'body' }),
      },
    ]
    time = 0

    constructor(data: spine.SkeletonData) {
      void data
    }

    setToSetupPose(): void {}

    updateWorldTransform(): void {}

    getBounds(offset: spine.Vector2, size: spine.Vector2): void {
      offset.x = -10
      offset.y = -20
      size.x = 20
      size.y = 40
    }
  }

  class AnimationState {
    constructor(data: spine.AnimationStateData) {
      void data
    }

    setAnimation(): void {}

    update(): void {}

    apply(): void {}

    clearTracks(): void {
      clearTracks()
    }
  }

  class Shader {
    static newTwoColoredTextured(): Shader {
      return new Shader()
    }

    bind(): void {}

    unbind(): void {}

    setUniformi(): void {}

    setUniform4x4f(): void {}

    dispose(): void {
      shaderDispose()
    }
  }

  class PolygonBatcher {
    begin(): void {}

    end(): void {
      batcherEnd()
    }

    dispose(): void {
      batcherDispose()
    }
  }

  class SkeletonRenderer {
    premultipliedAlpha = false

    draw(): void {
      rendererPmaAtDraw.push(this.premultipliedAlpha)
      draw()
    }
  }

  const runtime = {
    AnimationState,
    AnimationStateData: class {},
    AtlasAttachmentLoader: class {},
    MixDirection: { in: 23 },
    MixPose: { setup: 17 },
    Skeleton,
    SkeletonBinary: class {
      readSkeletonData(data: ArrayBuffer): spine.SkeletonData {
        binary = data
        return skeletonData
      }
    },
    TextureAtlas,
    Vector2: class {
      x = 0
      y = 0
    },
    webgl: {
      GLTexture: class {
        dispose(): void {
          textureDispose()
        }
      },
      ManagedWebGLRenderingContext: class {},
      Matrix4: class {
        readonly values = new Float32Array(16)
        readonly ortho2d = matrixOrtho
      },
      PolygonBatcher,
      Shader,
      SkeletonRenderer,
    },
  } as unknown as Spine36Runtime

  return {
    animationApply,
    atlasDispose,
    batcherDispose,
    batcherEnd,
    capturedBinary: () => binary,
    clearTracks,
    draw,
    matrixOrtho,
    rendererPmaAtDraw,
    runtime,
    shaderDispose,
    textureDispose,
  }
}

function createSpine40Fixture(): RuntimeProfileFixture {
  let binary: Uint8Array | null = null
  let texture: { dispose(): void } | null = null
  const rendererPmaAtDraw: boolean[] = []
  const animationApply = vi.fn()
  const textureDispose = vi.fn()
  const atlasDispose = vi.fn(() => texture?.dispose())
  const batcherDispose = vi.fn()
  const shaderDispose = vi.fn()
  const clearTracks = vi.fn()
  const batcherEnd = vi.fn()
  const matrixOrtho = vi.fn()
  const draw = vi.fn()
  const animation = {
    duration: 3,
    name: 'Idle',
    apply: animationApply,
  } as unknown as Spine40.Animation
  const skeletonData = {
    animations: [animation],
    version: '4.0.64',
  } as Spine40.SkeletonData

  class TextureAtlas {
    readonly pages = [
      {
        name: 'page.png',
        setTexture(value: { dispose(): void }) {
          texture = value
        },
      },
    ]

    constructor(text: string) {
      void text
    }

    dispose(): void {
      atlasDispose()
    }
  }

  class Skeleton {
    readonly drawOrder = [
      {
        bone: { data: { name: 'F_body' } },
        data: { name: 'costume-slot' },
        getAttachment: () => ({ name: 'costume' }),
      },
    ]
    time = 0

    constructor(data: Spine40.SkeletonData) {
      void data
    }

    setToSetupPose(): void {}

    updateWorldTransform(): void {}

    getBounds(offset: Spine40.Vector2, size: Spine40.Vector2): void {
      offset.x = -12
      offset.y = -24
      size.x = 24
      size.y = 48
    }
  }

  class AnimationState {
    constructor(data: Spine40.AnimationStateData) {
      void data
    }

    setAnimation(): void {}

    update(): void {}

    apply(): void {}

    clearTracks(): void {
      clearTracks()
    }
  }

  class Shader {
    static readonly SAMPLER = 'sampler'
    static readonly MVP_MATRIX = 'mvp'

    static newTwoColoredTextured(): Shader {
      return new Shader()
    }

    bind(): void {}

    unbind(): void {}

    setUniformi(): void {}

    setUniform4x4f(): void {}

    dispose(): void {
      shaderDispose()
    }
  }

  class PolygonBatcher {
    begin(): void {}

    end(): void {
      batcherEnd()
    }

    dispose(): void {
      batcherDispose()
    }
  }

  class SkeletonRenderer {
    premultipliedAlpha = true

    draw(): void {
      rendererPmaAtDraw.push(this.premultipliedAlpha)
      draw()
    }
  }

  const runtime = {
    AnimationState,
    AnimationStateData: class {},
    AtlasAttachmentLoader: class {},
    GLTexture: class {
      dispose(): void {
        textureDispose()
      }
    },
    ManagedWebGLRenderingContext: class {},
    Matrix4: class {
      readonly values = new Float32Array(16)
      readonly ortho2d = matrixOrtho
    },
    MixBlend: { setup: 31 },
    MixDirection: { mixIn: 37 },
    PolygonBatcher,
    Shader,
    Skeleton,
    SkeletonBinary: class {
      readSkeletonData(data: Uint8Array): Spine40.SkeletonData {
        binary = data
        return skeletonData
      }
    },
    SkeletonRenderer,
    TextureAtlas,
    Vector2: class {
      x = 0
      y = 0
    },
  } as unknown as Spine40Runtime

  return {
    animationApply,
    atlasDispose,
    batcherDispose,
    batcherEnd,
    capturedBinary: () => binary,
    clearTracks,
    draw,
    matrixOrtho,
    rendererPmaAtDraw,
    runtime,
    shaderDispose,
    textureDispose,
  }
}

describe('Spine 3.6 runtime facade characterization', () => {
  it('기존 global runtime, trailing NUL, PMA draw와 dispose 계약을 보존한다', async () => {
    const fixture = createSpine36Fixture()
    const { disable, gl, pixelStorei } = createGlFixture()
    const source = createSkeletonHeader('3.6.53D4')
    const original = [...new Uint8Array(source)]
    const adapter = new Spine36RuntimeProfileAdapter({
      runtimeLoader: {
        load: vi.fn(async () => fixture.runtime as Spine36Runtime),
      },
    })

    const session = await adapter.createSession({
      atlasText: 'page.png\nsize: 2,2\n',
      gl,
      resolveAtlasPage: () => new Image(),
      skeletonData: source,
    })

    const parserBytes = new Uint8Array(fixture.capturedBinary() as ArrayBuffer)
    expect(parserBytes.byteLength).toBe(original.length + 1)
    expect([...parserBytes.subarray(0, -1)]).toEqual(original)
    expect(parserBytes.at(-1)).toBe(0)
    expect([...new Uint8Array(source)]).toEqual(original)
    expect(session.runtimeKey).toBe('spine-3.6')
    expect(session.skeletonVersion).toBe('3.6.53D4')
    expect(session.currentAnimation).toBe('pose_default')
    expect(session.premultipliedAlpha).toBe(true)
    expect(session.getBounds()).toEqual({ x: -10, y: -20, width: 20, height: 40 })
    expect(session.getDrawOrder()).toEqual([
      { attachmentName: 'body', boneName: 'root', slotName: 'body-slot' },
    ])
    expect(pixelStorei).toHaveBeenCalledWith(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      0,
    )

    session.applyAnimationAt('pose_default', 1)
    expect(fixture.animationApply).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      1,
      true,
      [],
      1,
      17,
      23,
    )
    session.draw({ x: -12, y: -24, width: 24, height: 48 })
    expect(fixture.rendererPmaAtDraw).toEqual([true])
    expect(fixture.draw).toHaveBeenCalledOnce()
    expect(disable).toHaveBeenCalledWith(gl.DEPTH_TEST)
    expect(fixture.matrixOrtho).toHaveBeenCalledWith(-12, -24, 24, 48)

    session.dispose()
    session.dispose()
    expect(fixture.clearTracks).toHaveBeenCalledOnce()
    expect(fixture.batcherDispose).toHaveBeenCalledOnce()
    expect(fixture.shaderDispose).toHaveBeenCalledOnce()
    expect(fixture.atlasDispose).toHaveBeenCalledOnce()
    expect(fixture.textureDispose).toHaveBeenCalledOnce()
  })

  it('facade에 부족한 3.6 API shape를 stable 오류로 거부한다', async () => {
    const adapter = new Spine36RuntimeProfileAdapter({
      runtimeLoader: {
        load: vi.fn(async () => ({
          SkeletonBinary: class {},
          TextureAtlas: class {},
          webgl: {},
        }) as unknown as Spine36Runtime),
      },
    })

    await expect(adapter.load()).rejects.toMatchObject({
      code: 'RUNTIME_PROFILE_API_INVALID',
      context: expect.objectContaining({ runtimeKey: 'spine-3.6' }),
    })
  })
})

describe('Spine 4.0 runtime facade', () => {
  it('원본 byte view, top-level ESM API, straight-alpha draw와 dispose를 격리한다', async () => {
    const fixture = createSpine40Fixture()
    const { disable, gl, pixelStorei } = createGlFixture()
    const source = createSpine40SkeletonHeader('4.0.64')
    const adapter = new Spine40RuntimeProfileAdapter({
      runtimeLoader: {
        load: vi.fn(async () => fixture.runtime as Spine40Runtime),
      },
    })

    const session = await adapter.createSession({
      atlasText: 'page.png\nsize: 2,2\n',
      gl,
      resolveAtlasPage: () => new Image(),
      skeletonData: source,
    })

    const parserBytes = fixture.capturedBinary() as Uint8Array
    expect(parserBytes.buffer).toBe(source)
    expect([...parserBytes]).toEqual([...new Uint8Array(source)])
    expect(session.runtimeKey).toBe('spine-4.0')
    expect(session.skeletonVersion).toBe('4.0.64')
    expect(session.currentAnimation).toBe('Idle')
    expect(session.premultipliedAlpha).toBe(false)
    expect(session.getBounds()).toEqual({ x: -12, y: -24, width: 24, height: 48 })
    expect(session.getDrawOrder()).toEqual([
      {
        attachmentName: 'costume',
        boneName: 'F_body',
        slotName: 'costume-slot',
      },
    ])
    expect(pixelStorei).toHaveBeenCalledWith(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      0,
    )

    session.applyAnimationAt('Idle', 1.5)
    expect(fixture.animationApply).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      1.5,
      true,
      [],
      1,
      31,
      37,
    )
    session.draw({ x: -15, y: -30, width: 30, height: 60 })
    expect(fixture.rendererPmaAtDraw).toEqual([false])
    expect(fixture.draw).toHaveBeenCalledOnce()
    expect(disable).toHaveBeenCalledWith(gl.DEPTH_TEST)
    expect(fixture.matrixOrtho).toHaveBeenCalledWith(-15, -30, 30, 60)

    session.dispose()
    session.dispose()
    expect(fixture.clearTracks).toHaveBeenCalledOnce()
    expect(fixture.batcherDispose).toHaveBeenCalledOnce()
    expect(fixture.shaderDispose).toHaveBeenCalledOnce()
    expect(fixture.atlasDispose).toHaveBeenCalledOnce()
    expect(fixture.textureDispose).toHaveBeenCalledOnce()
  })

  it('parser 실패 시 부분 texture와 atlas를 한 번 정리하고 stable 오류를 반환한다', async () => {
    const fixture = createSpine40Fixture()
    const runtime = fixture.runtime as Spine40Runtime
    Reflect.set(runtime, 'SkeletonBinary', class {
      readSkeletonData(): never {
        throw new Error('parse exploded')
      }
    })
    const adapter = new Spine40RuntimeProfileAdapter({
      runtimeLoader: { load: vi.fn(async () => runtime) },
    })

    await expect(
      adapter.createSession({
        atlasText: 'page.png\nsize: 2,2\n',
        gl: createGlFixture().gl,
        resolveAtlasPage: () => new Image(),
        skeletonData: createSpine40SkeletonHeader('4.0.64'),
      }),
    ).rejects.toMatchObject({ code: 'RUNTIME_PROFILE_PARSE_FAILED' })
    expect(fixture.atlasDispose).toHaveBeenCalledOnce()
    expect(fixture.textureDispose).toHaveBeenCalledOnce()
    expect(fixture.batcherDispose).not.toHaveBeenCalled()
    expect(fixture.shaderDispose).not.toHaveBeenCalled()
  })

  it('다른 version byte를 ESM runtime load 전에 거부한다', async () => {
    const load = vi.fn(async () => createSpine40Fixture().runtime as Spine40Runtime)
    const adapter = new Spine40RuntimeProfileAdapter({
      runtimeLoader: { load },
    })

    await expect(
      adapter.createSession({
        atlasText: 'page.png\nsize: 2,2\n',
        gl: createGlFixture().gl,
        resolveAtlasPage: () => new Image(),
        skeletonData: createSkeletonHeader('3.6.53'),
      }),
    ).rejects.toMatchObject({
      code: 'RUNTIME_PROFILE_MISMATCH',
      context: {
        actualVersion: '3.6.53',
        requestedRuntimeKey: 'spine-4.0',
        runtimeKey: 'spine-3.6',
      },
    })
    expect(load).not.toHaveBeenCalled()
  })
})
