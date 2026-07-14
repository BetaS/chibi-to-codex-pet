import {
  loadAtlasImage,
  type AtlasImageLoader,
  type LoadedAtlasImage,
} from '../../adapter/atlasImageLoader'
import { resolveAtlasPagePath } from '../../model'
import {
  spine40RuntimeLoader,
  type Spine40Runtime,
  type Spine40RuntimeLoader,
} from '../../runtime/Spine40RuntimeLoader'
import { SPINE_40_ADAPTER_IDENTITY } from '../../runtime/Spine40RuntimeProfileAdapter'
import {
  GarupaRenderingError,
  isGarupaRenderingError,
  throwIfGarupaSamplingAborted,
} from './errors'
import type {
  GarupaRuntimeAttachment,
  GarupaRuntimeBone,
  GarupaRuntimeDrawOptions,
  GarupaRuntimeSlot,
  GarupaSpine40RuntimeAdapter,
  GarupaSpine40RuntimeCreateInput,
  GarupaSpine40RuntimeSession,
} from './types'

type Spine40Animation = InstanceType<Spine40Runtime['Animation']>
type Spine40AnimationState = InstanceType<Spine40Runtime['AnimationState']>
type Spine40Attachment = InstanceType<Spine40Runtime['Attachment']>
type Spine40Bone = InstanceType<Spine40Runtime['Bone']>
type Spine40GlTexture = InstanceType<Spine40Runtime['GLTexture']>
type Spine40Matrix = InstanceType<Spine40Runtime['Matrix4']>
type Spine40PolygonBatcher = InstanceType<Spine40Runtime['PolygonBatcher']>
type Spine40Shader = InstanceType<Spine40Runtime['Shader']>
type Spine40Skeleton = InstanceType<Spine40Runtime['Skeleton']>
type Spine40SkeletonData = InstanceType<Spine40Runtime['SkeletonData']>
type Spine40SkeletonRenderer = InstanceType<
  Spine40Runtime['SkeletonRenderer']
>
type Spine40TextureAtlas = InstanceType<Spine40Runtime['TextureAtlas']>

interface SpineAttachmentShape {
  readonly color?: { readonly a?: number }
  readonly height?: number
  readonly name: string
  readonly region?: {
    readonly height?: number
    readonly originalHeight?: number
    readonly originalWidth?: number
    readonly width?: number
  }
  readonly width?: number
}

function safely(action: () => void): void {
  try {
    action()
  } catch {
    // Cleanup failures must not hide the original runtime failure.
  }
}

class RuntimeBoneView implements GarupaRuntimeBone {
  readonly #bone: Spine40Bone
  readonly parent: RuntimeBoneView | null

  constructor(bone: Spine40Bone, parent: RuntimeBoneView | null) {
    this.#bone = bone
    this.parent = parent
  }

  get name(): string {
    return this.#bone.data.name
  }

  get x(): number {
    return this.#bone.x
  }

  set x(value: number) {
    this.#bone.x = value
  }

  get y(): number {
    return this.#bone.y
  }

  set y(value: number) {
    this.#bone.y = value
  }

  get a(): number {
    return this.#bone.a
  }

  get b(): number {
    return this.#bone.b
  }

  get c(): number {
    return this.#bone.c
  }

  get d(): number {
    return this.#bone.d
  }
}

function normalizeAttachment(
  attachment: Spine40Attachment | null,
): GarupaRuntimeAttachment | null {
  if (!attachment) return null
  const shape = attachment as Spine40Attachment & SpineAttachmentShape
  return {
    alpha: shape.color?.a ?? 1,
    height:
      shape.region?.originalHeight ??
      shape.region?.height ??
      shape.height ??
      0,
    name: shape.name,
    width:
      shape.region?.originalWidth ??
      shape.region?.width ??
      shape.width ??
      0,
  }
}

