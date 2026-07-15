import {
  CODEX_PET_STATES,
  type CodexPetStateId,
} from './contract'
import type { CodexPetAnimationMappings } from './animationMapping'
import {
  LIVE_SD_FRAMING_SCALE_DEFAULT,
  LIVE_SD_FRAMING_SCALE_MAX,
  LIVE_SD_FRAMING_SCALE_MIN,
} from '../livesd/rendering/framingScale'
import {
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  LIVE_SD_FRAMING_OFFSET_X_MAX,
  LIVE_SD_FRAMING_OFFSET_X_MIN,
  LIVE_SD_FRAMING_OFFSET_Y_MAX,
  LIVE_SD_FRAMING_OFFSET_Y_MIN,
} from '../livesd/rendering/framingOffset'
import {
  CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
  CODEX_PET_LOOK_MOVEMENT_SCALE_MAX,
  CODEX_PET_LOOK_MOVEMENT_SCALE_MIN,
} from './lookMovementScale'

export const CODEX_PET_RECIPE_SCHEMA_VERSION = 1 as const
export const CODEX_PET_RECIPE_KIND = 'livesd-recipe' as const
export const CODEX_PET_RECIPE_RENDERER = 'livesd36-codex-pet@1' as const
const CODEX_PET_CLI_PACKAGE = 'chibi-to-codex-pet' as const

const CUSTOM_PROVIDER_KEYS = ['assetBaseUrl', 'characterId', 'provider'] as const
const FORBIDDEN_BINARY_KEYS = new Set([
  'package',
  'packageBase64',
  'spritesheet',
  'spritesheetBase64',
  'zip',
  'zipBase64',
])
const MAPPING_KEYS = ['animationName', 'mirrorX'] as const
const PET_KEYS = [
  'description',
  'displayName',
  'framingOffsetX',
  'framingOffsetY',
  'framingScale',
  'lookMovementScale',
] as const
const GARUPA_PROVIDER_KEYS = ['provider', 'sdAssetBundleName'] as const
const PRSK_PROVIDER_KEYS = ['characterId', 'provider'] as const
const STRR_PROVIDER_KEYS = ['characterId', 'editionId', 'provider'] as const
const RECIPE_KEYS = [
  'globalMirrorX',
  'kind',
  'mappings',
  'pet',
  'renderer',
  'schemaVersion',
  'source',
] as const

export const CODEX_PET_RECIPE_PROVIDERS = Object.freeze([
  'custom',
  'garupa-pinned',
  'prsk-chibi-viewer',
  'strr-res-pak',
] as const)

export type CodexPetRecipeProvider =
  (typeof CODEX_PET_RECIPE_PROVIDERS)[number]

export interface CodexPetRecipeCustomSource {
  readonly provider: 'custom'
  readonly assetBaseUrl: string
  readonly characterId: string
}

export interface CodexPetRecipePrskChibiViewerSource {
  readonly provider: 'prsk-chibi-viewer'
  readonly characterId: string
}

export interface CodexPetRecipeGarupaPinnedSource {
  readonly provider: 'garupa-pinned'
  readonly sdAssetBundleName: string
}

export interface CodexPetRecipeStrrResPakSource {
  readonly provider: 'strr-res-pak'
  readonly characterId: string
  readonly editionId: string
}

export type CodexPetRecipeSource =
  | CodexPetRecipeCustomSource
  | CodexPetRecipeGarupaPinnedSource
  | CodexPetRecipePrskChibiViewerSource
  | CodexPetRecipeStrrResPakSource

export interface CodexPetRecipePet {
  readonly displayName: string
  readonly description: string
  readonly framingOffsetX: number
  readonly framingOffsetY: number
  readonly framingScale: number
  readonly lookMovementScale: number
}

export interface CodexPetRecipe {
  readonly schemaVersion: typeof CODEX_PET_RECIPE_SCHEMA_VERSION
  readonly kind: typeof CODEX_PET_RECIPE_KIND
  readonly renderer: typeof CODEX_PET_RECIPE_RENDERER
  readonly globalMirrorX: boolean
  readonly source: CodexPetRecipeSource
  readonly pet: CodexPetRecipePet
  readonly mappings: CodexPetAnimationMappings
}

