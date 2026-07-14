import { appendSkeletonTerminator } from '../adapter/skeletonPadding'
import { prepareLiveSD2DWebGLState } from '../rendering/prepareLiveSD2DWebGLState'
import {
  liveSD36RuntimeLoader,
  type LiveSD36RuntimeLoader,
  type Spine36Runtime,
} from './runtimeLoader'
import { readSpineRuntimeSkeletonHeader } from './skeletonRuntimeHeader'
import {
  assertRuntimeProjection,
  normalizeRuntimeBounds,
  safelyDispose,
} from './runtimeFacadeHelpers'
import {
  normalizeSpineRuntimeProfileError,
  SpineRuntimeProfileError,
} from './versionedRuntimeError'
import type {
  SpineRuntimeAnimation,
  SpineRuntimeBounds,
  SpineRuntimeDrawOrderEntry,
  SpineRuntimeProfileAdapter,
  SpineRuntimeProjection,
  SpineRuntimeSession,
  SpineRuntimeSessionInput,
} from './versionedRuntimeTypes'

export const SPINE_36_ADAPTER_IDENTITY =
  'spine-3.6:estertion@8d79291441394b3a279d5d36f054d563dbc15e16'

function isCompleteSpine36Runtime(runtime: Spine36Runtime): boolean {
  return Boolean(
    runtime.AnimationState &&
      runtime.AnimationStateData &&
      runtime.AtlasAttachmentLoader &&
      runtime.Skeleton &&
      runtime.SkeletonBinary &&
      runtime.TextureAtlas &&
      runtime.Vector2 &&
      runtime.MixDirection &&
      runtime.MixPose &&
      runtime.webgl?.GLTexture &&
      runtime.webgl.ManagedWebGLRenderingContext &&
      runtime.webgl.Matrix4 &&
      runtime.webgl.PolygonBatcher &&
      runtime.webgl.Shader &&
      runtime.webgl.SkeletonRenderer,
  )
}

class Spine36RuntimeSession implements SpineRuntimeSession {
  readonly adapterIdentity = SPINE_36_ADAPTER_IDENTITY
  readonly animations: readonly SpineRuntimeAnimation[]
  readonly premultipliedAlpha = true
  readonly runtimeKey = 'spine-3.6' as const
  readonly skeletonVersion: string

  readonly #animationByName: ReadonlyMap<string, spine.Animation>
  readonly #animationState: spine.AnimationState
  readonly #atlas: spine.TextureAtlas
  readonly #batcher: spine.webgl.PolygonBatcher
  readonly #gl: WebGLRenderingContext
  readonly #matrix: spine.webgl.Matrix4
  readonly #renderer: spine.webgl.SkeletonRenderer
  readonly #runtime: Spine36Runtime
  readonly #shader: spine.webgl.Shader
  readonly #skeleton: spine.Skeleton
  #currentAnimation: string
  #disposed = false

