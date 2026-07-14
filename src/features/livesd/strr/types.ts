import type { LiveSDAtlasBundle } from '../model'

export type StrrLabelLocale = 'en' | 'ja' | 'ko' | 'zh_hant'

export type StrrLocalizedLabels = Readonly<
  Partial<Record<StrrLabelLocale, string>>
>

export interface StrrEdition {
  readonly id: string
  readonly labels: StrrLocalizedLabels
  readonly metadataSource: 'karth' | 'local'
  readonly side: 'right'
}

export interface StrrCharacter {
  readonly id: string
  readonly labels: StrrLocalizedLabels
  readonly editions: readonly StrrEdition[]
}

export interface StrrCatalog {
  readonly version: 1
  readonly gameId: 'strr'
  readonly characters: readonly StrrCharacter[]
}

export interface StrrModelInput {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly characterId: string
  readonly editionId: string
  readonly skeletonData: ArrayBuffer
}

export type StrrProviderErrorCode =
  | 'STRR_CATALOG_INVALID'
  | 'STRR_CATALOG_LOAD_FAILED'
  | 'STRR_MODEL_INVALID'
  | 'STRR_MODEL_LOAD_FAILED'
  | 'STRR_SELECTION_INVALID'

export class StrrProviderError extends Error {
  readonly code: StrrProviderErrorCode

  constructor(
    code: StrrProviderErrorCode,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'StrrProviderError'
    this.code = code
  }
}
