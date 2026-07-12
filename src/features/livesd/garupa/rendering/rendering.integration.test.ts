import { describe, expect, it, vi } from 'vitest'

import type { CodexPetAnimationMappings } from '../../../codex-pet/animationMapping'
import {
  CODEX_PET_ATLAS_HEIGHT,
  CODEX_PET_ATLAS_WIDTH,
  CODEX_PET_LOOK_FRAME_COUNT,
  CODEX_PET_STATES,
  CODEX_PET_TOTAL_FRAME_COUNT,
} from '../../../codex-pet/contract'
import type { LiveSDFrameSamplingProgress } from '../../export/types'
import type { LiveSDAtlasBundle } from '../../model'
import { GarupaRenderingError } from './errors'
import { GarupaSpine40FrameSampler } from './frameSampler'
import { GarupaSpine40PreviewFactory } from './preview'
import type {
  GarupaAnimationFrameScheduler,
  GarupaFrameSamplerCanvasFactory,
  GarupaRuntimeBone,
  GarupaRuntimeDrawOptions,
  GarupaRuntimeSlot,
  GarupaSpine40RuntimeAdapter,
  GarupaSpine40RuntimeCreateInput,
  GarupaSpine40RuntimeSession,
} from './types'

function createMappings(animationName = 'Idle'): CodexPetAnimationMappings {
  return Object.fromEntries(
    CODEX_PET_STATES.map((state) => [
      state.id,
      {
        animationName,
        mirrorX: state.id === 'running-left',
      },
    ]),
  ) as unknown as CodexPetAnimationMappings
}

function createBundle(): LiveSDAtlasBundle {
  return {
    atlasPages: new Map([['costume/page.png', new Blob(['synthetic'])]]),
    atlasPath: 'costume/model.atlas',
    atlasText: 'page.png\nsize: 2,2\npma: false\n',
    sourceName: 'synthetic-garupa.zip',
  }
}

interface GlFixture {
  readonly gl: WebGLRenderingContext
  readonly loseContext: ReturnType<typeof vi.fn>
  readonly readPixels: ReturnType<typeof vi.fn>
}

function createGlFixture(visible = true): GlFixture {
  const loseContext = vi.fn()
  const readPixels = vi.fn(
    (
      _x: number,
      _y: number,
      width: number,
      height: number,
      _format: number,
      _type: number,
      pixels: Uint8Array,
    ) => {
      if (!visible) return
      const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4
      pixels.set([128, 64, 32, 128], center)
      pixels.set([255, 128, 64, 255], center + 4)
    },
  )
  const gl = {
    BLEND: 1,
    COLOR_BUFFER_BIT: 2,
    CULL_FACE: 3,
    DEPTH_TEST: 4,
    NO_ERROR: 0,
    ONE_MINUS_SRC_ALPHA: 5,
    POLYGON_OFFSET_FILL: 6,
    RGBA: 7,
    SCISSOR_TEST: 8,
    SRC_ALPHA: 9,
    STENCIL_TEST: 10,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 11,
    UNSIGNED_BYTE: 12,
    blendFunc: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    depthMask: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    getError: vi.fn(() => 0),
    getExtension: vi.fn(() => ({ loseContext })),
    pixelStorei: vi.fn(),
    readPixels,
    viewport: vi.fn(),
  } as unknown as WebGLRenderingContext
  return { gl, loseContext, readPixels }
}

interface RuntimeFixture {
  readonly adapter: GarupaSpine40RuntimeAdapter
  readonly applyAnimation: ReturnType<typeof vi.fn>
  readonly createSession: ReturnType<typeof vi.fn>
  readonly dispose: ReturnType<typeof vi.fn>
  readonly draw: ReturnType<typeof vi.fn>
  readonly eyeOffsets: readonly {
    readonly leftX: number
    readonly rightX: number
  }[]
  readonly session: GarupaSpine40RuntimeSession
  readonly setProjection: ReturnType<typeof vi.fn>
}