class OfficialGarupaSpine40RuntimeSession
  implements GarupaSpine40RuntimeSession
{
  readonly adapterIdentity = SPINE_40_ADAPTER_IDENTITY
  readonly animations: readonly {
    readonly duration: number
    readonly name: string
  }[]
  readonly runtimeKey = 'spine-4.0' as const
  readonly version: string

  readonly #animationByName: ReadonlyMap<string, Spine40Animation>
  readonly #animationState: Spine40AnimationState
  readonly #atlas: Spine40TextureAtlas
  readonly #batcher: Spine40PolygonBatcher
  readonly #boneViewByBone = new Map<Spine40Bone, RuntimeBoneView>()
  readonly #images: readonly LoadedAtlasImage[]
  readonly #matrix: Spine40Matrix
  readonly #renderer: Spine40SkeletonRenderer
  readonly #runtime: Spine40Runtime
  readonly #shader: Spine40Shader
  readonly #skeleton: Spine40Skeleton
  #disposed = false
  #projection: {
    readonly height: number
    readonly width: number
    readonly x: number
    readonly y: number
  } | null = null

  constructor(input: {
    readonly animationState: Spine40AnimationState
    readonly atlas: Spine40TextureAtlas
    readonly batcher: Spine40PolygonBatcher
    readonly images: readonly LoadedAtlasImage[]
    readonly matrix: Spine40Matrix
    readonly renderer: Spine40SkeletonRenderer
    readonly runtime: Spine40Runtime
    readonly shader: Spine40Shader
    readonly skeleton: Spine40Skeleton
    readonly skeletonData: Spine40SkeletonData
  }) {
    this.#animationState = input.animationState
    this.#atlas = input.atlas
    this.#batcher = input.batcher
    this.#images = input.images
    this.#matrix = input.matrix
    this.#renderer = input.renderer
    this.#runtime = input.runtime
    this.#shader = input.shader
    this.#skeleton = input.skeleton
    this.version = input.skeletonData.version
    this.animations = Object.freeze(
      input.skeletonData.animations.map(({ duration, name }) =>
        Object.freeze({ duration, name }),
      ),
    )
    this.#animationByName = new Map(
      input.skeletonData.animations.map((animation) => [
        animation.name,
        animation,
      ]),
    )

    for (const bone of this.#skeleton.bones) {
      const parent = bone.parent
        ? (this.#boneViewByBone.get(bone.parent) ?? null)
        : null
      this.#boneViewByBone.set(bone, new RuntimeBoneView(bone, parent))
    }
  }

  get slots(): readonly GarupaRuntimeSlot[] {
    this.#assertUsable()
    return this.#skeleton.slots.map((slot) => ({
      alpha: slot.color.a,
      attachment: normalizeAttachment(slot.getAttachment()),
      bone: this.#requireBoneView(slot.bone),
      name: slot.data.name,
    }))
  }

  applyAnimation(
    input: Parameters<GarupaSpine40RuntimeSession['applyAnimation']>[0],
  ): void {
    this.#assertUsable()
    if (
      !Number.isFinite(input.time) ||
      input.time < 0 ||
      !Number.isFinite(input.duration) ||
      input.duration < 0 ||
      input.resetToSetupPose !== true
    ) {
      throw new RangeError('Garupa animation frame input is invalid.')
    }
    const animation = this.#animationByName.get(input.animationName)
    if (!animation) {
      throw new GarupaRenderingError(
        'GARUPA_ANIMATION_MISSING',
        'The requested Garupa animation is unavailable.',
        { animationName: input.animationName },
      )
    }

    this.#skeleton.setToSetupPose()
    this.#skeleton.time = input.time
    animation.apply(
      this.#skeleton,
      0,
      input.time,
      input.loop,
      [],
      1,
      this.#runtime.MixBlend.setup,
      this.#runtime.MixDirection.mixIn,
    )
  }

  updateWorldTransform(): void {
    this.#assertUsable()
    this.#skeleton.updateWorldTransform()
  }

  findBone(name: string): GarupaRuntimeBone | null {
    this.#assertUsable()
    const bone = this.#skeleton.findBone(name)
    return bone ? this.#requireBoneView(bone) : null
  }

  getBounds(): {
    readonly maxX: number
    readonly maxY: number
    readonly minX: number
    readonly minY: number
  } {
    this.#assertUsable()
    const offset = new this.#runtime.Vector2()
    const size = new this.#runtime.Vector2()
    this.#skeleton.getBounds(offset, size, [])
    const minX = Math.min(offset.x, offset.x + size.x)
    const minY = Math.min(offset.y, offset.y + size.y)
    const maxX = Math.max(offset.x, offset.x + size.x)
    const maxY = Math.max(offset.y, offset.y + size.y)
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
      throw new RangeError('Garupa skeleton bounds are not finite.')
    }
    return { maxX, maxY, minX, minY }
  }

  setProjection(
    projection: Parameters<GarupaSpine40RuntimeSession['setProjection']>[0],
  ): void {
    this.#assertUsable()
    if (
      ![
        projection.x,
        projection.y,
        projection.width,
        projection.height,
      ].every(Number.isFinite) ||
      projection.width <= 0 ||
      projection.height <= 0
    ) {
      throw new RangeError('Garupa projection must have finite positive size.')
    }
    this.#projection = { ...projection }
  }

  draw(options: GarupaRuntimeDrawOptions): void {
    this.#assertUsable()
    if (
      options.premultipliedAlpha !== false ||
      options.blend !== 'src-alpha-one-minus-src-alpha' ||
      options.layerOrder !== 'runtime-draw-order' ||
      !this.#projection
    ) {
      throw new RangeError('Garupa runtime draw options are invalid.')
    }
    const projection = this.#projection
    this.#matrix.ortho2d(
      options.mirrorX ? projection.x + projection.width : projection.x,
      projection.y,
      options.mirrorX ? -projection.width : projection.width,
      projection.height,
    )
    this.#shader.bind()
    try {
      this.#shader.setUniformi(this.#runtime.Shader.SAMPLER, 0)
      this.#shader.setUniform4x4f(
        this.#runtime.Shader.MVP_MATRIX,
        this.#matrix.values,
      )
      this.#batcher.begin(this.#shader)
      try {
        this.#renderer.premultipliedAlpha = false
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
    safely(() => this.#animationState.clearTracks())
    safely(() => this.#batcher.dispose())
    safely(() => this.#shader.dispose())
    safely(() => this.#atlas.dispose())
    for (const image of this.#images) safely(() => image.dispose())
    this.#boneViewByBone.clear()
    this.#projection = null
  }

  #requireBoneView(bone: Spine40Bone): RuntimeBoneView {
    const view = this.#boneViewByBone.get(bone)
    if (!view) throw new Error('Garupa runtime bone view is unavailable.')
    return view
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new GarupaRenderingError(
        'GARUPA_RENDERING_FAILED',
        'The Garupa runtime session has been disposed.',
        { stage: 'disposed' },
      )
    }
  }
}

export interface OfficialGarupaSpine40RuntimeAdapterOptions {
  readonly imageLoader?: AtlasImageLoader
  readonly runtimeLoader?: Pick<Spine40RuntimeLoader, 'load'>
}

export class OfficialGarupaSpine40RuntimeAdapter
  implements GarupaSpine40RuntimeAdapter
{
  readonly adapterIdentity = SPINE_40_ADAPTER_IDENTITY
  readonly runtimeKey = 'spine-4.0' as const
  readonly #imageLoader: AtlasImageLoader
  readonly #runtimeLoader: Pick<Spine40RuntimeLoader, 'load'>

  constructor(options: OfficialGarupaSpine40RuntimeAdapterOptions = {}) {
    this.#imageLoader = options.imageLoader ?? loadAtlasImage
    this.#runtimeLoader = options.runtimeLoader ?? spine40RuntimeLoader
  }

  async createSession(
    input: GarupaSpine40RuntimeCreateInput,
  ): Promise<GarupaSpine40RuntimeSession> {
    throwIfGarupaSamplingAborted(input.signal)
    const images = new Map<string, LoadedAtlasImage>()
    const textures: Spine40GlTexture[] = []
    let atlas: Spine40TextureAtlas | null = null
    let batcher: Spine40PolygonBatcher | null = null
    let shader: Spine40Shader | null = null

    try {
      try {
        for (const [path, blob] of input.atlasBundle.atlasPages) {
          images.set(path, await this.#imageLoader(blob, path))
          throwIfGarupaSamplingAborted(input.signal)
        }
      } catch (error) {
        if (isGarupaRenderingError(error)) throw error
        throw new GarupaRenderingError(
          'GARUPA_ATLAS_RUNTIME_PARSE_FAILED',
          'A Garupa atlas texture could not be decoded.',
          { stage: 'texture-decode' },
          { cause: error },
        )
      }

      const runtime = await this.#runtimeLoader.load()
      throwIfGarupaSamplingAborted(input.signal)
      input.gl.pixelStorei(input.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
      const managed = new runtime.ManagedWebGLRenderingContext(input.gl)

      try {
        atlas = new runtime.TextureAtlas(input.atlasBundle.atlasText)
        for (const page of atlas.pages) {
          const pagePath = resolveAtlasPagePath(
            input.atlasBundle.atlasPath,
            page.name,
          )
          const image = images.get(pagePath)
          if (!image) throw new Error('A decoded Garupa atlas page is missing.')
          const texture = new runtime.GLTexture(managed, image.image)
          textures.push(texture)
          page.setTexture(texture)
        }
      } catch (error) {
        throw new GarupaRenderingError(
          'GARUPA_ATLAS_RUNTIME_PARSE_FAILED',
          'The Spine 4.0 runtime could not parse the Garupa atlas.',
          { stage: 'atlas' },
          { cause: error },
        )
      }

      let skeletonData: Spine40SkeletonData
      try {
        skeletonData = new runtime.SkeletonBinary(
          new runtime.AtlasAttachmentLoader(atlas),
        ).readSkeletonData(new Uint8Array(input.skeletonData))
      } catch (error) {
        throw new GarupaRenderingError(
          'GARUPA_SKELETON_PARSE_FAILED',
          'The Spine 4.0 runtime could not parse the Garupa skeleton.',
          { stage: 'skeleton' },
          { cause: error },
        )
      }
      if (skeletonData.animations.length === 0) {
        throw new GarupaRenderingError(
          'GARUPA_ANIMATION_MISSING',
          'The Garupa skeleton has no animations.',
        )
      }

      const skeleton = new runtime.Skeleton(skeletonData)
      const animationState = new runtime.AnimationState(
        new runtime.AnimationStateData(skeletonData),
      )
      const matrix = new runtime.Matrix4()
      shader = runtime.Shader.newTwoColoredTextured(managed)
      batcher = new runtime.PolygonBatcher(managed, true)
      const renderer = new runtime.SkeletonRenderer(managed, true)
      return new OfficialGarupaSpine40RuntimeSession({
        animationState,
        atlas,
        batcher,
        images: [...images.values()],
        matrix,
        renderer,
        runtime,
        shader,
        skeleton,
        skeletonData,
      })
    } catch (error) {
      safely(() => batcher?.dispose())
      safely(() => shader?.dispose())
      if (atlas) safely(() => atlas?.dispose())
      else for (const texture of textures) safely(() => texture.dispose())
      for (const image of images.values()) safely(() => image.dispose())
      if (isGarupaRenderingError(error)) throw error
      throw new GarupaRenderingError(
        'GARUPA_RENDERING_FAILED',
        'The official Spine 4.0 Garupa runtime session could not be created.',
        { stage: 'runtime-session' },
        { cause: error },
      )
    }
  }
}

export const officialGarupaSpine40RuntimeAdapter =
  new OfficialGarupaSpine40RuntimeAdapter()
