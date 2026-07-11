import { describe, expect, it, vi } from 'vitest'

import { prepareLiveSD2DWebGLState } from './prepareLiveSD2DWebGLState'

describe('prepareLiveSD2DWebGLState', () => {
  it('Spine painter order를 방해하는 state만 끄고 blend는 건드리지 않는다', () => {
    const disable = vi.fn()
    const depthMask = vi.fn()
    const gl = {
      BLEND: 0x0be2,
      CULL_FACE: 0x0b44,
      DEPTH_TEST: 0x0b71,
      POLYGON_OFFSET_FILL: 0x8037,
      SCISSOR_TEST: 0x0c11,
      STENCIL_TEST: 0x0b90,
      depthMask,
      disable,
    } as unknown as WebGLRenderingContext

    prepareLiveSD2DWebGLState(gl)

    expect(disable.mock.calls).toEqual([
      [gl.DEPTH_TEST],
      [gl.CULL_FACE],
      [gl.SCISSOR_TEST],
      [gl.STENCIL_TEST],
      [gl.POLYGON_OFFSET_FILL],
    ])
    expect(disable).not.toHaveBeenCalledWith(gl.BLEND)
    expect(depthMask).toHaveBeenCalledOnce()
    expect(depthMask).toHaveBeenCalledWith(false)
  })
})