  constructor(options: {
    readonly animationState: spine.AnimationState
    readonly atlas: spine.TextureAtlas
    readonly batcher: spine.webgl.PolygonBatcher
    readonly gl: WebGLRenderingContext
    readonly matrix: spine.webgl.Matrix4
    readonly renderer: spine.webgl.SkeletonRenderer
    readonly runtime: Spine36Runtime
    readonly shader: spine.webgl.Shader
    readonly skeleton: spine.Skeleton
    readonly skeletonData: spine.SkeletonData
  }) {
    this.#animationState = options.animationState
    this.#atlas = options.atlas
    this.#batcher = options.batcher
    this.#gl = options.gl
    this.#matrix = options.matrix
    this.#renderer = options.renderer
    this.#runtime = options.runtime
    this.#shader = options.shader
    this.#skeleton = options.skeleton
    this.skeletonVersion = options.skeletonData.version
    this.animations = Object.freeze(
      options.skeletonData.animations.map(({ duration, name }) =>
        Object.freeze({ duration, name }),
      ),
    )
    this.#animationByName = new Map(
      options.skeletonData.animations.map((animation) => [animation.name, animation]),
    )
    this.#currentAnimation = this.animations[0]?.name ?? ''
  }

  get currentAnimation(): string {
    return this.#currentAnimation
  }

  play(name: string, loop = true): void {
    this.#assertUsable()
    this.#requireAnimation(name)
    this.#skeleton.setToSetupPose()
    this.#animationState.setAnimation(0, name, loop)
    this.#currentAnimation = name
    this.update(0)
  }

  update(delta: number): void {
    this.#assertUsable()
    if (!Number.isFinite(delta) || delta < 0) {
      throw new RangeError('Spine runtime delta must be finite and non-negative.')
    }
    this.#animationState.update(delta)
    this.#animationState.apply(this.#skeleton)
    this.#skeleton.updateWorldTransform()
  }

  applyAnimationAt(name: string, time: number, loop = true): void {
    this.#assertUsable()
    if (!Number.isFinite(time) || time < 0) {
      throw new RangeError('Spine animation time must be finite and non-negative.')
    }
    const animation = this.#requireAnimation(name)
    this.#skeleton.setToSetupPose()
    this.#skeleton.time = time
    animation.apply(
      this.#skeleton,
      0,
      time,
      loop,
      [],
      1,
      this.#runtime.MixPose.setup,
      this.#runtime.MixDirection.in,
    )
    this.#skeleton.updateWorldTransform()
    this.#currentAnimation = name
  }

  getBounds(): SpineRuntimeBounds {
    this.#assertUsable()
    const offset = new this.#runtime.Vector2()
    const size = new this.#runtime.Vector2()
    this.#skeleton.getBounds(offset, size, [])
    return normalizeRuntimeBounds(offset, size, this.runtimeKey)
  }

  getDrawOrder(): readonly SpineRuntimeDrawOrderEntry[] {
    this.#assertUsable()
    return Object.freeze(
      this.#skeleton.drawOrder.map((slot) =>
        Object.freeze({
          attachmentName: slot.getAttachment()?.name ?? null,
          boneName: slot.bone.data.name,
          slotName: slot.data.name,
        }),
      ),
    )
  }

  draw(projection: SpineRuntimeProjection): void {
    this.#assertUsable()
    assertRuntimeProjection(projection, this.runtimeKey)
    this.#matrix.ortho2d(
      projection.x,
      projection.y,
      projection.width,
      projection.height,
    )
    prepareLiveSD2DWebGLState(this.#gl)
    this.#gl.clearColor(0, 0, 0, 0)
    this.#gl.clear(this.#gl.COLOR_BUFFER_BIT)
    this.#shader.bind()
    try {
      this.#shader.setUniformi('u_texture', 0)
      this.#shader.setUniform4x4f('u_projTrans', this.#matrix.values)
      this.#batcher.begin(this.#shader)
      try {
        this.#renderer.premultipliedAlpha = this.premultipliedAlpha
        this.#renderer.draw(this.#batcher, this.#skeleton)
      } finally {
        this.#batcher.end()
      }
    } finally {
      this.#shader.unbind()
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    safelyDispose(() => this.#animationState.clearTracks())
    safelyDispose(() => this.#batcher.dispose())
    safelyDispose(() => this.#shader.dispose())
    safelyDispose(() => this.#atlas.dispose())
  }

  #requireAnimation(name: string): spine.Animation {
    const animation = this.#animationByName.get(name)
    if (!animation) {
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_PARSE_FAILED',
        `Spine skeleton에 animation이 없습니다: ${name}`,
        { actualVersion: this.skeletonVersion, runtimeKey: this.runtimeKey },
      )
    }
    return animation
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_PARSE_FAILED',
        '이미 dispose한 Spine 3.6 runtime session입니다.',
        { actualVersion: this.skeletonVersion, runtimeKey: this.runtimeKey },
      )
    }
  }
}

export interface Spine36RuntimeProfileAdapterOptions {
  readonly runtimeLoader?: Pick<LiveSD36RuntimeLoader, 'load'>
}

export class Spine36RuntimeProfileAdapter implements SpineRuntimeProfileAdapter {
  readonly adapterIdentity = SPINE_36_ADAPTER_IDENTITY
  readonly runtimeKey = 'spine-3.6' as const
  readonly #runtimeLoader: Pick<LiveSD36RuntimeLoader, 'load'>

