export const CODEX_PET_SPRITE_VERSION = 2 as const
export const CODEX_PET_SPRITESHEET_FILENAME = 'spritesheet.png' as const

export interface CodexPetMetadataInput {
  readonly description?: string
  readonly displayName: string
}

export interface NormalizedCodexPetMetadata {
  readonly description: string
  readonly displayName: string
  readonly id: string
}

export interface CodexPetManifest extends NormalizedCodexPetMetadata {
  readonly spriteVersionNumber: typeof CODEX_PET_SPRITE_VERSION
  readonly spritesheetPath: typeof CODEX_PET_SPRITESHEET_FILENAME
}

export type CodexPetManifestErrorCode =
  | 'DISPLAY_NAME_REQUIRED'
  | 'PET_ID_INVALID'

export class CodexPetManifestError extends Error {
  readonly code: CodexPetManifestErrorCode

  constructor(code: CodexPetManifestErrorCode, message: string) {
    super(message)
    this.name = 'CodexPetManifestError'
    this.code = code
  }
}

const SAFE_PET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COMBINING_MARK = /\p{Mark}/u
const UNICODE_LETTER_OR_NUMBER = /[\p{Letter}\p{Number}]/u

function pushSeparator(parts: string[]): void {
  if (parts.length > 0 && parts.at(-1) !== '-') {
    parts.push('-')
  }
}

/**
 * Creates an ASCII-only path segment. Non-ASCII letters and numbers are
 * represented by their Unicode code point so Korean display names remain
 * exportable without introducing locale-dependent transliteration.
 */
export function slugifyCodexPetId(displayName: string): string {
  const parts: string[] = []

  for (const character of displayName.normalize('NFKD').toLowerCase()) {
    if (COMBINING_MARK.test(character)) {
      continue
    }

    if (/^[a-z0-9]$/.test(character)) {
      parts.push(character)
      continue
    }

    if (UNICODE_LETTER_OR_NUMBER.test(character)) {
      pushSeparator(parts)
      parts.push('u' + character.codePointAt(0)!.toString(16))
      pushSeparator(parts)
      continue
    }

    pushSeparator(parts)
  }

  return parts.join('').replace(/^-+|-+$/g, '')
}

export function isSafeCodexPetId(value: string): boolean {
  return SAFE_PET_ID.test(value)
}

export function normalizeCodexPetMetadata(
  metadata: CodexPetMetadataInput,
): NormalizedCodexPetMetadata {
  const displayName = metadata.displayName.trim()

  if (!displayName) {
    throw new CodexPetManifestError(
      'DISPLAY_NAME_REQUIRED',
      'Pet 이름을 입력해 주세요.',
    )
  }

  const id = slugifyCodexPetId(displayName)
  if (!isSafeCodexPetId(id)) {
    throw new CodexPetManifestError(
      'PET_ID_INVALID',
      'Pet 이름에서 안전한 영문·숫자 id를 만들 수 없습니다.',
    )
  }

  return {
    description: metadata.description?.trim() ?? '',
    displayName,
    id,
  }
}

export function createCodexPetManifest(
  metadata: CodexPetMetadataInput,
): CodexPetManifest {
  return {
    ...normalizeCodexPetMetadata(metadata),
    spriteVersionNumber: CODEX_PET_SPRITE_VERSION,
    spritesheetPath: CODEX_PET_SPRITESHEET_FILENAME,
  }
}

export function serializeCodexPetManifest(
  manifest: CodexPetManifest,
): string {
  return JSON.stringify(manifest, null, 2) + '\n'
}
