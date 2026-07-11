/**
 * Restores the raster state required by Spine's two-dimensional painter order.
 *
 * PolygonBatcher owns blending for each attachment blend mode, so this helper
 * deliberately leaves BLEND untouched.
 */
export function prepareLiveSD2DWebGLState(
  gl: WebGLRenderingContext,
): void {
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.CULL_FACE)
  gl.disable(gl.SCISSOR_TEST)
  gl.disable(gl.STENCIL_TEST)
  gl.disable(gl.POLYGON_OFFSET_FILL)
  gl.depthMask(false)
}
