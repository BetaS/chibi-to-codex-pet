import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '../i18n'
import type { CodexPetAnimationMappings } from './codex-pet/animationMapping'
import { CODEX_PET_STATES } from './codex-pet/contract'
import { CODEX_PET_RECIPE_PROVIDERS } from './codex-pet/recipe'
import {
  CODEX_PET_SETTINGS_PRESET_SCHEMA_VERSION,
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS,
  CODEX_PET_SETTINGS_PRESET_V1_STORAGE_KEYS,
  CODEX_PET_SETTINGS_PRESET_VERSION,
  saveCodexPetSettingsPreset,
  type CodexPetSettingsPresetRuntime,
} from './codex-pet/settingsPresets'
import { GAME_SOURCES } from './gameSources'
import {
  REQUIRED_PROVIDER_INTEGRATION_CAPABILITIES,
  type ProviderIntegrationCapability,
} from './providerIntegrationContract'

const AVAILABLE_PROVIDERS = GAME_SOURCES.filter(
  (source) => source.status === 'available',
)
const HARNESS_MAPPINGS = Object.fromEntries(
  CODEX_PET_STATES.map(({ id }) => [
    id,
    { animationName: 'idle', mirrorX: false },
  ]),
) as CodexPetAnimationMappings

function capabilityElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-provider-capability]'),
  )
}

