export const CODEX_PET_LOOK_MOVEMENT_SCALE_MIN = 0.5
export const CODEX_PET_LOOK_MOVEMENT_SCALE_MAX = 1.5
export const CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT = 1
export const CODEX_PET_LOOK_MOVEMENT_SCALE_STEP = 0.05

export function assertCodexPetLookMovementScale(
  value: number,
): asserts value is number {
  if (
    !Number.isFinite(value) ||
    value < CODEX_PET_LOOK_MOVEMENT_SCALE_MIN ||
    value > CODEX_PET_LOOK_MOVEMENT_SCALE_MAX
  ) {
    throw new RangeError(
      `Codex Pet look movement scale must be between ${CODEX_PET_LOOK_MOVEMENT_SCALE_MIN} and ${CODEX_PET_LOOK_MOVEMENT_SCALE_MAX}.`,
    )
  }
}
