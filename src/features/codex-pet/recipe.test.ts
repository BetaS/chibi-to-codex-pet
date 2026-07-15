import { describe, expect, it } from 'vitest'

import { CODEX_PET_STATES } from './contract'
import {
  CODEX_PET_RECIPE_PROVIDERS,
  createCodexPetRecipe,
  decodeCodexPetRecipe,
  encodeCodexPetRecipe,
  formatCodexPetRecipeInstallCommand,
  parseCodexPetRecipe,
} from './recipe'
import type { CodexPetAnimationMappings } from './animationMapping'

function mappings(): CodexPetAnimationMappings {
  const result = {} as CodexPetAnimationMappings
  for (const state of CODEX_PET_STATES) {
    result[state.id] = {
      animationName: `animation-${state.id}`,
      mirrorX: state.id === 'running-left',
    }
  }
  return result
}

describe('Codex Pet recipe', () => {
  it('base64url recipe를 round-trip하고 npx 명령으로 포맷한다', () => {
    const recipe = createCodexPetRecipe({
      globalMirrorX: true,
      source: {
        provider: 'prsk-chibi-viewer',
        characterId: 'sd_07airi_normal',
      },
      pet: {
        displayName: 'Airi Normal',
        description: 'test',
        framingOffsetX: 12,
        framingOffsetY: -8,
        framingScale: 0.9,
        lookMovementScale: 1.25,
      },
      mappings: mappings(),
    })

    const encoded = encodeCodexPetRecipe(recipe)

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeCodexPetRecipe(encoded)).toEqual(recipe)
    expect(recipe.globalMirrorX).toBe(true)
    expect(recipe.pet.framingOffsetX).toBe(12)
    expect(recipe.pet.framingOffsetY).toBe(-8)
    expect(recipe.pet.lookMovementScale).toBe(1.25)
    expect(formatCodexPetRecipeInstallCommand(recipe)).toBe(
      `npx -y chibi-to-codex-pet install --recipe ${encoded}`,
    )
  })

  it('custom source는 asset base와 캐릭터 ID만 recipe에 담는다', () => {
    const recipe = createCodexPetRecipe({
      source: {
        provider: 'custom',
        assetBaseUrl: 'https://example.com/area_sd',
        characterId: 'sd_mob003',
      },
      pet: { displayName: 'Mob 003' },
      mappings: mappings(),
    })

    expect(recipe.source).toEqual({
      provider: 'custom',
      assetBaseUrl: 'https://example.com/area_sd',
      characterId: 'sd_mob003',
    })
    expect(recipe.pet.framingScale).toBe(1)
    expect(recipe.pet.framingOffsetX).toBe(0)
    expect(recipe.pet.framingOffsetY).toBe(0)
    expect(recipe.pet.lookMovementScale).toBe(1)
  })

  it('STRR res-pak source는 캐릭터와 에디션 ID를 strict round-trip한다', () => {
    const recipe = createCodexPetRecipe({
      source: {
        provider: 'strr-res-pak',
        characterId: '101',
        editionId: '1010001',
      },
      pet: { displayName: 'Karen' },
      mappings: mappings(),
    })

    expect(decodeCodexPetRecipe(encodeCodexPetRecipe(recipe)).source).toEqual({
      provider: 'strr-res-pak',
      characterId: '101',
      editionId: '1010001',
    })
    expect(() => parseCodexPetRecipe({
      ...recipe,
      source: { ...recipe.source, editionId: '2020001' },
    })).toThrow(/character ID로 시작/)
  })

  it('Garupa pinned source는 안전한 bundle ID만 strict round-trip한다', () => {
    const recipe = createCodexPetRecipe({
      source: {
        provider: 'garupa-pinned',
        sdAssetBundleName: '00001_2023',
      },
      pet: { displayName: 'Kasumi' },
      mappings: mappings(),
    })

    expect(CODEX_PET_RECIPE_PROVIDERS).toEqual([
      'custom',
      'garupa-pinned',
      'prsk-chibi-viewer',
      'strr-res-pak',
    ])
    expect(decodeCodexPetRecipe(encodeCodexPetRecipe(recipe)).source).toEqual({
      provider: 'garupa-pinned',
      sdAssetBundleName: '00001_2023',
    })
    expect(() => parseCodexPetRecipe({
      ...recipe,
      source: {
        provider: 'garupa-pinned',
        sdAssetBundleName: '../00001',
      },
    })).toThrow(/source\.sdAssetBundleName/)
  })

  it('binary payload inline을 거부한다', () => {
    const recipe = createCodexPetRecipe({
      source: { provider: 'prsk-chibi-viewer', characterId: 'sd_mob003' },
      pet: { displayName: 'Mob 003' },
      mappings: mappings(),
    })

    expect(() =>
      parseCodexPetRecipe({
        ...recipe,
        spritesheetBase64: 'abc',
      }),
    ).toThrow(/binary payload/)
  })

  it('기존 schema version 1 recipe의 누락된 방향 설정을 기본값으로 정규화한다', () => {
    const recipe = createCodexPetRecipe({
      source: { provider: 'prsk-chibi-viewer', characterId: 'sd_mob003' },
      pet: { displayName: 'Legacy' },
      mappings: mappings(),
    })
    const legacy = Object.fromEntries(
      Object.entries(recipe).filter(([key]) => key !== 'globalMirrorX'),
    )
    legacy.pet = Object.fromEntries(
      Object.entries(recipe.pet).filter(
        ([key]) =>
          key !== 'lookMovementScale' &&
          key !== 'framingOffsetX' &&
          key !== 'framingOffsetY',
      ),
    )

    expect(parseCodexPetRecipe(legacy).globalMirrorX).toBe(false)
    expect(parseCodexPetRecipe(legacy).pet.lookMovementScale).toBe(1)
    expect(parseCodexPetRecipe(legacy).pet.framingOffsetX).toBe(0)
    expect(parseCodexPetRecipe(legacy).pet.framingOffsetY).toBe(0)
    expect(() =>
      parseCodexPetRecipe({ ...recipe, globalMirrorX: 'true' }),
    ).toThrow(/globalMirrorX는 boolean/)
  })

  it.each([0.49, 1.51, Number.NaN])(
    '범위를 벗어난 눈 이동 배율 %s를 거부한다',
    (lookMovementScale) => {
      expect(() =>
        createCodexPetRecipe({
          source: {
            provider: 'prsk-chibi-viewer',
            characterId: 'sd_mob003',
          },
          pet: { displayName: 'Mob 003', lookMovementScale },
          mappings: mappings(),
        }),
      ).toThrow(/pet\.lookMovementScale/)
    },
  )

  it.each([
    { framingOffsetX: 97 },
    { framingOffsetX: 0.5 },
    { framingOffsetY: -105 },
    { framingOffsetY: Number.NaN },
  ])('범위를 벗어난 framing offset을 거부한다: $framingOffsetX $framingOffsetY', (offset) => {
    expect(() =>
      createCodexPetRecipe({
        source: {
          provider: 'prsk-chibi-viewer',
          characterId: 'sd_mob003',
        },
        pet: { displayName: 'Mob 003', ...offset },
        mappings: mappings(),
      }),
    ).toThrow(/pet\.framingOffset/)
  })

  it('모든 Codex Pet 상태 mapping을 요구한다', () => {
    const incomplete = mappings()
    delete (incomplete as Partial<CodexPetAnimationMappings>).review

    expect(() =>
      createCodexPetRecipe({
        source: { provider: 'prsk-chibi-viewer', characterId: 'sd_mob003' },
        pet: { displayName: 'Mob 003' },
        mappings: incomplete,
      }),
    ).toThrow(/mappings.review/)
  })
})
