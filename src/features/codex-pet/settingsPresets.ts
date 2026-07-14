import type { CodexPetAnimationMappings } from './animationMapping'
import { CODEX_PET_STATES } from './contract'
import {
  CODEX_PET_LOOK_MOVEMENT_SCALE_MAX,
  CODEX_PET_LOOK_MOVEMENT_SCALE_MIN,
} from './lookMovementScale'
import {
  LIVE_SD_FRAMING_OFFSET_X_MAX,
  LIVE_SD_FRAMING_OFFSET_X_MIN,
  LIVE_SD_FRAMING_OFFSET_Y_MAX,
  LIVE_SD_FRAMING_OFFSET_Y_MIN,
  type LiveSDFramingOffset,
} from '../livesd/rendering/framingOffset'
import {
  LIVE_SD_FRAMING_SCALE_MAX,
  LIVE_SD_FRAMING_SCALE_MIN,
} from '../livesd/rendering/framingScale'
import {
  parseCodexPetRecipeSource,
  type CodexPetRecipeSource,
} from './recipe'

export type CodexPetSettingsPresetRuntime = 'garupa' | 'prsk' | 'strr'

export const CODEX_PET_SETTINGS_PRESET_LEGACY_STORAGE_KEY =
  'chibi-to-codex-pet.pet-presets.v1'
export const CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS = Object.freeze({
  garupa: 'chibi-to-codex-pet.pet-presets.garupa.v1',
  prsk: 'chibi-to-codex-pet.pet-presets.prsk.v1',
  strr: 'chibi-to-codex-pet.pet-presets.strr.v1',
} satisfies Readonly<Record<CodexPetSettingsPresetRuntime, string>>)
export const CODEX_PET_SETTINGS_PRESET_STORAGE_KEY =
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS.prsk
export const CODEX_PET_SETTINGS_PRESET_VERSION = 1
export const CODEX_PET_SETTINGS_PRESET_LIMIT = 20

const PET_NAME_MAX_LENGTH = 80
const PET_DESCRIPTION_MAX_LENGTH = 280
const ANIMATION_NAME_MAX_LENGTH = 512
const PRESET_SOURCE_ID_MAX_LENGTH = 128

export interface CodexPetSettingsPresetGarupaPinnedSource {
  readonly provider: 'garupa-pinned'
  readonly sdAssetBundleName: string
}

export type CodexPetSettingsPresetSource =
  | CodexPetRecipeSource
  | CodexPetSettingsPresetGarupaPinnedSource

export interface CodexPetSettingsPreset {
  readonly description: string
  readonly displayName: string
  readonly framingOffset: LiveSDFramingOffset
  readonly framingScale: number
  readonly globalMirrorX: boolean
  readonly lookMovementScale: number
  readonly mappings: CodexPetAnimationMappings
  readonly source: CodexPetSettingsPresetSource | null
  readonly updatedAt: number
}

export interface CodexPetSettingsPresetInput {
  readonly description: string
  readonly displayName: string
  readonly framingOffset: LiveSDFramingOffset
  readonly framingScale: number
  readonly globalMirrorX: boolean
  readonly lookMovementScale: number
  readonly mappings: Readonly<CodexPetAnimationMappings>
  readonly source?: CodexPetSettingsPresetSource | null
}

export interface CodexPetSettingsPresetCatalog {
  readonly activePresetName: string | null
  readonly presets: Readonly<Record<string, CodexPetSettingsPreset>>
  readonly version: typeof CODEX_PET_SETTINGS_PRESET_VERSION
}

export interface CodexPetSettingsPresetStorage {
  readonly getItem: (key: string) => string | null
  readonly removeItem: (key: string) => void
  readonly setItem: (key: string, value: string) => void
}

function createEmptyCatalog(): CodexPetSettingsPresetCatalog {
  return {
    activePresetName: null,
    presets: {},
    version: CODEX_PET_SETTINGS_PRESET_VERSION,
  }
}

function browserStorage(): CodexPetSettingsPresetStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function parseBoundedString(
  value: unknown,
  maximumLength: number,
  allowEmpty = true,
): string {
  if (
    typeof value !== 'string' ||
    value.length > maximumLength ||
    (!allowEmpty && value.trim().length === 0)
  ) {
    throw new TypeError('Invalid preset string value.')
  }
  return value
}

function parseNumberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  integer = false,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new TypeError('Invalid preset number value.')
  }
  return value
}

function parseMappings(value: unknown): CodexPetAnimationMappings {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, CODEX_PET_STATES.map(({ id }) => id)) ||
    Object.keys(value).length !== CODEX_PET_STATES.length
  ) {
    throw new TypeError('Invalid preset mappings.')
  }

  return Object.fromEntries(
    CODEX_PET_STATES.map(({ id }) => {
      const mapping = value[id]
      if (
        !isRecord(mapping) ||
        !hasOnlyKeys(mapping, ['animationName', 'mirrorX']) ||
        typeof mapping.mirrorX !== 'boolean'
      ) {
        throw new TypeError(`Invalid preset mapping for ${id}.`)
      }
      return [
        id,
        {
          animationName: parseBoundedString(
            mapping.animationName,
            ANIMATION_NAME_MAX_LENGTH,
            false,
          ),
          mirrorX: mapping.mirrorX,
        },
      ]
    }),
  ) as CodexPetAnimationMappings
}

