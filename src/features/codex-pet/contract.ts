export const CODEX_PET_CELL_WIDTH = 192
export const CODEX_PET_CELL_HEIGHT = 208
export const CODEX_PET_ATLAS_COLUMNS = 8
export const CODEX_PET_ATLAS_ROWS = 11
export const CODEX_PET_ATLAS_WIDTH =
  CODEX_PET_CELL_WIDTH * CODEX_PET_ATLAS_COLUMNS
export const CODEX_PET_ATLAS_HEIGHT =
  CODEX_PET_CELL_HEIGHT * CODEX_PET_ATLAS_ROWS

export type CodexPetStateId =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review'

export interface CodexPetStateSpec {
  readonly id: CodexPetStateId
  readonly row: number
  readonly frameCount: number
  readonly frameDurationsMs: readonly number[]
}

export interface CodexPetLookDirectionSpec {
  readonly index: number
  readonly angleDegrees: number
  readonly row: number
  readonly column: number
}

export const CODEX_PET_STATES = [
  {
    id: 'idle',
    row: 0,
    frameCount: 6,
    frameDurationsMs: [280, 110, 110, 140, 140, 320],
  },
  {
    id: 'running-right',
    row: 1,
    frameCount: 8,
    frameDurationsMs: [120, 120, 120, 120, 120, 120, 120, 220],
  },
  {
    id: 'running-left',
    row: 2,
    frameCount: 8,
    frameDurationsMs: [120, 120, 120, 120, 120, 120, 120, 220],
  },
  {
    id: 'waving',
    row: 3,
    frameCount: 4,
    frameDurationsMs: [140, 140, 140, 280],
  },
  {
    id: 'jumping',
    row: 4,
    frameCount: 5,
    frameDurationsMs: [140, 140, 140, 140, 280],
  },
  {
    id: 'failed',
    row: 5,
    frameCount: 8,
    frameDurationsMs: [140, 140, 140, 140, 140, 140, 140, 240],
  },
  {
    id: 'waiting',
    row: 6,
    frameCount: 6,
    frameDurationsMs: [150, 150, 150, 150, 150, 260],
  },
  {
    id: 'running',
    row: 7,
    frameCount: 6,
    frameDurationsMs: [120, 120, 120, 120, 120, 220],
  },
  {
    id: 'review',
    row: 8,
    frameCount: 6,
    frameDurationsMs: [150, 150, 150, 150, 150, 280],
  },
] as const satisfies readonly CodexPetStateSpec[]

export const CODEX_PET_LOOK_DIRECTIONS = [
  { index: 0, angleDegrees: 0, row: 9, column: 0 },
  { index: 1, angleDegrees: 22.5, row: 9, column: 1 },
  { index: 2, angleDegrees: 45, row: 9, column: 2 },
  { index: 3, angleDegrees: 67.5, row: 9, column: 3 },
  { index: 4, angleDegrees: 90, row: 9, column: 4 },
  { index: 5, angleDegrees: 112.5, row: 9, column: 5 },
  { index: 6, angleDegrees: 135, row: 9, column: 6 },
  { index: 7, angleDegrees: 157.5, row: 9, column: 7 },
  { index: 8, angleDegrees: 180, row: 10, column: 0 },
  { index: 9, angleDegrees: 202.5, row: 10, column: 1 },
  { index: 10, angleDegrees: 225, row: 10, column: 2 },
  { index: 11, angleDegrees: 247.5, row: 10, column: 3 },
  { index: 12, angleDegrees: 270, row: 10, column: 4 },
  { index: 13, angleDegrees: 292.5, row: 10, column: 5 },
  { index: 14, angleDegrees: 315, row: 10, column: 6 },
  { index: 15, angleDegrees: 337.5, row: 10, column: 7 },
] as const satisfies readonly CodexPetLookDirectionSpec[]

export const CODEX_PET_STANDARD_FRAME_COUNT = CODEX_PET_STATES.reduce(
  (total, state) => total + state.frameCount,
  0,
)

export const CODEX_PET_LOOK_FRAME_COUNT = CODEX_PET_LOOK_DIRECTIONS.length

export const CODEX_PET_TOTAL_FRAME_COUNT =
  CODEX_PET_STANDARD_FRAME_COUNT + CODEX_PET_LOOK_FRAME_COUNT
