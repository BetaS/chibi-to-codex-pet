import {
  normalizeSpineRuntimeProfileError,
  SpineRuntimeProfileError,
} from './versionedRuntimeError'

export type Spine40Runtime = typeof import('@esotericsoftware/spine-webgl')
export type Spine40RuntimeImporter = () => Promise<Spine40Runtime>

const SPINE_40_NOTICE_ROOT_URL =
  `${import.meta.env.BASE_URL}vendor/esotericsoftware-spine-4.0.31`

export const SPINE_40_RUNTIME_LICENSE_URL =
  `${SPINE_40_NOTICE_ROOT_URL}/LICENSE`
export const SPINE_40_RUNTIME_NOTICES_URL =
  `${SPINE_40_NOTICE_ROOT_URL}/THIRD_PARTY_NOTICES.md`

const defaultSpine40RuntimeImporter: Spine40RuntimeImporter = async () => {
  const runtime = await import('@esotericsoftware/spine-webgl')

  return Object.freeze({
    AnimationState: runtime.AnimationState,
    AnimationStateData: runtime.AnimationStateData,
    AtlasAttachmentLoader: runtime.AtlasAttachmentLoader,
    GLTexture: runtime.GLTexture,
    ManagedWebGLRenderingContext: runtime.ManagedWebGLRenderingContext,
    Matrix4: runtime.Matrix4,
    MixBlend: runtime.MixBlend,
    MixDirection: runtime.MixDirection,
    PolygonBatcher: runtime.PolygonBatcher,
    Shader: runtime.Shader,
    Skeleton: runtime.Skeleton,
    SkeletonBinary: runtime.SkeletonBinary,
    SkeletonRenderer: runtime.SkeletonRenderer,
    TextureAtlas: runtime.TextureAtlas,
    Vector2: runtime.Vector2,
  }) as Spine40Runtime
}

function hasConstructor(
  runtime: Spine40Runtime,
  name: keyof Spine40Runtime,
): boolean {
  return typeof runtime[name] === 'function'
}

export function isSpine40Runtime(runtime: Spine40Runtime): boolean {
  return [
    'AnimationState',
    'AnimationStateData',
    'AtlasAttachmentLoader',
    'GLTexture',
    'ManagedWebGLRenderingContext',
    'Matrix4',
    'PolygonBatcher',
    'Shader',
    'Skeleton',
    'SkeletonBinary',
    'SkeletonRenderer',
    'TextureAtlas',
    'Vector2',
  ].every((name) => hasConstructor(runtime, name as keyof Spine40Runtime)) &&
    typeof runtime.MixBlend === 'object' &&
    typeof runtime.MixDirection === 'object'
}

export class Spine40RuntimeLoader {
  readonly #importRuntime: Spine40RuntimeImporter
  #loadPromise: Promise<Spine40Runtime> | null = null

  constructor(importRuntime: Spine40RuntimeImporter = defaultSpine40RuntimeImporter) {
    this.#importRuntime = importRuntime
  }

  load(): Promise<Spine40Runtime> {
    this.#loadPromise ??= this.#loadRuntime().catch((error: unknown) => {
      this.#loadPromise = null
      throw error
    })
    return this.#loadPromise
  }

  async #loadRuntime(): Promise<Spine40Runtime> {
    const spine36Before = window.spine
    let runtime: Spine40Runtime

    try {
      runtime = await this.#importRuntime()
    } catch (error) {
      throw normalizeSpineRuntimeProfileError(
        error,
        'RUNTIME_PROFILE_LOAD_FAILED',
        'Spine 4.0 ESM runtime을 불러오지 못했습니다.',
        { runtimeKey: 'spine-4.0' },
      )
    }

    if (spine36Before && window.spine !== spine36Before) {
      window.spine = spine36Before
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_API_INVALID',
        'Spine 4.0 loader가 기존 Spine 3.6 global을 변경했습니다.',
        { runtimeKey: 'spine-4.0' },
      )
    }
    if (
      spine36Before === undefined &&
      window.spine === (runtime as unknown as typeof spine)
    ) {
      Reflect.deleteProperty(window, 'spine')
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_API_INVALID',
        'Spine 4.0 ESM runtime이 global spine namespace를 만들었습니다.',
        { runtimeKey: 'spine-4.0' },
      )
    }
    if (!isSpine40Runtime(runtime)) {
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_API_INVALID',
        'Spine 4.0 module이 필요한 runtime API를 제공하지 않습니다.',
        { runtimeKey: 'spine-4.0' },
      )
    }

    return runtime
  }
}

export const spine40RuntimeLoader = new Spine40RuntimeLoader()
