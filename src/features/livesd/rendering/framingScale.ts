export const LIVE_SD_FRAMING_SCALE_MIN = 0.8
export const LIVE_SD_FRAMING_SCALE_MAX = 1.5
export const LIVE_SD_FRAMING_SCALE_DEFAULT = 1
export const LIVE_SD_FRAMING_SCALE_STEP = 0.01

export function assertLiveSDFramingScale(
  value: number,
): asserts value is number {
  if (
    !Number.isFinite(value) ||
    value < LIVE_SD_FRAMING_SCALE_MIN ||
    value > LIVE_SD_FRAMING_SCALE_MAX
  ) {
    throw new RangeError(
      `LiveSD framing scale must be between ${LIVE_SD_FRAMING_SCALE_MIN} and ${LIVE_SD_FRAMING_SCALE_MAX}.`,
    )
  }
}