export class CodexPetRecipeError extends Error {
  readonly code = 'RECIPE_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'CodexPetRecipeError'
  }
}

function recipeError(message: string): never {
  throw new CodexPetRecipeError(message)
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    recipeError(`${label}는 object여야 합니다.`)
  }
  return value as Record<string, unknown>
}

function assertKnownKeys(
  record: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void {
  const allowed = new Set(allowedKeys)
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      recipeError(`${label}에 알 수 없는 key가 있습니다: ${key}`)
    }
  }
}

function assertNoForbiddenBinaryKeys(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_BINARY_KEYS.has(key)) {
      recipeError(`recipe에는 binary payload를 포함할 수 없습니다: ${key}`)
    }
  }
}

function parseTrimmedString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    recipeError(`${label}는 문자열이어야 합니다.`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    recipeError(`${label}는 비어 있을 수 없습니다.`)
  }
  if (trimmed.length > maxLength) {
    recipeError(`${label}는 ${maxLength}자를 초과할 수 없습니다.`)
  }
  return trimmed
}

function parseDescription(value: unknown): string {
  if (value === undefined) {
    return ''
  }
  if (typeof value !== 'string') {
    recipeError('pet.description은 문자열이어야 합니다.')
  }
  const trimmed = value.trim()
  if (trimmed.length > 280) {
    recipeError('pet.description은 280자를 초과할 수 없습니다.')
  }
  return trimmed
}

function parseOptionalBoolean(value: unknown, label: string): boolean {
  if (value === undefined) {
    return false
  }
  if (typeof value !== 'boolean') {
    recipeError(`${label}는 boolean이어야 합니다.`)
  }
  return value
}

function parseFramingScale(value: unknown): number {
  if (value === undefined) {
    return LIVE_SD_FRAMING_SCALE_DEFAULT
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < LIVE_SD_FRAMING_SCALE_MIN ||
    value > LIVE_SD_FRAMING_SCALE_MAX
  ) {
    recipeError(
      `pet.framingScale은 ${LIVE_SD_FRAMING_SCALE_MIN} 이상 ${LIVE_SD_FRAMING_SCALE_MAX} 이하의 숫자여야 합니다.`,
    )
  }
  return Math.round(value * 100) / 100
}

function parseFramingOffset(
  value: unknown,
  axis: 'X' | 'Y',
): number {
  if (value === undefined) {
    return axis === 'X'
      ? LIVE_SD_FRAMING_OFFSET_DEFAULT.x
      : LIVE_SD_FRAMING_OFFSET_DEFAULT.y
  }
  const minimum =
    axis === 'X'
      ? LIVE_SD_FRAMING_OFFSET_X_MIN
      : LIVE_SD_FRAMING_OFFSET_Y_MIN
  const maximum =
    axis === 'X'
      ? LIVE_SD_FRAMING_OFFSET_X_MAX
      : LIVE_SD_FRAMING_OFFSET_Y_MAX
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    recipeError(
      `pet.framingOffset${axis}는 ${minimum} 이상 ${maximum} 이하의 정수여야 합니다.`,
    )
  }
  return value
}

function parseLookMovementScale(value: unknown): number {
  if (value === undefined) {
    return CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < CODEX_PET_LOOK_MOVEMENT_SCALE_MIN ||
    value > CODEX_PET_LOOK_MOVEMENT_SCALE_MAX
  ) {
    recipeError(
      `pet.lookMovementScale은 ${CODEX_PET_LOOK_MOVEMENT_SCALE_MIN} 이상 ${CODEX_PET_LOOK_MOVEMENT_SCALE_MAX} 이하의 숫자여야 합니다.`,
    )
  }
  return Math.round(value * 100) / 100
}

