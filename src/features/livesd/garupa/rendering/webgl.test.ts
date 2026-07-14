import { describe, expect, it, vi } from 'vitest'

import type { GarupaSpine40RuntimeSession } from './types'
import {
  drawGarupaRuntimeFrame,
  prepareGarupaStraightAlphaWebGLState,
  readGarupaStraightRgba,
} from './webgl'

function createGl(readback?: readonly number[]): WebGLRenderingContext {
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
    pixelStorei: vi.fn(),
    readPixels: vi.fn(
      (
        _x: number,
        _y: number,
        _width: number,
        _height: number,
        _format: number,
        _type: number,
        pixels: Uint8Array,
      ) => pixels.set(readback ?? new Array(pixels.length).fill(0)),
    ),
    viewport: vi.fn(),
  }
  return gl as unknown as WebGLRenderingContext
}

describe('Garupa straight-alpha WebGL pipeline', () => {
  it('restores painter-order state and requests straight-alpha blending', () => {
    const gl = createGl()
    prepareGarupaStraightAlphaWebGLState(gl)

    expect(gl.disable).toHaveBeenCalledWith(gl.DEPTH_TEST)
    expect(gl.disable).toHaveBeenCalledWith(gl.CULL_FACE)
    expect(gl.disable).toHaveBeenCalledWith(gl.SCISSOR_TEST)
    expect(gl.disable).toHaveBeenCalledWith(gl.STENCIL_TEST)
    expect(gl.disable).toHaveBeenCalledWith(gl.POLYGON_OFFSET_FILL)
    expect(gl.depthMask).toHaveBeenCalledWith(false)
    expect(gl.pixelStorei).toHaveBeenCalledWith(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      0,
    )
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND)
    expect(gl.blendFunc).toHaveBeenCalledWith(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
    )
  })

  it('draws only through runtime draw order with PMA disabled', () => {
    const gl = createGl()
    const draw = vi.fn()
    const session = { draw } as unknown as GarupaSpine40RuntimeSession

    drawGarupaRuntimeFrame(session, gl, 192, 208)

    expect(draw).toHaveBeenCalledWith({
      blend: 'src-alpha-one-minus-src-alpha',
      layerOrder: 'runtime-draw-order',
      mirrorX: false,
      premultipliedAlpha: false,
    })
  })

  it('flips rows, unpremultiplies exactly once, and zeroes transparent RGB', () => {
    const gl = createGl([
      10, 20, 30, 0,
      64, 32, 16, 128,
    ])

    expect([...readGarupaStraightRgba(gl, 1, 2)]).toEqual([
      128, 64, 32, 128,
      0, 0, 0, 0,
    ])
    expect(gl.readPixels).toHaveBeenCalledTimes(1)
  })
})
