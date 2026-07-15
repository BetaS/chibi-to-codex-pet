import { describe, expect, it, vi } from 'vitest'

import { recommendCodexPetMappings } from './animationMapping'
import { CODEX_PET_STATES } from './contract'
import {
  applyCodexPetSettingsPresetMappings,
  CODEX_PET_SETTINGS_PRESET_LIMIT,
  CODEX_PET_SETTINGS_PRESET_LEGACY_STORAGE_KEY,
  CODEX_PET_SETTINGS_PRESET_SCHEMA_VERSION,
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS,
  CODEX_PET_SETTINGS_PRESET_V1_STORAGE_KEYS,
  CODEX_PET_SETTINGS_PRESET_VERSION,
  readCodexPetSettingsPresetCatalog,
  saveCodexPetSettingsPreset,
  selectCodexPetSettingsPreset,
  type CodexPetSettingsPresetInput,
  type CodexPetSettingsPreset,
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

function versionOnePreset(
  preset: CodexPetSettingsPreset,
): Record<string, unknown> {
  const legacy = JSON.parse(JSON.stringify(preset)) as Record<string, unknown>
  delete legacy.schemaVersion
  return legacy
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
      schemaVersion: CODEX_PET_SETTINGS_PRESET_SCHEMA_VERSION,
      updatedAt: 20,
    })

    const raw = localStorage.getItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY)
    expect(raw).not.toContain('sourceUrl')
    expect(raw).not.toContain('characterId')
    expect(raw).not.toContain('packageUrl')
  })

  it('원격 source 식별자와 current preset schema version을 저장한다', () => {
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
    expect(saved.presets.Miku.schemaVersion).toBe(
      CODEX_PET_SETTINGS_PRESET_SCHEMA_VERSION,
    )
    expect(saved.version).toBe(CODEX_PET_SETTINGS_PRESET_VERSION)
  })

  it('runtime version 1 preset을 항목별로 v2에 이관하고 legacy는 변경하지 않는다', () => {
    const saved = saveCodexPetSettingsPreset({
      ...presetInput('Legacy Local'),
      source: null,
    }, localStorage, 10, 'garupa')
    const legacyPreset = versionOnePreset(saved.presets['Legacy Local']!)
    delete legacyPreset.source
    const legacyRaw = JSON.stringify({
      activePresetName: 'Legacy Local',
      presets: {
        'Legacy Local': legacyPreset,
        Broken: {
          ...legacyPreset,
          displayName: 'Broken',
          unsupportedField: true,
        },
      },
      version: 1,
    })
    localStorage.removeItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS.garupa)
    localStorage.setItem(
      CODEX_PET_SETTINGS_PRESET_V1_STORAGE_KEYS.garupa,
      legacyRaw,
    )

    const migrated = readCodexPetSettingsPresetCatalog(localStorage, 'garupa')

    expect(migrated.activePresetName).toBe('Legacy Local')
    expect(Object.keys(migrated.presets)).toEqual(['Legacy Local'])
    expect(migrated.presets['Legacy Local']).toMatchObject({
      schemaVersion: CODEX_PET_SETTINGS_PRESET_SCHEMA_VERSION,
      source: null,
    })
    expect(localStorage.getItem(
      CODEX_PET_SETTINGS_PRESET_V1_STORAGE_KEYS.garupa,
    )).toBe(legacyRaw)
    expect(JSON.parse(localStorage.getItem(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS.garupa,
    ) ?? '{}')).toMatchObject({
      activePresetName: 'Legacy Local',
      version: CODEX_PET_SETTINGS_PRESET_VERSION,
    })
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
      version: CODEX_PET_SETTINGS_PRESET_VERSION,
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
          Miku: versionOnePreset(prsk.presets.Miku!),
          Nana: versionOnePreset(strr.presets.Nana!),
          Kasumi: versionOnePreset(garupa.presets.Kasumi!),
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

  it('유효한 current catalog read는 storage를 쓰거나 legacy를 조회하지 않는다', () => {
    saveCodexPetSettingsPreset(presetInput('Miku'), localStorage, 1)
    const raw = localStorage.getItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY)
    const storage: CodexPetSettingsPresetStorage = {
      getItem: vi.fn((key) =>
        key === CODEX_PET_SETTINGS_PRESET_STORAGE_KEY ? raw : null,
      ),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    }

    const catalog = readCodexPetSettingsPresetCatalog(storage)

    expect(catalog.activePresetName).toBe('Miku')
    expect(storage.getItem).toHaveBeenCalledOnce()
    expect(storage.getItem).toHaveBeenCalledWith(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
    )
    expect(storage.removeItem).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('손상된 document를 제거하고 storage read/write 실패를 전파하지 않는다', () => {
    const old = saveCodexPetSettingsPreset(
      presetInput('Old Miku'),
      localStorage,
      1,
    )
    const legacyRaw = JSON.stringify({
      activePresetName: 'Old Miku',
      presets: {
        'Old Miku': versionOnePreset(old.presets['Old Miku']!),
      },
      version: 1,
    })
    localStorage.setItem(
      CODEX_PET_SETTINGS_PRESET_V1_STORAGE_KEYS.prsk,
      legacyRaw,
    )
    localStorage.setItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY, '{broken')
    expect(readCodexPetSettingsPresetCatalog(localStorage)).toEqual({
      activePresetName: null,
      presets: {},
      version: CODEX_PET_SETTINGS_PRESET_VERSION,
    })
    expect(
      localStorage.getItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY),
    ).toBe(JSON.stringify({
      activePresetName: null,
      presets: {},
      version: CODEX_PET_SETTINGS_PRESET_VERSION,
    }))
    expect(localStorage.getItem(
      CODEX_PET_SETTINGS_PRESET_V1_STORAGE_KEYS.prsk,
    )).toBe(legacyRaw)

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
      version: CODEX_PET_SETTINGS_PRESET_VERSION,
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
      version: CODEX_PET_SETTINGS_PRESET_VERSION,
    })
  })

  it('mixed current catalog에서 invalid·future preset만 숨기고 유효 preset을 보존한다', () => {
    const first = saveCodexPetSettingsPreset(
      presetInput('Miku'),
      localStorage,
      1,
    )
    const second = saveCodexPetSettingsPreset(
      presetInput('Airi'),
      localStorage,
      2,
    )
    const rawDocument = {
      ...second,
      activePresetName: 'Airi',
      presets: {
        Miku: first.presets.Miku,
        Airi: {
          ...second.presets.Airi,
          schemaVersion: 99,
        },
        Unknown: {
          ...second.presets.Airi,
          displayName: 'Unknown',
          unsupportedField: true,
        },
      },
    }
    const raw = JSON.stringify(rawDocument)
    localStorage.setItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY, raw)

    const parsed = readCodexPetSettingsPresetCatalog(localStorage)

    expect(parsed.activePresetName).toBeNull()
    expect(Object.keys(parsed.presets)).toEqual(['Miku'])
    expect(parsed.presets.Miku?.schemaVersion).toBe(
      CODEX_PET_SETTINGS_PRESET_SCHEMA_VERSION,
    )
    expect(localStorage.getItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY)).toBe(
      raw,
    )
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