function createRuntimeFixture(options: {
  readonly animations?: readonly {
    readonly duration: number
    readonly name: string
  }[]
  readonly validLookRig?: boolean
} = {}): RuntimeFixture {
  const leftParent: GarupaRuntimeBone = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    name: 'left-parent',
    parent: null,
    x: 0,
    y: 0,
  }
  const rightParent: GarupaRuntimeBone = {
    ...leftParent,
    name: 'right-parent',
  }
  const left: GarupaRuntimeBone = {
    ...leftParent,
    name: 'F_eyeL',
    parent: leftParent,
  }
  const right: GarupaRuntimeBone = {
    ...rightParent,
    name: 'F_eyeR',
    parent: rightParent,
  }
  const slots: readonly GarupaRuntimeSlot[] = options.validLookRig === false
    ? [
        {
          alpha: 1,
          attachment: {
            alpha: 1,
            height: 24,
            name: 'left_eyebrow',
            width: 24,
          },
          bone: left,
          name: 'left-eyebrow',
        },
      ]
    : [
        {
          alpha: 1,
          attachment: { alpha: 1, height: 24, name: 'left_eye', width: 24 },
          bone: left,
          name: 'left-eye',
        },
        {
          alpha: 1,
          attachment: { alpha: 1, height: 24, name: 'right_eye', width: 24 },
          bone: right,
          name: 'right-eye',
        },
      ]
  const applyAnimation = vi.fn(() => {
    left.x = 0
    left.y = 0
    right.x = 0
    right.y = 0
  })
  const dispose = vi.fn()
  const draw = vi.fn((options: GarupaRuntimeDrawOptions) => {
    void options
  })
  const setProjection = vi.fn()
  const eyeOffsets: { leftX: number; rightX: number }[] = []
  const updateWorldTransform = vi.fn(() => {
    eyeOffsets.push({ leftX: left.x, rightX: right.x })
  })
  const session = {
    adapterIdentity: 'mock-spine-4.0',
    animations: options.animations ?? [
      { duration: 2, name: 'Walk' },
      { duration: 1, name: 'Idle' },
    ],
    applyAnimation,
    dispose,
    draw,
    findBone: (name: string) =>
      name === left.name ? left : name === right.name ? right : null,
    getBounds: () => ({ maxX: 10, maxY: 20, minX: -10, minY: -20 }),
    runtimeKey: 'spine-4.0',
    setProjection,
    slots,
    updateWorldTransform,
    version: '4.0.64',
  } satisfies GarupaSpine40RuntimeSession
  const createSession = vi.fn(
    async (input: GarupaSpine40RuntimeCreateInput) => {
      void input
      return session
    },
  )
  const adapter = {
    adapterIdentity: 'mock-spine-4.0',
    createSession,
    runtimeKey: 'spine-4.0',
  } satisfies GarupaSpine40RuntimeAdapter
  return {
    adapter,
    applyAnimation,
    createSession,
    dispose,
    draw,
    eyeOffsets,
    session,
    setProjection,
  }
}

interface Context2dFixture {
  readonly clearRect: ReturnType<typeof vi.fn>
  readonly context: CanvasRenderingContext2D
  readonly drawImage: ReturnType<typeof vi.fn>
  readonly scale: ReturnType<typeof vi.fn>
}

function create2dFixture(): Context2dFixture {
  const clearRect = vi.fn()
  const drawImage = vi.fn()
  const scale = vi.fn()
  const context = {
    clearRect,
    createImageData: vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    })),
    drawImage,
    putImageData: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    scale,
    translate: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  return { clearRect, context, drawImage, scale }
}

