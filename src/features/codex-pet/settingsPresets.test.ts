import { describe, expect, it, vi } from 'vitest'

import { recommendCodexPetMappings } from './animationMapping'
import { CODEX_PET_STATES } from './contract'
import {
  applyCodexPetSettingsPresetMappings,
  CODEX_PET_SETTINGS_PRESET_LIMIT,
  CODEX_PET_SETTINGS_PRESET_LEGACY_STORAGE_KEY,
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS,
  readCodexPetSettingsPresetCatalog,
  saveCodexPetSettingsPreset,
  selectCodexPetSettingsPreset,
  type CodexPetSettingsPresetInput,
  type CodexPetSettingsPresetStorage,
} from './settingsPresets'

const ANIMATIONS = [
  'idle',
  'walk',
  'wave',
  'jump',
  'failed',
  'waiting',
  'running',
  'review',
] as const

function presetInput(
  displayName: string,
  animationNames: readonly string[] = ANIMATIONS,
): CodexPetSettingsPresetInput {
  return {
    description: `${displayName} description`,
    displayName,
    framingOffset: { x: 7, y: -3 },
    framingScale: 1.25,
    globalMirrorX: true,
    lookMovementScale: 1.15,
    mappings: recommendCodexPetMappings(animationNames),
  }
}