function parseSourceId(
  value: unknown,
  field: 'characterId' | 'editionId' | 'sdAssetBundleName',
): string {
  const sourceId = parseTrimmedString(value, `source.${field}`, 128)
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(sourceId)) {
    recipeError(`source.${field}는 안전한 원격 ID여야 합니다.`)
  }
  return sourceId
}

export function parseCodexPetRecipeSource(
  value: unknown,
): CodexPetRecipeSource {
  const source = assertRecord(value, 'source')
  assertNoForbiddenBinaryKeys(source)
  const provider = source.provider
  if (provider === 'prsk-chibi-viewer') {
    assertKnownKeys(source, PRSK_PROVIDER_KEYS, 'source')
    return {
      provider,
      characterId: parseSourceId(source.characterId, 'characterId'),
    }
  }
  if (provider === 'custom') {
    assertKnownKeys(source, CUSTOM_PROVIDER_KEYS, 'source')
    return {
      provider,
      assetBaseUrl: parseTrimmedString(source.assetBaseUrl, 'source.assetBaseUrl', 2048),
      characterId: parseSourceId(source.characterId, 'characterId'),
    }
  }
  if (provider === 'garupa-pinned') {
    assertKnownKeys(source, GARUPA_PROVIDER_KEYS, 'source')
    return {
      provider,
      sdAssetBundleName: parseSourceId(
        source.sdAssetBundleName,
        'sdAssetBundleName',
      ),
    }
  }
  if (provider === 'strr-res-pak') {
    assertKnownKeys(source, STRR_PROVIDER_KEYS, 'source')
    const characterId = parseSourceId(source.characterId, 'characterId')
    const editionId = parseSourceId(source.editionId, 'editionId')
    if (!/^\d{1,8}$/u.test(characterId) || !/^\d{1,16}$/u.test(editionId)) {
      recipeError('STRR source ID는 숫자 식별자여야 합니다.')
    }
    if (!editionId.startsWith(characterId)) {
      recipeError('STRR edition ID는 character ID로 시작해야 합니다.')
    }
    return {
      provider,
      characterId,
      editionId,
    }
  }
  recipeError(
    `source.provider는 ${CODEX_PET_RECIPE_PROVIDERS.join(', ')} 중 하나여야 합니다.`,
  )
}

function parsePet(value: unknown): CodexPetRecipePet {
  const pet = assertRecord(value, 'pet')
  assertNoForbiddenBinaryKeys(pet)
  assertKnownKeys(pet, PET_KEYS, 'pet')
  return {
    displayName: parseTrimmedString(pet.displayName, 'pet.displayName', 80),
    description: parseDescription(pet.description),
    framingOffsetX: parseFramingOffset(pet.framingOffsetX, 'X'),
    framingOffsetY: parseFramingOffset(pet.framingOffsetY, 'Y'),
    framingScale: parseFramingScale(pet.framingScale),
    lookMovementScale: parseLookMovementScale(pet.lookMovementScale),
  }
}

function parseMapping(value: unknown, stateId: CodexPetStateId) {
  const mapping = assertRecord(value, `mappings.${stateId}`)
  assertNoForbiddenBinaryKeys(mapping)
  assertKnownKeys(mapping, MAPPING_KEYS, `mappings.${stateId}`)
  return {
    animationName: parseTrimmedString(
      mapping.animationName,
      `mappings.${stateId}.animationName`,
      128,
    ),
    mirrorX: parseOptionalBoolean(
      mapping.mirrorX,
      `mappings.${stateId}.mirrorX`,
    ),
  }
}

function parseMappings(value: unknown): CodexPetAnimationMappings {
  const mappings = assertRecord(value, 'mappings')
  assertNoForbiddenBinaryKeys(mappings)
  const allowedStateIds = new Set(CODEX_PET_STATES.map((state) => state.id))
  for (const key of Object.keys(mappings)) {
    if (!allowedStateIds.has(key as CodexPetStateId)) {
      recipeError(`mappings에 알 수 없는 상태가 있습니다: ${key}`)
    }
  }

  const parsed = {} as CodexPetAnimationMappings
  for (const state of CODEX_PET_STATES) {
    parsed[state.id] = parseMapping(mappings[state.id], state.id)
  }
  return parsed
}

