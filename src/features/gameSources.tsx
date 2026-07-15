import type { ComponentType } from 'react'

import type { MessageKey } from '../i18n'
import type { CodexPetRecipeProvider } from './codex-pet/recipe'
import { GarupaSourceIntegration } from './livesd/garupa'
import { PrskIntegration } from './livesd/prsk'
import { StrrIntegrationRoute } from './livesd/strr/StrrIntegrationRoute'

export type GameSourceId = 'prsk' | 'strr' | 'garupa'

export interface AvailableGameSourceDefinition {
  readonly cliRecipeProviders: readonly [
    CodexPetRecipeProvider,
    ...CodexPetRecipeProvider[],
  ]
  readonly id: GameSourceId
  readonly labelKey: MessageKey
  readonly status: 'available'
  readonly integration: ComponentType
}

export interface ComingSoonGameSourceDefinition {
  readonly cliRecipeProviders?: never
  readonly id: GameSourceId
  readonly labelKey: MessageKey
  readonly status: 'coming-soon'
  readonly integration?: never
}

export type GameSourceDefinition =
  | AvailableGameSourceDefinition
  | ComingSoonGameSourceDefinition

export function createGameSources(
  strrIntegration: ComponentType | null = StrrIntegrationRoute,
  garupaIntegration: ComponentType | null = GarupaSourceIntegration,
): readonly GameSourceDefinition[] {
  const strr: GameSourceDefinition = strrIntegration
    ? {
        cliRecipeProviders: ['strr-res-pak'],
        id: 'strr',
        labelKey: 'game.strr',
        status: 'available',
        integration: strrIntegration,
      }
    : { id: 'strr', labelKey: 'game.strr', status: 'coming-soon' }
  const garupa: GameSourceDefinition = garupaIntegration
    ? {
        cliRecipeProviders: ['garupa-pinned'],
        id: 'garupa',
        labelKey: 'game.garupa',
        status: 'available',
        integration: garupaIntegration,
      }
    : { id: 'garupa', labelKey: 'game.garupa', status: 'coming-soon' }

  return Object.freeze([
    {
      cliRecipeProviders: ['prsk-chibi-viewer', 'custom'],
      id: 'prsk',
      labelKey: 'game.prsk',
      status: 'available',
      integration: PrskIntegration,
    },
    strr,
    garupa,
  ] satisfies readonly GameSourceDefinition[])
}

export const GAME_SOURCES = createGameSources()

export function getAvailableGameSource(
  id: GameSourceId,
): AvailableGameSourceDefinition | null {
  const source = GAME_SOURCES.find((candidate) => candidate.id === id)
  return source?.status === 'available' ? source : null
}