describe('Codex Pet settings presets', () => {
  it('성공 설정만 versioned storage에 저장하고 같은 trim 이름을 덮어쓴다', () => {
    saveCodexPetSettingsPreset(presetInput('  Miku  '), localStorage, 10)
    const updated = presetInput('Miku')
    saveCodexPetSettingsPreset(
      { ...updated, description: 'updated' },
      localStorage,
      20,
    )

    const catalog = readCodexPetSettingsPresetCatalog(localStorage)
    expect(catalog.activePresetName).toBe('Miku')
    expect(Object.keys(catalog.presets)).toEqual(['Miku'])
    expect(catalog.presets.Miku).toMatchObject({
      description: 'updated',
      displayName: 'Miku',
      framingOffset: { x: 7, y: -3 },
      framingScale: 1.25,
      globalMirrorX: true,
      lookMovementScale: 1.15,
      updatedAt: 20,
    })

    const raw = localStorage.getItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY)
    expect(raw).not.toContain('sourceUrl')
    expect(raw).not.toContain('characterId')
    expect(raw).not.toContain('packageUrl')
  })

  it('원격 source 식별자를 저장하고 legacy source 없는 preset은 유지한다', () => {
    const saved = saveCodexPetSettingsPreset({
      ...presetInput('Miku'),
      source: {
        provider: 'prsk-chibi-viewer',
        characterId: 'sd_21miku_normal',
      },
    }, localStorage, 10)

    expect(saved.presets.Miku.source).toEqual({
      provider: 'prsk-chibi-viewer',
      characterId: 'sd_21miku_normal',
    })
    const legacyDocument = JSON.parse(JSON.stringify(saved)) as {
      presets: Record<string, Record<string, unknown>>
    }
    delete legacyDocument.presets.Miku?.source
    localStorage.setItem(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
      JSON.stringify(legacyDocument),
    )

    expect(
      readCodexPetSettingsPresetCatalog(localStorage).presets.Miku?.source,
    ).toBeNull()
  })

  it('STRR preset의 캐릭터와 에디션 식별자를 함께 보존한다', () => {
    const saved = saveCodexPetSettingsPreset({
      ...presetInput('태양의 나라 기사 - 다이바 나나'),
      source: {
        provider: 'strr-res-pak',
        characterId: '104',
        editionId: '1040001',
      },
    }, localStorage, 10, 'strr')

    expect(saved.presets['태양의 나라 기사 - 다이바 나나']?.source).toEqual({
      provider: 'strr-res-pak',
      characterId: '104',
      editionId: '1040001',
    })
    expect(
      readCodexPetSettingsPresetCatalog(localStorage, 'strr')
        .presets['태양의 나라 기사 - 다이바 나나']?.source,
    ).toEqual({
      provider: 'strr-res-pak',
      characterId: '104',
      editionId: '1040001',
    })
  })

  it('Garupa pinned preset의 검증된 bundle ID만 보존한다', () => {
    const saved = saveCodexPetSettingsPreset({
      ...presetInput('토야마 카스미'),
      source: {
        provider: 'garupa-pinned',
        sdAssetBundleName: '00001_2023',
      },
    }, localStorage, 10, 'garupa')

    expect(saved.presets['토야마 카스미']?.source).toEqual({
      provider: 'garupa-pinned',
      sdAssetBundleName: '00001_2023',
    })

    const invalidDocument = JSON.parse(JSON.stringify(saved)) as {
      presets: Record<string, { source: { sdAssetBundleName: string } }>
    }
    invalidDocument.presets['토야마 카스미']!.source.sdAssetBundleName =
      '../00001'
    localStorage.setItem(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS.garupa,
      JSON.stringify(invalidDocument),
    )
    expect(readCodexPetSettingsPresetCatalog(localStorage, 'garupa')).toEqual({
      activePresetName: null,
      presets: {},
      version: 1,
    })
  })

  it('runtime별 저장소를 격리하고 legacy catalog를 source provider별로 분리한다', () => {
    const prsk = saveCodexPetSettingsPreset({
      ...presetInput('Miku'),
      source: {
        provider: 'prsk-chibi-viewer',
        characterId: 'sd_21miku_normal',
      },
    }, localStorage, 1, 'prsk')
    const strr = saveCodexPetSettingsPreset({
      ...presetInput('Nana'),
      source: {
        provider: 'strr-res-pak',
        characterId: '104',
        editionId: '1040001',
      },
    }, localStorage, 2, 'strr')
    const garupa = saveCodexPetSettingsPreset({
      ...presetInput('Kasumi'),
      source: {
        provider: 'garupa-pinned',
        sdAssetBundleName: '00001',
      },
    }, localStorage, 3, 'garupa')

    expect(Object.keys(
      readCodexPetSettingsPresetCatalog(localStorage, 'prsk').presets,
    )).toEqual(['Miku'])
    expect(Object.keys(
      readCodexPetSettingsPresetCatalog(localStorage, 'strr').presets,
    )).toEqual(['Nana'])
    expect(Object.keys(
      readCodexPetSettingsPresetCatalog(localStorage, 'garupa').presets,
    )).toEqual(['Kasumi'])
    expect(() => saveCodexPetSettingsPreset({
      ...presetInput('Wrong runtime'),
      source: {
        provider: 'strr-res-pak',
        characterId: '104',
        editionId: '1040001',
      },
    }, localStorage, 4, 'garupa')).toThrow(/does not belong/)

    localStorage.setItem(
      CODEX_PET_SETTINGS_PRESET_LEGACY_STORAGE_KEY,
      JSON.stringify({
        activePresetName: 'Nana',
        presets: {
          ...prsk.presets,
          ...strr.presets,
          ...garupa.presets,
        },
        version: 1,
      }),
    )
    for (const storageKey of Object.values(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS,
    )) {
      localStorage.removeItem(storageKey)
    }

    expect(Object.keys(
      readCodexPetSettingsPresetCatalog(localStorage, 'prsk').presets,
    )).toEqual(['Miku'])
    expect(
      readCodexPetSettingsPresetCatalog(localStorage, 'strr').activePresetName,
    ).toBe('Nana')
    expect(Object.keys(
      readCodexPetSettingsPresetCatalog(localStorage, 'garupa').presets,
    )).toEqual(['Kasumi'])
  })

  it('catalog를 20개로 제한하고 가장 오래된 preset부터 제거한다', () => {
    for (let index = 0; index <= CODEX_PET_SETTINGS_PRESET_LIMIT; index += 1) {
      saveCodexPetSettingsPreset(
        presetInput(`Pet ${index}`),
        localStorage,
        index + 1,
      )
    }

    const catalog = readCodexPetSettingsPresetCatalog(localStorage)
    expect(Object.keys(catalog.presets)).toHaveLength(
      CODEX_PET_SETTINGS_PRESET_LIMIT,
    )
    expect(catalog.presets['Pet 0']).toBeUndefined()
    expect(catalog.presets['Pet 20']).toBeDefined()
  })

  it('active preset과 새 세션 선택을 저장하되 catalog는 보존한다', () => {
    saveCodexPetSettingsPreset(presetInput('Miku'), localStorage, 1)
    saveCodexPetSettingsPreset(presetInput('Airi'), localStorage, 2)

    expect(
      selectCodexPetSettingsPreset('Miku', localStorage).activePresetName,
    ).toBe('Miku')
    const newSession = selectCodexPetSettingsPreset(null, localStorage)
    expect(newSession.activePresetName).toBeNull()
    expect(Object.keys(newSession.presets)).toEqual(['Airi', 'Miku'])
    expect(
      readCodexPetSettingsPresetCatalog(localStorage).activePresetName,
    ).toBeNull()
  })

  it('손상된 document를 제거하고 storage read/write 실패를 전파하지 않는다', () => {
    localStorage.setItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY, '{broken')
    expect(readCodexPetSettingsPresetCatalog(localStorage)).toEqual({
      activePresetName: null,
      presets: {},
      version: 1,
    })
    expect(
      localStorage.getItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY),
    ).toBe(JSON.stringify({
      activePresetName: null,
      presets: {},
      version: 1,
    }))

    const blocked: CodexPetSettingsPresetStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('blocked')
      }),
      removeItem: vi.fn(() => {
        throw new DOMException('blocked')
      }),
      setItem: vi.fn(() => {
        throw new DOMException('blocked')
      }),
    }
    const inMemoryCatalog = saveCodexPetSettingsPreset(
      presetInput('Miku'),
      blocked,
      1,
    )
    expect(inMemoryCatalog.activePresetName).toBe('Miku')
    expect(inMemoryCatalog.presets.Miku).toBeDefined()
    expect(selectCodexPetSettingsPreset('Miku', blocked)).toEqual({
      activePresetName: null,
      presets: {},
      version: 1,
    })
  })

  it('허용하지 않은 source 식별자 field가 섞인 preset을 적용하지 않는다', () => {
    const catalog = saveCodexPetSettingsPreset(
      presetInput('Miku'),
      localStorage,
      1,
    )
    localStorage.setItem(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
      JSON.stringify({
        ...catalog,
        presets: {
          Miku: {
            ...catalog.presets.Miku,
            sourceUrl: 'https://assets.example.test/model.zip',
          },
        },
      }),
    )

    expect(readCodexPetSettingsPresetCatalog(localStorage)).toEqual({
      activePresetName: null,
      presets: {},
      version: 1,
    })
  })

  it('현재 source에 없는 저장 animation만 추천 mapping으로 fallback한다', () => {
    const savedCatalog = saveCodexPetSettingsPreset(
      presetInput('Miku'),
      localStorage,
      1,
    )
    const saved = savedCatalog.presets.Miku
    const nextAnimations = ANIMATIONS.filter((name) => name !== 'jump')
    const recommended = recommendCodexPetMappings(nextAnimations)
    const applied = applyCodexPetSettingsPresetMappings(
      saved,
      nextAnimations,
      recommended,
    )

    expect(applied.jumping).toEqual(recommended.jumping)
    for (const { id } of CODEX_PET_STATES) {
      if (id !== 'jumping') {
        expect(applied[id]).toEqual(saved.mappings[id])
      }
    }
  })
})
