import { describe, expect, it } from 'vitest'

import type { CodexPetAnimationMappings } from '../../../codex-pet/animationMapping'
import {
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_STANDARD_FRAME_COUNT,
  CODEX_PET_STATES,
  CODEX_PET_TOTAL_FRAME_COUNT,
} from '../../../codex-pet/contract'
import { GarupaRenderingError } from './errors'
import {
  calculateGarupaSampleTimes,
  createGarupaFramePlan,
} from './framePlan'

function createMappings(): CodexPetAnimationMappings {
  return Object.fromEntries(
    CODEX_PET_STATES.map((state) => [
      state.id,
      {
        animationName: `animation-${state.id}`,
        mirrorX: state.id === 'running-left',
      },
    ]),
  ) as unknown as CodexPetAnimationMappings
}

function createDurations(
  mappings: CodexPetAnimationMappings,
): ReadonlyMap<string, number> {
  return new Map(
    CODEX_PET_STATES.map((state) => [
      mappings[state.id].animationName,
      state.row + 1,
    ]),
  )
}

describe('Garupa 73-frame plan', () => {
  it('uses deterministic duration fractions and all existing atlas cells', () => {
    const mappings = createMappings()
    const plan = createGarupaFramePlan(mappings, createDurations(mappings))

    expect(plan).toHaveLength(CODEX_PET_TOTAL_FRAME_COUNT)
    expect(plan.slice(0, CODEX_PET_STANDARD_FRAME_COUNT)).toHaveLength(57)
    expect(plan.slice(CODEX_PET_STANDARD_FRAME_COUNT)).toEqual(
      CODEX_PET_LOOK_DIRECTIONS.map((direction) =>
        expect.objectContaining({
          column: direction.column,
          lookDirectionDegrees: direction.angleDegrees,
          lookDirectionIndex: direction.index,
          row: direction.row,
          sampleTime: 0,
        }),
      ),
    )

    const runningRight = plan.filter(
      (frame) => frame.stateId === 'running-right',
    )
    expect(runningRight.map((frame) => frame.sampleTime)).toEqual(
      calculateGarupaSampleTimes(2, 8),
    )
  })

  it('combines global and state mirrors while preserving look direction meaning', () => {
    const mappings = createMappings()
    const plan = createGarupaFramePlan(
      mappings,
      createDurations(mappings),
      true,
    )

    expect(plan.find((frame) => frame.stateId === 'running-right')?.mirrorX)
      .toBe(true)
    expect(plan.find((frame) => frame.stateId === 'running-left')?.mirrorX)
      .toBe(false)
    expect(
      plan.find((frame) => frame.lookDirectionIndex === 4),
    ).toEqual(
      expect.objectContaining({
        lookDirectionDegrees: 270,
        mirrorX: true,
      }),
    )
    expect(
      plan.find((frame) => frame.lookDirectionIndex === 12),
    ).toEqual(
      expect.objectContaining({
        lookDirectionDegrees: 90,
        mirrorX: true,
      }),
    )
  })

  it('uses a stable error when a mapped animation is absent', () => {
    const mappings = createMappings()
    const durations = new Map(createDurations(mappings))
    durations.delete(mappings.review.animationName)

    expect(() => createGarupaFramePlan(mappings, durations)).toThrowError(
      expect.objectContaining<Partial<GarupaRenderingError>>({
        code: 'GARUPA_ANIMATION_MISSING',
      }),
    )
  })
})