  constructor(options: Spine36RuntimeProfileAdapterOptions = {}) {
    this.#runtimeLoader = options.runtimeLoader ?? liveSD36RuntimeLoader
  }

  async load(): Promise<void> {
    await this.#loadRuntime()
  }

  async createSession(
    input: SpineRuntimeSessionInput,
  ): Promise<SpineRuntimeSession> {
    const header = readSpineRuntimeSkeletonHeader(input.skeletonData)
    if (header.runtimeKey !== this.runtimeKey) {
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_MISMATCH',
        `Spine 3.6 adapter에 ${header.version} skeleton을 전달할 수 없습니다.`,
        {
          actualVersion: header.version,
          requestedRuntimeKey: this.runtimeKey,
          runtimeKey: header.runtimeKey,
        },
      )
    }
    const runtime = await this.#loadRuntime()
    const textures: spine.webgl.GLTexture[] = []
    let atlas: spine.TextureAtlas | null = null
    let batcher: spine.webgl.PolygonBatcher | null = null
    let shader: spine.webgl.Shader | null = null

    try {
      input.gl.pixelStorei(input.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      const managed = new runtime.webgl.ManagedWebGLRenderingContext(input.gl)
      atlas = new runtime.TextureAtlas(input.atlasText, (pageName) => {
        const texture = new runtime.webgl.GLTexture(
          managed,
          input.resolveAtlasPage(pageName) as HTMLImageElement,
        )
        textures.push(texture)
        return texture
      })
      const skeletonData = new runtime.SkeletonBinary(
        new runtime.AtlasAttachmentLoader(atlas),
      ).readSkeletonData(appendSkeletonTerminator(input.skeletonData))
      if (skeletonData.animations.length === 0) {
        throw new Error('Spine skeleton does not contain animations.')
      }
      const skeleton = new runtime.Skeleton(skeletonData)
      const animationState = new runtime.AnimationState(
        new runtime.AnimationStateData(skeletonData),
      )
      const defaultAnimation =
        skeletonData.animations.find(({ name }) => name === 'pose_default')?.name ??
        skeletonData.animations[0]?.name
      if (!defaultAnimation) throw new Error('Default animation is unavailable.')
      const matrix = new runtime.webgl.Matrix4()
      shader = runtime.webgl.Shader.newTwoColoredTextured(managed)
      batcher = new runtime.webgl.PolygonBatcher(managed, true)
      const renderer = new runtime.webgl.SkeletonRenderer(managed, true)
      const session = new Spine36RuntimeSession({
        animationState,
        atlas,
        batcher,
        gl: input.gl,
        matrix,
        renderer,
        runtime,
        shader,
        skeleton,
        skeletonData,
      })
      session.play(defaultAnimation)
      return session
    } catch (error) {
      safelyDispose(() => batcher?.dispose())
      safelyDispose(() => shader?.dispose())
      if (atlas) {
        safelyDispose(() => atlas?.dispose())
      } else {
        for (const texture of textures) safelyDispose(() => texture.dispose())
      }
      throw normalizeSpineRuntimeProfileError(
        error,
        'RUNTIME_PROFILE_PARSE_FAILED',
        'Spine 3.6 runtime session을 만들지 못했습니다.',
        {
          actualVersion: header.version,
          requestedRuntimeKey: this.runtimeKey,
          runtimeKey: this.runtimeKey,
        },
      )
    }
  }

  async #loadRuntime(): Promise<Spine36Runtime> {
    let runtime: Spine36Runtime
    try {
      runtime = await this.#runtimeLoader.load()
    } catch (error) {
      throw normalizeSpineRuntimeProfileError(
        error,
        'RUNTIME_PROFILE_LOAD_FAILED',
        'Spine 3.6 runtime을 불러오지 못했습니다.',
        { runtimeKey: this.runtimeKey },
      )
    }
    if (!isCompleteSpine36Runtime(runtime)) {
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_API_INVALID',
        'Spine 3.6 runtime이 facade에 필요한 API를 제공하지 않습니다.',
        { runtimeKey: this.runtimeKey },
      )
    }
    return runtime
  }
}
