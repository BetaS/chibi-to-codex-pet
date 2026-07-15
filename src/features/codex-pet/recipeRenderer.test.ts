import { describe, expect, it, vi } from 'vitest'

import { CODEX_PET_STATES } from './contract'
import type { CodexPetAnimationMappings } from './animationMapping'
import { createCodexPetRecipe } from './recipe'
import {
  createCodexPetRecipeSamplingInput,
  sampleCodexPetRecipeFrames,
} from './recipeRenderer'

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

  it('STRR recipe는 static look fallback과 고정 mirror 식별자를 전달한다', () => {
    const mappings = Object.fromEntries(
      CODEX_PET_STATES.map((state) => [
        state.id,
        { animationName: 'wait1', mirrorX: false },
      ]),
    ) as CodexPetAnimationMappings
    const recipe = createCodexPetRecipe({
      globalMirrorX: true,
      source: {
        provider: 'strr-res-pak',
        characterId: '101',
        editionId: '1010001',
      },
      pet: { displayName: 'Karen' },
      mappings,
    })
    const model = {
      atlasBundle: {
        sourceName: '101:1010001',
        atlasPath: 'model_right.atlas',
        atlasText: 'atlas',
        atlasPages: new Map<string, Blob>(),
      },
      skeletonData: new ArrayBuffer(1),
    }
    const controller = new AbortController()

    expect(
      createCodexPetRecipeSamplingInput(recipe, model, controller.signal),
    ).toMatchObject({
      globalMirrorX: true,
      lookRigFallback: 'static',
      mappings,
    })
  })

  it('Garupa recipe만 Spine 4.0 sampler로 routing한다', async () => {
    const mappings = Object.fromEntries(
      CODEX_PET_STATES.map((state) => [
        state.id,
        { animationName: 'idle', mirrorX: false },
      ]),
    ) as CodexPetAnimationMappings
    const model = {
      atlasBundle: {
        sourceName: '00001_2023-model',
        atlasPath: 'costume.atlas',
        atlasText: 'atlas',
        atlasPages: new Map<string, Blob>(),
      },
      skeletonData: new ArrayBuffer(1),
    }
    const garupaSpine40Sample = vi.fn(async () => ({
      adapterIdentity: 'official-spine-4.0',
      atlasPng: new Blob(['garupa'], { type: 'image/png' }),
      frameCount: 43,
      height: 2288,
      runtimeKey: 'spine-4.0' as const,
      width: 1536,
    }))
    const liveSD36Sample = vi.fn(async () => ({
      atlasPng: new Blob(['livesd36'], { type: 'image/png' }),
      frameCount: 43,
      height: 2288,
      width: 1536,
    }))
    const services = {
      garupaSpine40: { sample: garupaSpine40Sample },
      liveSD36: { sample: liveSD36Sample },
    }
    const controller = new AbortController()

    await sampleCodexPetRecipeFrames(
      createCodexPetRecipe({
        source: {
          provider: 'garupa-pinned',
          sdAssetBundleName: '00001_2023',
        },
        pet: { displayName: 'Kasumi' },
        mappings,
      }),
      model,
      controller.signal,
      services,
    )

    expect(garupaSpine40Sample).toHaveBeenCalledOnce()
    expect(liveSD36Sample).not.toHaveBeenCalled()

    await sampleCodexPetRecipeFrames(
      createCodexPetRecipe({
        source: {
          provider: 'prsk-chibi-viewer',
          characterId: 'sd_test',
        },
        pet: { displayName: 'Miku' },
        mappings,
      }),
      model,
      controller.signal,
      services,
    )

    expect(liveSD36Sample).toHaveBeenCalledOnce()
    expect(garupaSpine40Sample).toHaveBeenCalledOnce()
  })
})
