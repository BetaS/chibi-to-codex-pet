import { describe, expect, it, vi } from 'vitest'

import { recommendCodexPetMappings } from './animationMapping'
import { CODEX_PET_STATES } from './contract'
import {
  applyCodexPetSettingsPresetMappings,
  CODEX_PET_SETTINGS_PRESET_LIMIT,
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
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
    ).toBeNull()

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