function capabilityElement(
  container: HTMLElement,
  capability: ProviderIntegrationCapability,
) {
  const matches = capabilityElements(container).filter(
    (element) => element.dataset.providerCapability === capability,
  )
  expect(matches, `${capability} capability marker`).toHaveLength(1)
  return matches[0] as HTMLElement
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe.each(AVAILABLE_PROVIDERS)(
  '$id provider integration development harness',
  (source) => {
    it('공통 capability surface를 조합하고 mount만으로 network를 시작하지 않는다', async () => {
      const fetchMock = vi.fn<typeof fetch>(() =>
        Promise.reject(new Error('provider harness blocked an implicit request')),
      )
      vi.stubGlobal('fetch', fetchMock)
      const Integration = source.integration
      const { container } = render(
        <I18nProvider initialLocale="ko" storage={null}>
          <Integration />
        </I18nProvider>,
      )

      await waitFor(() => {
        expect(capabilityElements(container)).toHaveLength(
          REQUIRED_PROVIDER_INTEGRATION_CAPABILITIES.length,
        )
      })

      const actualCapabilities = capabilityElements(container)
        .map((element) => element.dataset.providerCapability)
        .sort()
      expect(actualCapabilities).toEqual(
        [...REQUIRED_PROVIDER_INTEGRATION_CAPABILITIES].sort(),
      )

      const preset = capabilityElement(container, 'preset-restoration')
      expect(within(preset).getByRole('combobox')).toBeEnabled()

      const catalogLoad = capabilityElement(container, 'catalog-load')
      expect(catalogLoad.tagName).toBe('BUTTON')
      expect(catalogLoad).toBeEnabled()

      for (const capability of [
        'character-selection',
        'model-selection',
        'animation-selection',
      ] as const) {
        const selector = capabilityElement(container, capability)
        expect(within(selector).getByRole('combobox')).toBeDisabled()
      }

      const framing = capabilityElement(container, 'framing')
      expect(framing.tagName).toBe('FIELDSET')
      expect(framing).toBeDisabled()

      const shortcuts = capabilityElement(container, 'state-shortcuts')
      const shortcutButtons = within(shortcuts).getAllByRole('button')
      expect(shortcutButtons.length).toBeGreaterThan(0)
      for (const button of shortcutButtons) {
        expect(button).toBeDisabled()
      }

      const preview = capabilityElement(container, 'preview')
      expect(preview.tagName).toBe('CANVAS')

      const builder = capabilityElement(container, 'pet-builder')
      expect(builder.tagName).toBe('SECTION')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('저장 preset에서는 catalog action을 숨기고 새로 만들기로 새 session을 연다', async () => {
      const user = userEvent.setup()
      saveCodexPetSettingsPreset({
        description: 'Provider harness preset',
        displayName: 'Harness Preset',
        framingOffset: { x: 0, y: 0 },
        framingScale: 1,
        globalMirrorX: false,
        lookMovementScale: 1,
        mappings: HARNESS_MAPPINGS,
        source: null,
      }, localStorage, 1, source.id as CodexPetSettingsPresetRuntime)
      const fetchMock = vi.fn<typeof fetch>(() =>
        Promise.reject(new Error('provider harness blocked an implicit request')),
      )
      vi.stubGlobal('fetch', fetchMock)
      const Integration = source.integration
      const { container } = render(
        <I18nProvider initialLocale="ko" storage={null}>
          <Integration />
        </I18nProvider>,
      )

      const preset = capabilityElement(container, 'preset-restoration')
      expect(within(preset).getByRole('combobox')).toHaveValue('Harness Preset')
      expect(within(preset).getByRole('button', {
        name: '프리셋 불러오기',
      })).toBeEnabled()
      const createNew = within(preset).getByRole('button', {
        name: '새로 만들기',
      })
      expect(createNew).toBeEnabled()
      expect(capabilityElements(container).filter(
        (element) => element.dataset.providerCapability === 'catalog-load',
      )).toHaveLength(0)

      await user.click(createNew)

      await waitFor(() => {
        expect(capabilityElements(container).filter(
          (element) => element.dataset.providerCapability === 'catalog-load',
        )).toHaveLength(1)
      })
      expect(capabilityElement(container, 'catalog-load')).toBeEnabled()
      expect(within(preset).queryByRole('button', { name: '새로 만들기' }))
        .not.toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('runtime v1 preset을 request 없이 v2로 이관하고 legacy 원문을 보존한다', () => {
      const runtime = source.id as CodexPetSettingsPresetRuntime
      const saved = saveCodexPetSettingsPreset({
        description: 'Legacy provider harness preset',
        displayName: 'Legacy Harness',
        framingOffset: { x: 0, y: 0 },
        framingScale: 1,
        globalMirrorX: false,
        lookMovementScale: 1,
        mappings: HARNESS_MAPPINGS,
        source: null,
      }, localStorage, 1, runtime)
      const legacyPreset = JSON.parse(JSON.stringify(
        saved.presets['Legacy Harness'],
      )) as Record<string, unknown>
      delete legacyPreset.schemaVersion
      const legacyRaw = JSON.stringify({
        activePresetName: 'Legacy Harness',
        presets: { 'Legacy Harness': legacyPreset },
        version: 1,
      })
      localStorage.setItem(
        CODEX_PET_SETTINGS_PRESET_V1_STORAGE_KEYS[runtime],
        legacyRaw,
      )
      localStorage.removeItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS[runtime])
      const fetchMock = vi.fn<typeof fetch>(() =>
        Promise.reject(new Error('provider harness blocked an implicit request')),
      )
      vi.stubGlobal('fetch', fetchMock)
      const Integration = source.integration
      const { container } = render(
        <I18nProvider initialLocale="ko" storage={null}>
          <Integration />
        </I18nProvider>,
      )

      const preset = capabilityElement(container, 'preset-restoration')
      expect(within(preset).getByRole('combobox')).toHaveValue('Legacy Harness')
      expect(fetchMock).not.toHaveBeenCalled()
      expect(localStorage.getItem(
        CODEX_PET_SETTINGS_PRESET_V1_STORAGE_KEYS[runtime],
      )).toBe(legacyRaw)
      expect(JSON.parse(localStorage.getItem(
        CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS[runtime],
      ) ?? '{}')).toMatchObject({
        activePresetName: 'Legacy Harness',
        presets: {
          'Legacy Harness': {
            schemaVersion: CODEX_PET_SETTINGS_PRESET_SCHEMA_VERSION,
          },
        },
        version: CODEX_PET_SETTINGS_PRESET_VERSION,
      })
    })
  },
)

describe('provider CLI recipe development harness', () => {
  it('모든 available provider가 지원되는 CLI recipe provider를 하나 이상 선언한다', () => {
    const supportedProviders = new Set(CODEX_PET_RECIPE_PROVIDERS)

    for (const source of AVAILABLE_PROVIDERS) {
      expect(source.cliRecipeProviders.length).toBeGreaterThan(0)
      for (const provider of source.cliRecipeProviders) {
        expect(supportedProviders.has(provider)).toBe(true)
      }
    }

    expect(Object.fromEntries(
      AVAILABLE_PROVIDERS.map((source) => [
        source.id,
        source.cliRecipeProviders,
      ]),
    )).toEqual({
      garupa: ['garupa-pinned'],
      prsk: ['prsk-chibi-viewer', 'custom'],
      strr: ['strr-res-pak'],
    })
  })
})