describe('Garupa preview session', () => {
  it('becomes ready only after canonical calibration and a visible Idle frame', async () => {
    const runtime = createRuntimeFixture()
    const gl = createGlFixture()
    const canvas = {
      getContext: vi.fn(() => gl.gl),
      height: 0,
      width: 0,
    } as unknown as HTMLCanvasElement
    const cancel = vi.fn()
    const request = vi.fn(() => 17)
    const scheduler: GarupaAnimationFrameScheduler = { cancel, request }
    const factory = new GarupaSpine40PreviewFactory({
      runtimeAdapter: runtime.adapter,
      scheduler,
      yieldControl: () => Promise.resolve(),
    })

    const session = await factory.createPreview({
      atlasBundle: createBundle(),
      canvas,
      compatibility: 'verified',
      mappings: createMappings(),
      skeletonData: new Uint8Array([4, 0, 64]).buffer,
      version: '4.0.64',
    })

    expect(session.animations).toEqual(['Walk', 'Idle'])
    expect(session.currentAnimation).toBe('Idle')
    expect(session.lookRigSupported).toBe(true)
    expect(session.adapterIdentity).toBe('mock-spine-4.0')
    expect(runtime.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        textureUpload: {
          preserveRgb: true,
          unpackPremultiplyAlpha: false,
        },
      }),
    )
    expect(runtime.draw).toHaveBeenCalledTimes(58)
    expect(runtime.draw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layerOrder: 'runtime-draw-order',
        premultipliedAlpha: false,
      }),
    )
    expect(gl.readPixels).toHaveBeenCalledTimes(58)
    expect(request).toHaveBeenCalledTimes(1)

    session.setLookTarget({ x: 1, y: 0 })
    expect(runtime.eyeOffsets.some(({ leftX, rightX }) =>
      leftX > 0 && rightX > 0,
    )).toBe(true)
    session.dispose()
    session.dispose()
    expect(cancel).toHaveBeenCalledOnce()
    expect(runtime.dispose).toHaveBeenCalledOnce()
    expect(gl.loseContext).toHaveBeenCalledOnce()
    expect({ height: canvas.height, width: canvas.width }).toEqual({
      height: 1,
      width: 1,
    })
  })

  it('does not expose a session when the first calibration frame is invisible', async () => {
    const runtime = createRuntimeFixture()
    const gl = createGlFixture(false)
    const canvas = {
      getContext: vi.fn(() => gl.gl),
      height: 0,
      width: 0,
    } as unknown as HTMLCanvasElement
    const factory = new GarupaSpine40PreviewFactory({
      runtimeAdapter: runtime.adapter,
      scheduler: { cancel: vi.fn(), request: vi.fn(() => 1) },
      yieldControl: () => Promise.resolve(),
    })

    await expect(
      factory.createPreview({
        atlasBundle: createBundle(),
        canvas,
        compatibility: 'verified',
        mappings: createMappings(),
        skeletonData: new Uint8Array([4, 0, 64]).buffer,
        version: '4.0.64',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GarupaRenderingError>>({
        code: 'GARUPA_PREVIEW_RENDER_FAILED',
      }),
    )
    expect(runtime.dispose).toHaveBeenCalledOnce()
    expect(gl.loseContext).toHaveBeenCalledOnce()
  })

  it('uses the first parsed animation when exact Idle is absent', async () => {
    const runtime = createRuntimeFixture({
      animations: [{ duration: 1.25, name: 'Dance' }],
    })
    const gl = createGlFixture()
    const canvas = {
      getContext: vi.fn(() => gl.gl),
      height: 0,
      width: 0,
    } as unknown as HTMLCanvasElement
    const factory = new GarupaSpine40PreviewFactory({
      runtimeAdapter: runtime.adapter,
      scheduler: { cancel: vi.fn(), request: vi.fn(() => 1) },
      yieldControl: () => Promise.resolve(),
    })

    const session = await factory.createPreview({
      atlasBundle: createBundle(),
      canvas,
      compatibility: 'experimental',
      mappings: createMappings('Dance'),
      skeletonData: new Uint8Array([4, 0, 65]).buffer,
      version: '4.0.64',
    })
    expect(session.animations).toEqual(['Dance'])
    expect(session.currentAnimation).toBe('Dance')
    session.dispose()
  })

  it('keeps ordinary preview ready while an invalid eye rig stays preview-only', async () => {
    const runtime = createRuntimeFixture({ validLookRig: false })
    const gl = createGlFixture()
    const canvas = {
      getContext: vi.fn(() => gl.gl),
      height: 0,
      width: 0,
    } as unknown as HTMLCanvasElement
    const factory = new GarupaSpine40PreviewFactory({
      runtimeAdapter: runtime.adapter,
      scheduler: { cancel: vi.fn(), request: vi.fn(() => 1) },
      yieldControl: () => Promise.resolve(),
    })

    const session = await factory.createPreview({
      atlasBundle: createBundle(),
      canvas,
      compatibility: 'verified',
      mappings: createMappings(),
      skeletonData: new Uint8Array([4, 0, 64]).buffer,
      version: '4.0.64',
    })
    expect(session.lookRigSupported).toBe(false)
    expect(() => session.setLookTarget({ x: 1, y: 0 })).toThrowError(
      expect.objectContaining<Partial<GarupaRenderingError>>({
        code: 'GARUPA_LOOK_RIG_UNSUPPORTED',
      }),
    )
    session.play('Idle')
    session.dispose()
  })
})

