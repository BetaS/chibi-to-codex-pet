export const REQUIRED_PROVIDER_INTEGRATION_CAPABILITIES = Object.freeze([
  'preset-restoration',
  'catalog-load',
  'character-selection',
  'model-selection',
  'framing',
  'animation-selection',
  'state-shortcuts',
  'preview',
  'pet-builder',
] as const)

export type ProviderIntegrationCapability =
  (typeof REQUIRED_PROVIDER_INTEGRATION_CAPABILITIES)[number]

export type ProviderComboboxCapability = Extract<
  ProviderIntegrationCapability,
  'animation-selection' | 'character-selection' | 'model-selection'
>
