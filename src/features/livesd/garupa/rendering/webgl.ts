import { prepareLiveSD2DWebGLState } from '../../rendering/prepareLiveSD2DWebGLState'
import { unpremultiplyRgba } from '../../rendering/premultipliedAlpha'
import { GarupaRenderingError } from './errors'
import type { GarupaSpine40RuntimeSession } from './types'

export const GARUPA_PREVIEW_WEBGL_ATTRIBUTES: Readonly<WebGLContextAttributes> =
  Object.freeze({
    alpha: true,
    antialias: true,
    depth: false,
    premultipliedAlpha: false,
    stencil: false,
  })

export const GARUPA_SAMPLER_WEBGL_ATTRIBUTES: Readonly<WebGLContextAttributes> =
  Object.freeze({
    ...GARUPA_PREVIEW_WEBGL_ATTRIBUTES,
    preserveDrawingBuffer: true,
  })

function assertRasterSize(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('Raster dimensions must be positive integers.')
  }
}

export function prepareGarupaStraightAlphaWebGLState(
  gl: WebGLRenderingContext,
): void {
  prepareLiveSD2DWebGLState(gl)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
}

export function drawGarupaRuntimeFrame(
  session: GarupaSpine40RuntimeSession,
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  mirrorX = false,
): void {
  assertRasterSize(width, height)
  prepareGarupaStraightAlphaWebGLState(gl)
  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  session.draw({
    blend: 'src-alpha-one-minus-src-alpha',
    layerOrder: 'runtime-draw-order',
    mirrorX,
    premultipliedAlpha: false,
  })
}

export function flipGarupaWebGLRows(
  source: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  assertRasterSize(width, height)
  const rowBytes = width * 4
  if (source.length !== rowBytes * height) {
    throw new RangeError('RGBA byte length does not match raster dimensions.')
  }

  const output = new Uint8Array(source.length)
  for (let sourceRow = 0; sourceRow < height; sourceRow += 1) {
    const sourceOffset = sourceRow * rowBytes
    const targetOffset = (height - sourceRow - 1) * rowBytes
    output.set(source.subarray(sourceOffset, sourceOffset + rowBytes), targetOffset)
  }
  return output
}

/** Converts one raw transparent-framebuffer readback to top-down straight RGBA. */
export function readGarupaStraightRgba(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
): Uint8ClampedArray {
  assertRasterSize(width, height)
  const raw = new Uint8Array(width * height * 4)

  try {
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw)
  } catch (error) {
    throw new GarupaRenderingError(
      'GARUPA_FRAME_READBACK_FAILED',
      'Garupa framebuffer pixels could not be read.',
      { stage: 'readPixels' },
      { cause: error },
    )
  }

  const glError = gl.getError()
  if (glError !== gl.NO_ERROR) {
    throw new GarupaRenderingError(
      'GARUPA_FRAME_READBACK_FAILED',
      'Garupa framebuffer readback returned a WebGL error.',
      { glError, stage: 'readPixels' },
    )
  }

  return unpremultiplyRgba(flipGarupaWebGLRows(raw, width, height))
}
