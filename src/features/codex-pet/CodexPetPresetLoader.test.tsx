import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '../../i18n'
import { recommendCodexPetMappings } from './animationMapping'
import { CodexPetPresetLoader } from './CodexPetPresetLoader'
import {
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
  CODEX_PET_SETTINGS_PRESET_VERSION,
  readCodexPetSettingsPresetCatalog,
  saveCodexPetSettingsPreset,
  type CodexPetSettingsPreset,
  type CodexPetSettingsPresetCatalog,
} from './settingsPresets'

const catalog = {
  activePresetName: 'Saved Pet',
  presets: {
    'Saved Pet': {} as CodexPetSettingsPreset,
  },
  version: CODEX_PET_SETTINGS_PRESET_VERSION,
} satisfies CodexPetSettingsPresetCatalog

function renderLoader({
  busy = false,
  selectedPresetName = 'Saved Pet' as string | null,
} = {}) {
  const onLoad = vi.fn()
  const onSelectionChange = vi.fn()

  render(
    <I18nProvider initialLocale="ko" storage={null}>
      <CodexPetPresetLoader
        busy={busy}
        catalog={catalog}
        description="저장 프리셋을 선택합니다."
        onLoad={onLoad}
        onSelectionChange={onSelectionChange}
        selectedPresetName={selectedPresetName}
        selectorTestId="preset-selector"
      />
    </I18nProvider>,
  )

  return { onLoad, onSelectionChange }
}

describe('CodexPetPresetLoader', () => {
  it('새 세션에서는 새로 만들기를 숨기고 preset load를 비활성화한다', () => {
    renderLoader({ selectedPresetName: null })

    expect(screen.queryByRole('button', { name: '새로 만들기' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '프리셋 불러오기' }))
      .toBeDisabled()
  })

  it('저장 preset에서는 busy 중에도 새로 만들기가 같은 null selection을 전달한다', async () => {
    const user = userEvent.setup()
    const { onSelectionChange } = renderLoader({ busy: true })

    expect(screen.getByRole('button', { name: '프리셋 불러오기' }))
      .toBeDisabled()
    const createNew = screen.getByRole('button', { name: '새로 만들기' })
    expect(createNew).toBeEnabled()

    await user.click(createNew)
    expect(onSelectionChange).toHaveBeenLastCalledWith(null)

    onSelectionChange.mockClear()
    await user.selectOptions(screen.getByTestId('preset-selector'), '')
    expect(onSelectionChange).toHaveBeenCalledOnce()
    expect(onSelectionChange).toHaveBeenLastCalledWith(null)
  })

  it('지원하지 않는 preset version은 dropdown에서 숨기고 current preset만 노출한다', () => {
    const saved = saveCodexPetSettingsPreset({
      description: '',
      displayName: 'Saved Pet',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: false,
      lookMovementScale: 1,
      mappings: recommendCodexPetMappings(['idle']),
    }, localStorage, 1)
    localStorage.setItem(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
      JSON.stringify({
        ...saved,
        activePresetName: 'Future Pet',
        presets: {
          ...saved.presets,
          'Future Pet': {
            ...saved.presets['Saved Pet'],
            displayName: 'Future Pet',
            schemaVersion: 99,
          },
        },
      }),
    )
    const filtered = readCodexPetSettingsPresetCatalog(localStorage)

    render(
      <I18nProvider initialLocale="ko" storage={null}>
        <CodexPetPresetLoader
          catalog={filtered}
          description="저장 프리셋을 선택합니다."
          onLoad={vi.fn()}
          onSelectionChange={vi.fn()}
          selectedPresetName={filtered.activePresetName}
          selectorTestId="filtered-preset-selector"
        />
      </I18nProvider>,
    )

    expect(screen.getByRole('option', { name: 'Saved Pet' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Future Pet' }))
      .not.toBeInTheDocument()
    expect(screen.getByTestId('filtered-preset-selector')).toHaveValue('')
  })
})
