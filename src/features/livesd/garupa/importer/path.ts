import { GarupaPackImportError } from './errors'

const DRIVE_PATH = /^[A-Za-z]:/u

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
  })
}

export interface NormalizeGarupaPackPathOptions {
  readonly directory?: boolean
}

export function normalizeGarupaPackPath(
  rawPath: string,
  options: NormalizeGarupaPackPathOptions = {},
): string {
  if (
    rawPath.length === 0 ||
    hasControlCharacter(rawPath) ||
    rawPath.includes('\\') ||
    rawPath.startsWith('/') ||
    DRIVE_PATH.test(rawPath)
  ) {
    throw new GarupaPackImportError(
      'GARUPA_PACK_UNSAFE_PATH',
      'Garupa pack 경로는 제어 문자, 역슬래시 또는 절대 경로를 포함할 수 없습니다.',
      { path: rawPath },
    )
  }

  let path = rawPath
  if (options.directory && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  const segments = path.split('/')
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 || segment === '.' || segment === '..',
    )
  ) {
    throw new GarupaPackImportError(
      'GARUPA_PACK_UNSAFE_PATH',
      'Garupa pack 경로는 빈 segment 또는 점 segment를 포함할 수 없습니다.',
      { path: rawPath },
    )
  }

  return segments.map((segment) => segment.normalize('NFC')).join('/')
}

export function garupaPathCollisionKey(path: string): string {
  return path.normalize('NFC').toLocaleLowerCase('en-US')
}

export function garupaPathBasename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}
