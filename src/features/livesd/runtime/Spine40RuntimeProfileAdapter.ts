import type * as Spine40 from '@esotericsoftware/spine-webgl'

import { prepareLiveSD2DWebGLState } from '../rendering/prepareLiveSD2DWebGLState'
import {
  spine40RuntimeLoader,
  type Spine40Runtime,
  type Spine40RuntimeLoader,
} from './Spine40RuntimeLoader'
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

export const SPINE_40_ADAPTER_IDENTITY =
  'spine-4.0:@esotericsoftware/spine-webgl@4.0.31'

class Spine40RuntimeSession implements SpineRuntimeSession {
  readonly adapterIdentity = SPINE_40_ADAPTER_IDENTITY
  readonly animations: readonly SpineRuntimeAnimation[]
  readonly premultipliedAlpha = false
  readonly runtimeKey = 'spine-4.0' as const
  readonly skeletonVersion: string

  readonly #animationByName: ReadonlyMap<string, Spine40.Animation>
  readonly #animationState: Spine40.AnimationState
  readonly #atlas: Spine40.TextureAtlas
  readonly #batcher: Spine40.PolygonBatcher
  readonly #gl: WebGLRenderingContext
  readonly #matrix: Spine40.Matrix4
  readonly #renderer: Spine40.SkeletonRenderer
  readonly #runtime: Spine40Runtime
  readonly #shader: Spine40.Shader
  readonly #skeleton: Spine40.Skeleton
  #currentAnimation: string
  #disposed = false

  constructor(options: {
    readonly animationState: Spine40.AnimationState
    readonly atlas: Spine40.TextureAtlas
    readonly batcher: Spine40.PolygonBatcher
    readonly gl: WebGLRenderingContext
    readonly matrix: Spine40.Matrix4
    readonly renderer: Spine40.SkeletonRenderer
    readonly runtime: Spine40Runtime
    readonly shader: Spine40.Shader
    readonly skeleton: Spine40.Skeleton
    readonly skeletonData: Spine40.SkeletonData
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
      this.#runtime.MixBlend.setup,
      this.#runtime.MixDirection.mixIn,
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
      this.#shader.setUniformi(this.#runtime.Shader.SAMPLER, 0)
      this.#shader.setUniform4x4f(
        this.#runtime.Shader.MVP_MATRIX,
        this.#matrix.values,
      )
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

  #requireAnimation(name: string): Spine40.Animation {
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
        '이미 dispose한 Spine 4.0 runtime session입니다.',
        { actualVersion: this.skeletonVersion, runtimeKey: this.runtimeKey },
      )
    }
  }
}

export interface Spine40RuntimeProfileAdapterOptions {
  readonly runtimeLoader?: Pick<Spine40RuntimeLoader, 'load'>
}

export class Spine40RuntimeProfileAdapter implements SpineRuntimeProfileAdapter {
  readonly adapterIdentity = SPINE_40_ADAPTER_IDENTITY
  readonly runtimeKey = 'spine-4.0' as const
  readonly #runtimeLoader: Pick<Spine40RuntimeLoader, 'load'>

  constructor(options: Spine40RuntimeProfileAdapterOptions = {}) {
    this.#runtimeLoader = options.runtimeLoader ?? spine40RuntimeLoader
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
        `Spine 4.0 adapter에 ${header.version} skeleton을 전달할 수 없습니다.`,
        {
          actualVersion: header.version,
          requestedRuntimeKey: this.runtimeKey,
          runtimeKey: header.runtimeKey,
        },
      )
    }
    const runtime = await this.#loadRuntime()
    const textures: Spine40.GLTexture[] = []
    let atlas: Spine40.TextureAtlas | null = null
    let batcher: Spine40.PolygonBatcher | null = null
    let shader: Spine40.Shader | null = null

    try {
      input.gl.pixelStorei(input.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      const managed = new runtime.ManagedWebGLRenderingContext(input.gl)
      atlas = new runtime.TextureAtlas(input.atlasText)
      for (const page of atlas.pages) {
        const texture = new runtime.GLTexture(
          managed,
          input.resolveAtlasPage(page.name),
        )
        textures.push(texture)
        page.setTexture(texture)
      }
      const sourceBytes = new Uint8Array(input.skeletonData)
      const skeletonData = new runtime.SkeletonBinary(
        new runtime.AtlasAttachmentLoader(atlas),
      ).readSkeletonData(sourceBytes)
      if (skeletonData.animations.length === 0) {
        throw new Error('Spine skeleton does not contain animations.')
      }
      const skeleton = new runtime.Skeleton(skeletonData)
      const animationState = new runtime.AnimationState(
        new runtime.AnimationStateData(skeletonData),
      )
      const defaultAnimation =
        skeletonData.animations.find(({ name }) => name === 'Idle')?.name ??
        skeletonData.animations[0]?.name
      if (!defaultAnimation) throw new Error('Default animation is unavailable.')
      const matrix = new runtime.Matrix4()
      shader = runtime.Shader.newTwoColoredTextured(managed)
      batcher = new runtime.PolygonBatcher(managed, true)
      const renderer = new runtime.SkeletonRenderer(managed, true)
      const session = new Spine40RuntimeSession({
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
        'Spine 4.0 runtime session을 만들지 못했습니다.',
        {
          actualVersion: header.version,
          requestedRuntimeKey: this.runtimeKey,
          runtimeKey: this.runtimeKey,
        },
      )
    }
  }

  async #loadRuntime(): Promise<Spine40Runtime> {
    try {
      return await this.#runtimeLoader.load()
    } catch (error) {
      throw normalizeSpineRuntimeProfileError(
        error,
        'RUNTIME_PROFILE_LOAD_FAILED',
        'Spine 4.0 runtime을 불러오지 못했습니다.',
        { runtimeKey: this.runtimeKey },
      )
    }
  }
}
