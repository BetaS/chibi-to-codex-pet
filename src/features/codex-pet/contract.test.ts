import { describe, expect, it } from 'vitest'

import {
  CODEX_PET_ATLAS_COLUMNS,
  CODEX_PET_ATLAS_HEIGHT,
  CODEX_PET_ATLAS_ROWS,
  CODEX_PET_ATLAS_WIDTH,
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_LOOK_FRAME_COUNT,
  CODEX_PET_STANDARD_FRAME_COUNT,
  CODEX_PET_STATES,
  CODEX_PET_TOTAL_FRAME_COUNT,
} from './contract'

describe('Codex Pet v2 contract', () => {
  it('8x11 atlas geometry와 192x208 cell을 고정한다', () => {
    expect({
      columns: CODEX_PET_ATLAS_COLUMNS,
      rows: CODEX_PET_ATLAS_ROWS,
      cellWidth: CODEX_PET_CELL_WIDTH,
      cellHeight: CODEX_PET_CELL_HEIGHT,
      atlasWidth: CODEX_PET_ATLAS_WIDTH,
      atlasHeight: CODEX_PET_ATLAS_HEIGHT,
    }).toEqual({
      columns: 8,
      rows: 11,
      cellWidth: 192,
      cellHeight: 208,
      atlasWidth: 1536,
      atlasHeight: 2288,
    })
  })

  it('상태 row, frame 수와 재생 timing을 단일 계약으로 제공한다', () => {
    expect(
      CODEX_PET_STATES.map(
        ({ id, row, frameCount, frameDurationsMs }) => ({
          id,
          row,
          frameCount,
          frameDurationsMs,
        }),
      ),
    ).toEqual([
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
    ])
    expect(CODEX_PET_STANDARD_FRAME_COUNT).toBe(57)
    for (const state of CODEX_PET_STATES) {
      expect(state.frameDurationsMs).toHaveLength(state.frameCount)
    }
  })

  it('16방향 look frame을 위쪽부터 시계 방향으로 rows 9-10에 배치한다', () => {
    expect(CODEX_PET_LOOK_DIRECTIONS).toEqual(
      Array.from({ length: 16 }, (_, index) => ({
        index,
        angleDegrees: index * 22.5,
        row: 9 + Math.floor(index / CODEX_PET_ATLAS_COLUMNS),
        column: index % CODEX_PET_ATLAS_COLUMNS,
      })),
    )
    expect(CODEX_PET_LOOK_FRAME_COUNT).toBe(16)
    expect(CODEX_PET_TOTAL_FRAME_COUNT).toBe(73)
  })

  it('Codex mouse hover를 jumping row로 설명한다', () => {
    expect(CODEX_PET_STATES.find((state) => state.id === 'jumping')).toMatchObject(
      {
        row: 4,
        frameCount: 5,
      },
    )
  })
})
