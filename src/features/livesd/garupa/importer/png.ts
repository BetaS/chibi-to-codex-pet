import { GarupaPackImportError } from './errors'
import type { GarupaPngDecoder } from './types'

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

export function assertGarupaPngSignature(
  data: ArrayBuffer,
  path: string,
): void {
  const bytes = new Uint8Array(data)
  if (
    bytes.byteLength < PNG_SIGNATURE.byteLength ||
    PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)
  ) {
    throw new GarupaPackImportError(
      'GARUPA_TEXTURE_INVALID',
      'atlas page의 PNG signature가 유효하지 않습니다.',
      { path },
    )
  }
}

async function decodeWithImageElement(blob: Blob): Promise<void> {
  if (
    typeof Image !== 'function' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof URL.revokeObjectURL !== 'function'
  ) {
    throw new Error('No browser PNG decoder is available')
  }

  const image = new Image()
  const objectUrl = URL.createObjectURL(blob)
  try {
    image.src = objectUrl
    if (typeof image.decode === 'function') {
      await image.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('PNG image decode failed'))
      })
    }
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error('PNG decoded with invalid dimensions')
    }
  } finally {
    image.src = ''
    URL.revokeObjectURL(objectUrl)
  }
}

export const decodeGarupaPngInBrowser: GarupaPngDecoder = async (blob) => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob, {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    })
    try {
      if (bitmap.width <= 0 || bitmap.height <= 0) {
        throw new Error('PNG decoded with invalid dimensions')
      }
    } finally {
      bitmap.close()
    }
    return
  }

  await decodeWithImageElement(blob)
}
