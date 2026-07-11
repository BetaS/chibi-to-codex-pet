import { resolveAtlasPagePath } from '../model'
import {
  liveSD36RuntimeLoader,
  type LiveSD36RuntimeLoader,
  type Spine36Runtime,
} from '../runtime/runtimeLoader'
import {
  loadAtlasImage,
  type AtlasImageLoader,
  type LoadedAtlasImage,
} from './atlasImageLoader'
import { isLiveSDPreviewError, LiveSDPreviewError } from './errors'
import { appendSkeletonTerminator } from './skeletonPadding'
import { inspectLiveSD36Skeleton } from './skeletonHeader'
import type {
  LiveSD36AdapterContract,
  LiveSD36PreviewInput,
  LiveSDPreviewSession,
  LiveSDSkeletonHeader,
} from './types'
import {
  browserAnimationFrameScheduler,
  type AnimationFrameScheduler,
  WebGLLiveSDPreviewSession,
} from './WebGLLiveSDPreviewSession'

export interface LiveSD36AdapterOptions {
  readonly imageLoader?: AtlasImageLoader
  readonly runtimeLoader?: Pick<LiveSD36RuntimeLoader, 'load'>
  readonly scheduler?: AnimationFrameScheduler
}

export class LiveSD36Adapter implements LiveSD36AdapterContract {
  readonly #imageLoader: AtlasImageLoader
  readonly #runtimeLoader: Pick<LiveSD36RuntimeLoader, 'load'>
  readonly #scheduler: AnimationFrameScheduler

  constructor(options: LiveSD36AdapterOptions = {}) {
    this.#imageLoader = options.imageLoader ?? loadAtlasImage
    this.#runtimeLoader = options.runtimeLoader ?? liveSD36RuntimeLoader
    this.#scheduler = options.scheduler ?? browserAnimationFrameScheduler
  }

  inspectSkeleton(data: ArrayBuffer): LiveSDSkeletonHeader {
    return inspectLiveSD36Skeleton(data)
  }

  async createPreview(
    input: LiveSD36PreviewInput,
  ): Promise<LiveSDPreviewSession> {
    const header = this.inspectSkeleton(input.skeletonData)
    const gl = input.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
      stencil: false,
    })

    if (!gl) {
      throw new LiveSDPreviewError(
        'WEBGL_UNSUPPORTED',
        '이 브라우저에서는 WebGL 미리보기를 사용할 수 없습니다.',
      )
    }

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
    const runtime = await this.#runtimeLoader.load()
    const images = await this.#loadImages(input)

    return this.#createRuntimeSession(runtime, gl, input, header, images)
  }

  async #loadImages(
    input: LiveSD36PreviewInput,
  ): Promise<Map<string, LoadedAtlasImage>> {
    const loaded = new Map<string, LoadedAtlasImage>()

    try {
      for (const [path, blob] of input.atlasBundle.atlasPages) {
        loaded.set(path, await this.#imageLoader(blob, path))
      }
      return loaded
    } catch (error) {
      for (const image of loaded.values()) {
        image.dispose()
      }

      if (isLiveSDPreviewError(error)) {
        throw error
      }

      throw new LiveSDPreviewError(
        'ATLAS_IMAGE_DECODE_FAILED',
        'atlas PNG를 디코딩할 수 없습니다.',
        { cause: error },
      )
    }
  }

  #createRuntimeSession(
    runtime: Spine36Runtime,
    gl: WebGLRenderingContext,
    input: LiveSD36PreviewInput,
    header: LiveSDSkeletonHeader,
    imageByPath: Map<string, LoadedAtlasImage>,
  ): LiveSDPreviewSession {
    const textures: spine.webgl.GLTexture[] = []
    let atlas: spine.TextureAtlas | null = null
    let batcher: spine.webgl.PolygonBatcher | null = null
    let session: WebGLLiveSDPreviewSession | null = null
    let shader: spine.webgl.Shader | null = null

    try {
      const managedContext = new runtime.webgl.ManagedWebGLRenderingContext(gl)

      try {
        atlas = new runtime.TextureAtlas(
          input.atlasBundle.atlasText,
          (pageReference) => {
            const pagePath = resolveAtlasPagePath(
              input.atlasBundle.atlasPath,
              pageReference,
            )
            const image = imageByPath.get(pagePath)
            if (!image) {
              throw new Error(`Missing decoded atlas page: ${pagePath}`)
            }

            const texture = new runtime.webgl.GLTexture(
              managedContext,
              image.image,
            )
            textures.push(texture)
            return texture
          },
        )
      } catch (error) {
        throw new LiveSDPreviewError(
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
          appendSkeletonTerminator(input.skeletonData),
        )
      } catch (error) {
        throw new LiveSDPreviewError(
          'SKELETON_PARSE_FAILED',
          `${header.version} 공통 스켈레톤을 LiveSD 3.6 runtime으로 파싱하지 못했습니다.`,
          { cause: error },
        )
      }

      const skeleton = new runtime.Skeleton(skeletonData)
      const animationNames = skeletonData.animations.map(
        (animation) => animation.name,
      )
      if (animationNames.length === 0) {
        throw new LiveSDPreviewError(
          'ANIMATION_MISSING',
          '공통 스켈레톤에 재생할 애니메이션이 없습니다.',
        )
      }

      const defaultAnimation =
        animationNames.find((name) => name === 'pose_default') ??
        animationNames[0]
      if (!defaultAnimation) {
        throw new LiveSDPreviewError(
          'ANIMATION_MISSING',
          '공통 스켈레톤에 재생할 애니메이션이 없습니다.',
        )
      }

      skeleton.setToSetupPose()
      const animationStateData = new runtime.AnimationStateData(skeletonData)
      const animationState = new runtime.AnimationState(animationStateData)
      animationState.setAnimation(0, defaultAnimation, true)
      animationState.apply(skeleton)
      skeleton.updateWorldTransform()

      const bounds = {
        offset: new runtime.Vector2(),
        size: new runtime.Vector2(),
      }
      skeleton.getBounds(bounds.offset, bounds.size, [])

      const matrix = new runtime.webgl.Matrix4()
      shader = runtime.webgl.Shader.newTwoColoredTextured(managedContext)
      batcher = new runtime.webgl.PolygonBatcher(managedContext, true)
      const renderer = new runtime.webgl.SkeletonRenderer(
        managedContext,
        true,
      )

      session = new WebGLLiveSDPreviewSession({
        animationData: skeletonData.animations,
        animationState,
        atlas,
        batcher,
        bounds,
        canvas: input.canvas,
        compatibility: header.compatibility,
        gl,
        images: [...imageByPath.values()],
        matrix,
        renderer,
        runtime,
        scheduler: this.#scheduler,
        shader,
        skeleton,
        version: header.version,
      })
      session.start()
      return session
    } catch (error) {
      if (session) {
        session.dispose()
      } else {
        batcher?.dispose()
        shader?.dispose()
        if (atlas) {
          atlas.dispose()
        } else {
          for (const texture of textures) {
            texture.dispose()
          }
        }
        for (const image of imageByPath.values()) {
          image.dispose()
        }
      }

      if (isLiveSDPreviewError(error)) {
        throw error
      }

      throw new LiveSDPreviewError(
        'PREVIEW_RENDERER_CREATE_FAILED',
        'LiveSD WebGL 미리보기를 구성하지 못했습니다.',
        { cause: error },
      )
    }
  }
}

export const liveSD36Adapter = new LiveSD36Adapter()
