import { render, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '../i18n'
import { GAME_SOURCES } from './gameSources'
import {
  REQUIRED_PROVIDER_INTEGRATION_CAPABILITIES,
  type ProviderIntegrationCapability,
} from './providerIntegrationContract'

const AVAILABLE_PROVIDERS = GAME_SOURCES.filter(
  (source) => source.status === 'available',
)

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

afterEach(() => {
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
  },
)
