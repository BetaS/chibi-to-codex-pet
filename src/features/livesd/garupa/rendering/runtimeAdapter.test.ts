import { describe, expect, it, vi } from 'vitest'

import type { LoadedAtlasImage } from '../../adapter/atlasImageLoader'
import type {
  Spine40Runtime,
  Spine40RuntimeLoader,
} from '../../runtime/Spine40RuntimeLoader'
import { GarupaRenderingError } from './errors'
import { OfficialGarupaSpine40RuntimeAdapter } from './runtimeAdapter'

function createGl(): WebGLRenderingContext {
  return {
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 1,
    pixelStorei: vi.fn(),
  } as unknown as WebGLRenderingContext
}

function createOfficialRuntimeFixture(options: { skeletonFails?: boolean } = {}) {
  const calls: string[] = []
  const atlasDispose = vi.fn(() => calls.push('dispose:atlas'))
  const batcherDispose = vi.fn(() => calls.push('dispose:batcher'))
  const clearTracks = vi.fn(() => calls.push('dispose:animation-state'))
  const imageDispose = vi.fn(() => calls.push('dispose:image'))
  const shaderDispose = vi.fn(() => calls.push('dispose:shader'))
  const textureDispose = vi.fn(() => calls.push('dispose:texture'))
  const parsedBytes: Uint8Array[] = []
  const matrixOrtho = vi.fn()
  const rendererDrawOrder: string[][] = []
  const animationApply = vi.fn()

  const leftParent = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    data: { name: 'left-parent' },
    parent: null,
    x: 0,
    y: 0,
  }
  const rightParent = {
    ...leftParent,
    data: { name: 'right-parent' },
  }
  const left = {
    ...leftParent,
    data: { name: 'F_eyeL' },
    parent: leftParent,
  }
  const right = {
    ...rightParent,
    data: { name: 'F_eyeR' },
    parent: rightParent,
  }
  const slot = (name: string, bone: typeof left) => ({
    bone,
    color: { a: 1 },
    data: { name },
    getAttachment: () => ({
      color: { a: 1 },
      name: `${name}_eye`,
      region: { originalHeight: 24, originalWidth: 32 },
    }),
  })
  const leftSlot = slot('left-slot', left)
  const rightSlot = slot('right-slot', right)
  const skeletonData = {
    animations: [{ apply: animationApply, duration: 1, name: 'Idle' }],
    version: '4.0.64',
  }

  class MockSkeleton {
    readonly bones = [leftParent, rightParent, left, right]
    readonly drawOrder = [rightSlot, leftSlot]
    readonly slots = [leftSlot, rightSlot]
    time = 0

    findBone(name: string) {
      return this.bones.find((bone) => bone.data.name === name) ?? null
    }

    getBounds(offset: { x: number; y: number }, size: { x: number; y: number }) {
      offset.x = -10
      offset.y = -20
      size.x = 20
      size.y = 40
    }

    setToSetupPose() {
      left.x = 0
      left.y = 0
      right.x = 0
      right.y = 0
    }

    updateWorldTransform() {
      calls.push('world')
    }
  }

  class MockTextureAtlas {
    readonly pages = [{
      name: 'page.png',
      setTexture: vi.fn(() => calls.push('texture:set')),
    }]

    dispose() {
      atlasDispose()
      textureDispose()
    }
  }

  class MockShader {
    static readonly MVP_MATRIX = 'u_projTrans'
    static readonly SAMPLER = 'u_texture'
    static readonly newTwoColoredTextured = vi.fn(() => new MockShader())

    bind() {
      calls.push('shader:bind')
    }

    dispose() {
      shaderDispose()
    }

    setUniform4x4f() {}
    setUniformi() {}

    unbind() {
      calls.push('shader:unbind')
    }
  }

  class MockBatcher {
    begin() {
      calls.push('batcher:begin')
    }

    dispose() {
      batcherDispose()
    }

    end() {
      calls.push('batcher:end')
    }
  }

  class MockRenderer {
    premultipliedAlpha = true

    draw(_batcher: MockBatcher, skeleton: MockSkeleton) {
      calls.push(`draw:pma:${this.premultipliedAlpha}`)
      rendererDrawOrder.push(
        skeleton.drawOrder.map((entry) => entry.data.name),
      )
    }
  }

  const runtime = {
    AnimationState: class {
      clearTracks = clearTracks
    },
    AnimationStateData: class {},
    AtlasAttachmentLoader: class {},
    GLTexture: class {
      dispose = textureDispose
    },
    ManagedWebGLRenderingContext: class {},
    Matrix4: class {
      readonly ortho2d = matrixOrtho
      readonly values = new Float32Array(16)
    },
    MixBlend: { setup: 0 },
    MixDirection: { mixIn: 0 },
    PolygonBatcher: MockBatcher,
    Shader: MockShader,
    Skeleton: MockSkeleton,
    SkeletonBinary: class {
      readSkeletonData(bytes: Uint8Array) {
        parsedBytes.push(Uint8Array.from(bytes))
        if (options.skeletonFails) throw new Error('synthetic parse failure')
        return skeletonData
      }
    },
    SkeletonRenderer: MockRenderer,
    TextureAtlas: MockTextureAtlas,
    Vector2: class {
      x = 0
      y = 0
    },
  } as unknown as Spine40Runtime
  const load = vi.fn(async () => runtime)
  const image: LoadedAtlasImage = {
    dispose: imageDispose,
    image: { height: 2, width: 2 } as HTMLImageElement,
  }
  const imageLoader = vi.fn(async () => image)

  return {
    animationApply,
    atlasDispose,
    batcherDispose,
    calls,
    clearTracks,
    imageDispose,
    imageLoader,
    load,
    matrixOrtho,
    parsedBytes,
    rendererDrawOrder,
    shaderDispose,
    textureDispose,
  }
}

