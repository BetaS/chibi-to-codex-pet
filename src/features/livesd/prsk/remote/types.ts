import type { LiveSDAtlasBundle } from '../../model'

export const PRSK_REMOTE_LIMITS = Object.freeze({
  atlasBytes: 1 * 1024 * 1024,
  catalogBytes: 1 * 1024 * 1024,
  catalogOptions: 1_000,
  fieldCharacters: 128,
  pngBytes: 64 * 1024 * 1024,
  pngPages: 32,
  skeletonBytes: 8 * 1024 * 1024,
  timeoutMs: 20_000,
})

export const PJSEK_AI_ASSET_BASE_URL =
  'https://assets.pjsek.ai/file/pjsekai-assets/startapp/area_sd'
export const PRSK_CHIBI_VIEWER_CATALOG_URL =
  'https://prsk-chibi-viewer.vercel.app/'

export interface PrskRemoteCharacterOption {
  readonly id: string
  readonly label: string
}

export interface PrskRemoteCatalog {
  readonly providerLabel: string
  readonly assetBaseUrl: string
  readonly requestOrigins: readonly string[]
  readonly characters: readonly PrskRemoteCharacterOption[]
}

interface PrskRemoteProviderConfigBase {
  readonly providerLabel: string
  readonly assetBaseUrl: string
  readonly catalogUrl: string
  readonly requestOrigins: readonly string[]
}

export interface PrskRemoteCustomProviderConfig
  extends PrskRemoteProviderConfigBase {
  readonly kind: 'custom'
}

export interface PrskRemotePrskChibiViewerProviderConfig
  extends PrskRemoteProviderConfigBase {
  readonly kind: 'prsk-chibi-viewer'
}

export type PrskRemoteProviderConfig =
  | PrskRemoteCustomProviderConfig
  | PrskRemotePrskChibiViewerProviderConfig

export type PrskRemoteProviderSelection =
  | {
      readonly kind: 'custom'
      readonly assetBaseUrl: string
    }
  | {
      readonly kind: 'prsk-chibi-viewer'
    }

export interface PrskRemoteCatalogRequest {
  readonly provider: PrskRemoteProviderConfig
  readonly signal: AbortSignal
}

export interface PrskRemoteModelRequest {
  readonly catalog: PrskRemoteCatalog
  readonly characterId: string
  readonly signal: AbortSignal
}

export interface PrskRemoteModelInput {
  readonly skeletonData: ArrayBuffer
  readonly atlasBundle: LiveSDAtlasBundle
  readonly sourceOrigin: string
}

export type PrskRemoteResourceKind =
  | 'atlas'
  | 'catalog'
  | 'png'
  | 'skeleton'