function parsePresetSource(value: unknown): CodexPetSettingsPresetSource {
  if (isRecord(value) && value.provider === 'garupa-pinned') {
    if (!hasOnlyKeys(value, ['provider', 'sdAssetBundleName'])) {
      throw new TypeError('Invalid Garupa preset source.')
    }
    const sdAssetBundleName = parseBoundedString(
      value.sdAssetBundleName,
      PRESET_SOURCE_ID_MAX_LENGTH,
      false,
    ).trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(sdAssetBundleName)) {
      throw new TypeError('Invalid Garupa preset bundle name.')
    }
    return { provider: 'garupa-pinned', sdAssetBundleName }
  }
  return parseCodexPetRecipeSource(value)
}

function presetSourceBelongsToRuntime(
  source: CodexPetSettingsPresetSource | null,
  runtime: CodexPetSettingsPresetRuntime,
): boolean {
  if (source === null) {
    return true
  }
  if (runtime === 'prsk') {
    return source.provider === 'custom' || source.provider === 'prsk-chibi-viewer'
  }
  if (runtime === 'strr') {
    return source.provider === 'strr-res-pak'
  }
  return source.provider === 'garupa-pinned'
}

function parsePreset(value: unknown, key: string): CodexPetSettingsPreset {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'description',
      'displayName',
      'framingOffset',
      'framingScale',
      'globalMirrorX',
      'lookMovementScale',
      'mappings',
      'source',
      'updatedAt',
    ])
  ) {
    throw new TypeError('Invalid preset.')
  }

  const displayName = parseBoundedString(
    value.displayName,
    PET_NAME_MAX_LENGTH,
    false,
  ).trim()
  if (displayName !== key || key.length > PET_NAME_MAX_LENGTH) {
    throw new TypeError('Preset key and display name must match.')
  }
  if (
    !isRecord(value.framingOffset) ||
    !hasOnlyKeys(value.framingOffset, ['x', 'y'])
  ) {
    throw new TypeError('Invalid framing offset.')
  }
  if (typeof value.globalMirrorX !== 'boolean') {
    throw new TypeError('Invalid global mirror value.')
  }

  return {
    description: parseBoundedString(
      value.description,
      PET_DESCRIPTION_MAX_LENGTH,
    ),
    displayName,
    framingOffset: {
      x: parseNumberInRange(
        value.framingOffset.x,
        LIVE_SD_FRAMING_OFFSET_X_MIN,
        LIVE_SD_FRAMING_OFFSET_X_MAX,
        true,
      ),
      y: parseNumberInRange(
        value.framingOffset.y,
        LIVE_SD_FRAMING_OFFSET_Y_MIN,
        LIVE_SD_FRAMING_OFFSET_Y_MAX,
        true,
      ),
    },
    framingScale: parseNumberInRange(
      value.framingScale,
      LIVE_SD_FRAMING_SCALE_MIN,
      LIVE_SD_FRAMING_SCALE_MAX,
    ),
    globalMirrorX: value.globalMirrorX,
    lookMovementScale: parseNumberInRange(
      value.lookMovementScale,
      CODEX_PET_LOOK_MOVEMENT_SCALE_MIN,
      CODEX_PET_LOOK_MOVEMENT_SCALE_MAX,
    ),
    mappings: parseMappings(value.mappings),
    source:
      value.source === undefined || value.source === null
        ? null
        : parsePresetSource(value.source),
    updatedAt: parseNumberInRange(
      value.updatedAt,
      0,
      Number.MAX_SAFE_INTEGER,
      true,
    ),
  }
}

export function parseCodexPetSettingsPresetCatalog(
  value: unknown,
): CodexPetSettingsPresetCatalog {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['activePresetName', 'presets', 'version']) ||
    value.version !== CODEX_PET_SETTINGS_PRESET_VERSION ||
    !isRecord(value.presets) ||
    (value.activePresetName !== null &&
      typeof value.activePresetName !== 'string')
  ) {
    throw new TypeError('Invalid preset catalog.')
  }

  const entries = Object.entries(value.presets)
    .map(([key, preset]) => [key, parsePreset(preset, key)] as const)
    .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
    .slice(0, CODEX_PET_SETTINGS_PRESET_LIMIT)
  const presets = Object.fromEntries(entries)
  const activePresetName = value.activePresetName

  return {
    activePresetName:
      activePresetName !== null && presets[activePresetName]
        ? activePresetName
        : null,
    presets,
    version: CODEX_PET_SETTINGS_PRESET_VERSION,
  }
}

