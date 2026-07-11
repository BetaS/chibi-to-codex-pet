export function unpremultiplyRgba(
  premultipliedRgba: Uint8Array | Uint8ClampedArray,
): Uint8ClampedArray {
  if (premultipliedRgba.length % 4 !== 0) {
    throw new RangeError('RGBA byte length must be divisible by 4.')
  }

  const straightRgba = new Uint8ClampedArray(premultipliedRgba.length)
  for (let index = 0; index < premultipliedRgba.length; index += 4) {
    const alpha = premultipliedRgba[index + 3] ?? 0
    straightRgba[index + 3] = alpha

    if (alpha === 0) {
      continue
    }

    const scale = 255 / alpha
    straightRgba[index] = Math.round((premultipliedRgba[index] ?? 0) * scale)
    straightRgba[index + 1] = Math.round(
      (premultipliedRgba[index + 1] ?? 0) * scale,
    )
    straightRgba[index + 2] = Math.round(
      (premultipliedRgba[index + 2] ?? 0) * scale,
    )
  }

  return straightRgba
}
