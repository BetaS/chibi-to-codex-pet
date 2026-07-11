import { describe, expect, it } from 'vitest'

import { unpremultiplyRgba } from './premultipliedAlpha'

describe('unpremultiplyRgba', () => {
  it('투명, 반투명, 불투명 PMA pixel을 straight RGBA로 변환한다', () => {
    const source = new Uint8Array([
      99, 88, 77, 0,
      32, 16, 8, 64,
      255, 128, 0, 255,
    ])

    expect([...unpremultiplyRgba(source)]).toEqual([
      0, 0, 0, 0,
      128, 64, 32, 64,
      255, 128, 0, 255,
    ])
    expect([...source]).toEqual([
      99, 88, 77, 0,
      32, 16, 8, 64,
      255, 128, 0, 255,
    ])
  })

  it('양자화로 alpha보다 큰 channel은 255로 clamp한다', () => {
    expect([...unpremultiplyRgba(new Uint8Array([65, 0, 0, 64]))]).toEqual([
      255, 0, 0, 64,
    ])
  })

  it('완전한 RGBA pixel이 아닌 입력을 거부한다', () => {
    expect(() => unpremultiplyRgba(new Uint8Array([1, 2, 3]))).toThrow(
      /divisible by 4/,
    )
  })
})