describe('Garupa 73-frame sampler', () => {
  it('shares canonical projection, preserves mirror cells, progress and lifetime', async () => {
    const runtime = createRuntimeFixture()
    const gl = createGlFixture()
    const atlas2d = create2dFixture()
    const cell2d = create2dFixture()
    const canvases: HTMLCanvasElement[] = []
    const canvasFactory: GarupaFrameSamplerCanvasFactory = (
      kind,
      width,
      height,
    ) => {
      const canvas = {
        getContext: vi.fn((context: string) =>
          context === 'webgl'
            ? gl.gl
            : kind === 'atlas-2d'
              ? atlas2d.context
              : cell2d.context,
        ),
        height,
        width,
      } as unknown as HTMLCanvasElement
      canvases.push(canvas)
      return canvas
    }
    const progress: LiveSDFrameSamplingProgress[] = []
    const pngEncoder = vi.fn(async () => new Blob(['synthetic-png']))
    const yieldControl = vi.fn(async () => {})
    const sampler = new GarupaSpine40FrameSampler({
      canvasFactory,
      pngEncoder,
      runtimeAdapter: runtime.adapter,
      yieldControl,
    })

    const result = await sampler.sample({
      atlasBundle: createBundle(),
      expectedAdapterIdentity: 'mock-spine-4.0',
      mappings: createMappings(),
      onProgress: (event) => progress.push(event),
      skeletonData: new Uint8Array([4, 0, 64]).buffer,
    })

    expect(result).toEqual({
      adapterIdentity: 'mock-spine-4.0',
      atlasPng: expect.any(Blob),
      frameCount: CODEX_PET_TOTAL_FRAME_COUNT,
      height: CODEX_PET_ATLAS_HEIGHT,
      runtimeKey: 'spine-4.0',
      width: CODEX_PET_ATLAS_WIDTH,
    })
    expect(runtime.applyAnimation).toHaveBeenCalledTimes(188)
    expect(runtime.draw).toHaveBeenCalledTimes(130)
    expect(gl.readPixels).toHaveBeenCalledTimes(130)
    expect(atlas2d.drawImage).toHaveBeenCalledTimes(CODEX_PET_TOTAL_FRAME_COUNT)
    expect(atlas2d.scale).toHaveBeenCalledTimes(8)
    expect(yieldControl).toHaveBeenCalledTimes(187)
    expect(progress.at(-1)).toEqual({
      completedSteps: 188,
      fraction: 1,
      phase: 'complete',
      totalSteps: 188,
    })
    expect(
      progress.filter((event) => event.lookDirectionIndex !== undefined),
    ).toHaveLength(CODEX_PET_LOOK_FRAME_COUNT)
    expect(
      runtime.eyeOffsets.filter(
        ({ leftX, rightX }) =>
          Math.abs(leftX) > 1e-6 && Math.abs(rightX) > 1e-6,
      ),
    ).toHaveLength(14)
    expect(pngEncoder).toHaveBeenCalledOnce()
    expect(runtime.dispose).toHaveBeenCalledOnce()
    expect(gl.loseContext).toHaveBeenCalledOnce()
    expect(canvases.every((canvas) => canvas.width === 1 && canvas.height === 1))
      .toBe(true)
  })

  it('stops after abort and disposes the partial runtime session once', async () => {
    const runtime = createRuntimeFixture()
    const gl = createGlFixture()
    const atlas2d = create2dFixture()
    const cell2d = create2dFixture()
    const controller = new AbortController()
    const canvasFactory: GarupaFrameSamplerCanvasFactory = (kind, width, height) => ({
      getContext: vi.fn((context: string) =>
        context === 'webgl'
          ? gl.gl
          : kind === 'atlas-2d'
            ? atlas2d.context
            : cell2d.context,
      ),
      height,
      width,
    }) as unknown as HTMLCanvasElement
    const pngEncoder = vi.fn(async () => new Blob(['must-not-run']))
    const sampler = new GarupaSpine40FrameSampler({
      canvasFactory,
      pngEncoder,
      runtimeAdapter: runtime.adapter,
      yieldControl: async () => controller.abort('test cancellation'),
    })

    await expect(
      sampler.sample({
        atlasBundle: createBundle(),
        mappings: createMappings(),
        signal: controller.signal,
        skeletonData: new Uint8Array([4, 0, 64]).buffer,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GarupaRenderingError>>({
        code: 'GARUPA_RENDERING_FAILED',
        context: { stage: 'aborted' },
      }),
    )
    expect(runtime.dispose).toHaveBeenCalledOnce()
    expect(pngEncoder).not.toHaveBeenCalled()
  })
})