export function createCodexPetRecipe(input: {
  readonly source: CodexPetRecipeSource
  readonly pet: {
    readonly displayName: string
    readonly description?: string
    readonly framingOffsetX?: number
    readonly framingOffsetY?: number
    readonly framingScale?: number
    readonly lookMovementScale?: number
  }
  readonly mappings: CodexPetAnimationMappings
  readonly globalMirrorX?: boolean
}): CodexPetRecipe {
  return parseCodexPetRecipe({
    schemaVersion: CODEX_PET_RECIPE_SCHEMA_VERSION,
    kind: CODEX_PET_RECIPE_KIND,
    renderer: CODEX_PET_RECIPE_RENDERER,
    globalMirrorX: input.globalMirrorX ?? false,
    source: input.source,
    pet: {
      displayName: input.pet.displayName,
      description: input.pet.description ?? '',
      framingOffsetX:
        input.pet.framingOffsetX ?? LIVE_SD_FRAMING_OFFSET_DEFAULT.x,
      framingOffsetY:
        input.pet.framingOffsetY ?? LIVE_SD_FRAMING_OFFSET_DEFAULT.y,
      framingScale: input.pet.framingScale ?? LIVE_SD_FRAMING_SCALE_DEFAULT,
      lookMovementScale:
        input.pet.lookMovementScale ?? CODEX_PET_LOOK_MOVEMENT_SCALE_DEFAULT,
    },
    mappings: input.mappings,
  })
}

export function parseCodexPetRecipe(value: unknown): CodexPetRecipe {
  const recipe = assertRecord(value, 'recipe')
  assertNoForbiddenBinaryKeys(recipe)
  assertKnownKeys(recipe, RECIPE_KEYS, 'recipe')
  if (recipe.schemaVersion !== CODEX_PET_RECIPE_SCHEMA_VERSION) {
    recipeError('지원하지 않는 recipe schemaVersion입니다.')
  }
  if (recipe.kind !== CODEX_PET_RECIPE_KIND) {
    recipeError('지원하지 않는 recipe kind입니다.')
  }
  if (recipe.renderer !== CODEX_PET_RECIPE_RENDERER) {
    recipeError('지원하지 않는 recipe renderer입니다.')
  }

  return {
    schemaVersion: CODEX_PET_RECIPE_SCHEMA_VERSION,
    kind: CODEX_PET_RECIPE_KIND,
    renderer: CODEX_PET_RECIPE_RENDERER,
    globalMirrorX: parseOptionalBoolean(
      recipe.globalMirrorX,
      'globalMirrorX',
    ),
    source: parseCodexPetRecipeSource(recipe.source),
    pet: parsePet(recipe.pet),
    mappings: parseMappings(recipe.mappings),
  }
}

export function encodeCodexPetRecipe(recipe: CodexPetRecipe): string {
  const bytes = new TextEncoder().encode(JSON.stringify(parseCodexPetRecipe(recipe)))
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

export function decodeCodexPetRecipe(encoded: string): CodexPetRecipe {
  const normalized = encoded.trim()
  if (!normalized) {
    recipeError('recipe 값이 비어 있습니다.')
  }

  if (normalized.startsWith('{')) {
    try {
      return parseCodexPetRecipe(JSON.parse(normalized))
    } catch (error) {
      if (error instanceof CodexPetRecipeError) {
        throw error
      }
      recipeError('recipe JSON을 해석할 수 없습니다.')
    }
  }

  const padded = normalized
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    recipeError('recipe는 base64url JSON이어야 합니다.')
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  try {
    return parseCodexPetRecipe(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    )
  } catch (error) {
    if (error instanceof CodexPetRecipeError) {
      throw error
    }
    recipeError('recipe JSON을 해석할 수 없습니다.')
  }
}

export function formatCodexPetRecipeInstallCommand(
  recipe: CodexPetRecipe,
): string {
  return `npx -y ${CODEX_PET_CLI_PACKAGE} install --recipe ${encodeCodexPetRecipe(recipe)}`
}
