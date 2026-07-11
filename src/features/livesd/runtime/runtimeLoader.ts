const SPINE_36_RUNTIME_ROOT_URL =
  `${import.meta.env.BASE_URL}vendor/estertion-spine-3.6`

export const SPINE_36_RUNTIME_URL =
  `${SPINE_36_RUNTIME_ROOT_URL}/spine-webgl.js`
export const SPINE_36_RUNTIME_LICENSE_URL =
  `${SPINE_36_RUNTIME_ROOT_URL}/LICENSE`
export const SPINE_36_RUNTIME_NOTICES_URL =
  `${SPINE_36_RUNTIME_ROOT_URL}/THIRD_PARTY_NOTICES.md`

export type Spine36Runtime = typeof spine

export type RuntimeLoadErrorCode =
  | 'RUNTIME_GLOBAL_MISSING'
  | 'RUNTIME_SCRIPT_LOAD_FAILED'

export class RuntimeLoadError extends Error {
  readonly code: RuntimeLoadErrorCode

  constructor(code: RuntimeLoadErrorCode, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'RuntimeLoadError'
    this.code = code
  }
}

function isSpine36Runtime(value: typeof spine | undefined): value is typeof spine {
  return Boolean(
    value?.SkeletonBinary &&
      value.TextureAtlas &&
      value.AtlasAttachmentLoader &&
      value.webgl?.GLTexture,
  )
}

export class LiveSD36RuntimeLoader {
  readonly runtimeUrl = SPINE_36_RUNTIME_URL

  #loadPromise: Promise<Spine36Runtime> | null = null

  load(): Promise<Spine36Runtime> {
    if (isSpine36Runtime(window.spine)) {
      return Promise.resolve(window.spine)
    }

    this.#loadPromise ??= this.#loadRuntime().catch((error: unknown) => {
      this.#loadPromise = null
      throw error
    })

    return this.#loadPromise
  }

  async #loadRuntime(): Promise<Spine36Runtime> {
    await this.#appendClassicScript(this.runtimeUrl)

    if (!isSpine36Runtime(window.spine)) {
      throw new RuntimeLoadError(
        'RUNTIME_GLOBAL_MISSING',
        'LiveSD 3.6 runtime이 유효한 global spine API를 만들지 못했습니다.',
      )
    }

    return window.spine
  }

  #appendClassicScript(source: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.async = true
      script.dataset.livesdRuntime = '3.6'
      script.src = source
      script.addEventListener(
        'load',
        () => {
          script.remove()
          resolve()
        },
        { once: true },
      )
      script.addEventListener(
        'error',
        () => {
          script.remove()
          reject(
            new RuntimeLoadError(
              'RUNTIME_SCRIPT_LOAD_FAILED',
              `LiveSD 3.6 runtime script를 불러오거나 실행하지 못했습니다: ${source}`,
            ),
          )
        },
        { once: true },
      )
      document.head.append(script)
    })
  }
}

export const liveSD36RuntimeLoader = new LiveSD36RuntimeLoader()