describe('OfficialGarupaSpine40RuntimeAdapter', () => {
  it('keeps source bytes exact and hides official bones, slots and draw order', async () => {
    const fixture = createOfficialRuntimeFixture()
    const adapter = new OfficialGarupaSpine40RuntimeAdapter({
      imageLoader: fixture.imageLoader,
      runtimeLoader: { load: fixture.load } as Pick<Spine40RuntimeLoader, 'load'>,
    })
    const skeletonBytes = new Uint8Array([4, 0, 64, 255]).buffer
    const gl = createGl()
    const session = await adapter.createSession({
      atlasBundle: {
        atlasPages: new Map([
          ['costume/page.png', new Blob(['synthetic-page'])],
        ]),
        atlasPath: 'costume/model.atlas',
        atlasText: 'page.png\nsize: 2,2\n',
        sourceName: 'synthetic.zip',
      },
      gl,
      skeletonData: skeletonBytes,
      textureUpload: {
        preserveRgb: true,
        unpackPremultiplyAlpha: false,
      },
    })

    expect(fixture.parsedBytes).toEqual([new Uint8Array([4, 0, 64, 255])])
    expect(fixture.imageLoader).toHaveBeenCalledWith(
      expect.any(Blob),
      'costume/page.png',
    )
    expect(gl.pixelStorei).toHaveBeenCalledWith(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      0,
    )
    expect(session.findBone('F_eyeL')).toEqual(
      expect.objectContaining({ name: 'F_eyeL' }),
    )
    expect(session.slots.map(({ attachment, name }) => ({
      attachment: attachment?.name,
      name,
    }))).toEqual([
      { attachment: 'left-slot_eye', name: 'left-slot' },
      { attachment: 'right-slot_eye', name: 'right-slot' },
    ])

    session.applyAnimation({
      animationName: 'Idle',
      duration: 1,
      loop: true,
      resetToSetupPose: true,
      time: 0.5,
    })
    session.updateWorldTransform()
    session.setProjection({ x: -10, y: -20, width: 20, height: 40 })
    session.draw({
      blend: 'src-alpha-one-minus-src-alpha',
      layerOrder: 'runtime-draw-order',
      mirrorX: true,
      premultipliedAlpha: false,
    })

    expect(fixture.animationApply).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0.5,
      true,
      [],
      1,
      0,
      0,
    )
    expect(fixture.matrixOrtho).toHaveBeenCalledWith(10, -20, -20, 40)
    expect(fixture.calls).toContain('draw:pma:false')
    expect(fixture.rendererDrawOrder).toEqual([['right-slot', 'left-slot']])

    session.dispose()
    session.dispose()
    expect(fixture.clearTracks).toHaveBeenCalledOnce()
    expect(fixture.batcherDispose).toHaveBeenCalledOnce()
    expect(fixture.shaderDispose).toHaveBeenCalledOnce()
    expect(fixture.atlasDispose).toHaveBeenCalledOnce()
    expect(fixture.textureDispose).toHaveBeenCalledOnce()
    expect(fixture.imageDispose).toHaveBeenCalledOnce()
  })

  it('normalizes skeleton parse failure and cleans partial resources', async () => {
    const fixture = createOfficialRuntimeFixture({ skeletonFails: true })
    const adapter = new OfficialGarupaSpine40RuntimeAdapter({
      imageLoader: fixture.imageLoader,
      runtimeLoader: { load: fixture.load } as Pick<Spine40RuntimeLoader, 'load'>,
    })

    await expect(
      adapter.createSession({
        atlasBundle: {
          atlasPages: new Map([
            ['costume/page.png', new Blob(['synthetic-page'])],
          ]),
          atlasPath: 'costume/model.atlas',
          atlasText: 'page.png\nsize: 2,2\n',
          sourceName: 'synthetic.zip',
        },
        gl: createGl(),
        skeletonData: new Uint8Array([4, 0, 64]).buffer,
        textureUpload: {
          preserveRgb: true,
          unpackPremultiplyAlpha: false,
        },
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GarupaRenderingError>>({
        code: 'GARUPA_SKELETON_PARSE_FAILED',
      }),
    )
    expect(fixture.atlasDispose).toHaveBeenCalledOnce()
    expect(fixture.textureDispose).toHaveBeenCalledOnce()
    expect(fixture.imageDispose).toHaveBeenCalledOnce()
  })
})
