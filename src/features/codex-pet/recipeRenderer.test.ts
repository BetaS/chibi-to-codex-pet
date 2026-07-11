import { describe, expect, it } from 'vitest'

import { CODEX_PET_STATES } from './contract'
import type { CodexPetAnimationMappings } from './animationMapping'
import { createCodexPetRecipe } from './recipe'
import { createCodexPetRecipeSamplingInput } from './recipeRenderer'

describe('recipe renderer sampling parity', () => {
  it('recipe의 전체·상태별 반전을 그대로 공용 sampler에 전달한다', () => {
    const mappings = Object.fromEntries(
      CODEX_PET_STATES.map((state) => [
        state.id,
        {
          animationName: `animation-${state.id}`,
          mirrorX: state.id === 'running-left',
        },
      ]),
    ) as CodexPetAnimationMappings
    const recipe = createCodexPetRecipe({
      globalMirrorX: true,
      source: { provider: 'prsk-chibi-viewer', characterId: 'sd_test' },
      pet: {
        displayName: 'Test',
        framingOffsetX: 12,
        framingOffsetY: 8,
        framingScale: 0.9,
        lookMovementScale: 1.25,
      },
      mappings,
    })
    const model = {
      atlasBundle: {
        sourceName: 'sd_test',
        atlasPath: 'sekai_atlas.atlas',
        atlasText: 'atlas',
        atlasPages: new Map<string, Blob>(),
      },
      skeletonData: new ArrayBuffer(1),
      sourceOrigin: 'https://assets.example.test',
    }
    const controller = new AbortController()

    expect(
      createCodexPetRecipeSamplingInput(recipe, model, controller.signal),
    ).toEqual({
      atlasBundle: model.atlasBundle,
      framingOffset: { x: 12, y: 8 },
      framingScale: 0.9,
      globalMirrorX: true,
      lookMovementScale: 1.25,
      skeletonData: model.skeletonData,
      mappings,
      signal: controller.signal,
    })
  })
})
