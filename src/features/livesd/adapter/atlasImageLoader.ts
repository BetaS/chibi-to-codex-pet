import { LiveSDPreviewError } from './errors'

export interface LoadedAtlasImage {
  readonly image: HTMLImageElement
  dispose(): void
}

export type AtlasImageLoader = (
  blob: Blob,
  path: string,
) => Promise<LoadedAtlasImage>

export const loadAtlasImage: AtlasImageLoader = async (blob, path) => {
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'

  try {
    await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener(
        'error',
        () => reject(new Error(`Failed to decode ${path}`)),
        { once: true },
      )
      image.src = objectUrl
    })
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw new LiveSDPreviewError(
      'ATLAS_IMAGE_DECODE_FAILED',
      `atlas PNG를 디코딩할 수 없습니다: ${path}`,
      { cause: error },
    )
  }

  let disposed = false
  return {
    image,
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      URL.revokeObjectURL(objectUrl)
      image.removeAttribute('src')
    },
  }
}