export function readCodexPetSettingsPresetCatalog(
  storage: CodexPetSettingsPresetStorage | null = browserStorage(),
  runtime: CodexPetSettingsPresetRuntime = 'prsk',
): CodexPetSettingsPresetCatalog {
  if (!storage) {
    return createEmptyCatalog()
  }

  const storageKey = CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS[runtime]
  try {
    const stored = storage.getItem(storageKey)
    if (stored === null) {
      const legacyStored = storage.getItem(
        CODEX_PET_SETTINGS_PRESET_LEGACY_STORAGE_KEY,
      )
      if (legacyStored === null) {
        return createEmptyCatalog()
      }
      const legacyCatalog = parseCodexPetSettingsPresetCatalog(
        JSON.parse(legacyStored),
      )
      const migratedPresets = Object.fromEntries(
        Object.entries(legacyCatalog.presets).filter(([, preset]) =>
          preset.source === null
            ? runtime === 'prsk'
            : presetSourceBelongsToRuntime(preset.source, runtime),
        ),
      )
      const migrated: CodexPetSettingsPresetCatalog = {
        activePresetName:
          legacyCatalog.activePresetName &&
          migratedPresets[legacyCatalog.activePresetName]
            ? legacyCatalog.activePresetName
            : null,
        presets: migratedPresets,
        version: CODEX_PET_SETTINGS_PRESET_VERSION,
      }
      writeCatalog(migrated, storage, runtime)
      return migrated
    }
    const parsed = parseCodexPetSettingsPresetCatalog(JSON.parse(stored))
    if (
      Object.values(parsed.presets).some(
        (preset) => !presetSourceBelongsToRuntime(preset.source, runtime),
      )
    ) {
      throw new TypeError('Preset source does not belong to this runtime.')
    }
    return parsed
  } catch {
    try {
      storage.removeItem(storageKey)
    } catch {
      // A blocked storage must not interrupt the current builder session.
    }
    const emptyCatalog = createEmptyCatalog()
    writeCatalog(emptyCatalog, storage, runtime)
    return emptyCatalog
  }
}

function writeCatalog(
  catalog: CodexPetSettingsPresetCatalog,
  storage: CodexPetSettingsPresetStorage | null,
  runtime: CodexPetSettingsPresetRuntime,
): void {
  if (!storage) {
    return
  }
  try {
    storage.setItem(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEYS[runtime],
      JSON.stringify(catalog),
    )
  } catch {
    // Keep the successfully built package and in-memory selection usable.
  }
}

export function saveCodexPetSettingsPreset(
  input: CodexPetSettingsPresetInput,
  storage: CodexPetSettingsPresetStorage | null = browserStorage(),
  updatedAt = Date.now(),
  runtime: CodexPetSettingsPresetRuntime = 'prsk',
): CodexPetSettingsPresetCatalog {
  const displayName = input.displayName.trim()
  const preset = parsePreset(
    {
      ...input,
      displayName,
      mappings: Object.fromEntries(
        CODEX_PET_STATES.map(({ id }) => [id, { ...input.mappings[id] }]),
      ),
      source: input.source ?? null,
      updatedAt,
    },
    displayName,
  )
  if (!presetSourceBelongsToRuntime(preset.source, runtime)) {
    throw new TypeError('Preset source does not belong to this runtime.')
  }
  const current = readCodexPetSettingsPresetCatalog(storage, runtime)
  const nextEntries = [
    [displayName, preset] as const,
    ...Object.entries(current.presets).filter(
      ([presetName]) => presetName !== displayName,
    ),
  ]
    .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
    .slice(0, CODEX_PET_SETTINGS_PRESET_LIMIT)
  const next: CodexPetSettingsPresetCatalog = {
    activePresetName: displayName,
    presets: Object.fromEntries(nextEntries),
    version: CODEX_PET_SETTINGS_PRESET_VERSION,
  }
  writeCatalog(next, storage, runtime)
  return next
}

export function selectCodexPetSettingsPreset(
  presetName: string | null,
  storage: CodexPetSettingsPresetStorage | null = browserStorage(),
  runtime: CodexPetSettingsPresetRuntime = 'prsk',
): CodexPetSettingsPresetCatalog {
  const current = readCodexPetSettingsPresetCatalog(storage, runtime)
  const activePresetName =
    presetName !== null && current.presets[presetName]
      ? presetName
      : null
  const next = { ...current, activePresetName }
  writeCatalog(next, storage, runtime)
  return next
}

export function applyCodexPetSettingsPresetMappings(
  preset: CodexPetSettingsPreset,
  animations: readonly string[],
  recommendedMappings: Readonly<CodexPetAnimationMappings>,
): CodexPetAnimationMappings {
  const availableAnimations = new Set(animations)
  return Object.fromEntries(
    CODEX_PET_STATES.map(({ id }) => {
      const savedMapping = preset.mappings[id]
      return [
        id,
        availableAnimations.has(savedMapping.animationName)
          ? { ...savedMapping }
          : { ...recommendedMappings[id] },
      ]
    }),
  ) as CodexPetAnimationMappings
}
