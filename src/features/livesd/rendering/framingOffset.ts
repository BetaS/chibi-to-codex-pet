export interface LiveSDFramingOffset {
  readonly x: number
  readonly y: number
}

export const LIVE_SD_FRAMING_OFFSET_X_MIN = -96
export const LIVE_SD_FRAMING_OFFSET_X_MAX = 96
export const LIVE_SD_FRAMING_OFFSET_Y_MIN = -104
export const LIVE_SD_FRAMING_OFFSET_Y_MAX = 104
export const LIVE_SD_FRAMING_OFFSET_STEP = 1
export const LIVE_SD_FRAMING_OFFSET_REFERENCE_WIDTH = 192
export const LIVE_SD_FRAMING_OFFSET_REFERENCE_HEIGHT = 208
export const LIVE_SD_FRAMING_OFFSET_DEFAULT: LiveSDFramingOffset = Object.freeze({
  x: 0,
  y: 0,
})

export function assertLiveSDFramingOffset(
  value: LiveSDFramingOffset,
): asserts value is LiveSDFramingOffset {
  if (
    !Number.isInteger(value.x) ||
    !Number.isInteger(value.y) ||
    value.x < LIVE_SD_FRAMING_OFFSET_X_MIN ||
    value.x > LIVE_SD_FRAMING_OFFSET_X_MAX ||
    value.y < LIVE_SD_FRAMING_OFFSET_Y_MIN ||
    value.y > LIVE_SD_FRAMING_OFFSET_Y_MAX
  ) {
    throw new RangeError(
      `LiveSD framing offset must use integer cell pixels with X between ${LIVE_SD_FRAMING_OFFSET_X_MIN} and ${LIVE_SD_FRAMING_OFFSET_X_MAX}, and Y between ${LIVE_SD_FRAMING_OFFSET_Y_MIN} and ${LIVE_SD_FRAMING_OFFSET_Y_MAX}.`,
    )
  }
}

export function isDefaultLiveSDFramingOffset(
  value: LiveSDFramingOffset,
): boolean {
  return value.x === 0 && value.y === 0
}
