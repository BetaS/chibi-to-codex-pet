import type { ComponentType } from 'react'

import type { MessageKey } from '../i18n'
import { GarupaSourceIntegration } from './livesd/garupa'
import { PrskIntegration } from './livesd/prsk'

export type GameSourceId = 'prsk' | 'strr' | 'garupa'

export interface AvailableGameSourceDefinition {
  readonly id: GameSourceId
  readonly labelKey: MessageKey
  readonly status: 'available'
  readonly integration: ComponentType
}

export interface ComingSoonGameSourceDefinition {
  readonly id: GameSourceId
  readonly labelKey: MessageKey
  readonly status: 'coming-soon'
  readonly integration?: never
}

export type GameSourceDefinition =
  | AvailableGameSourceDefinition
  | ComingSoonGameSourceDefinition

export const GAME_SOURCES = Object.freeze([
  {
    id: 'prsk',
    labelKey: 'game.prsk',
    status: 'available',
    integration: PrskIntegration,
  },
  { id: 'strr', labelKey: 'game.strr', status: 'coming-soon' },
  {
    id: 'garupa',
    labelKey: 'game.garupa',
    status: 'available',
    integration: GarupaSourceIntegration,
  },
] as const satisfies readonly GameSourceDefinition[])

export function getAvailableGameSource(
  id: GameSourceId,
): AvailableGameSourceDefinition | null {
  const source = GAME_SOURCES.find((candidate) => candidate.id === id)
  return source?.status === 'available' ? source : null
}
