import { PrskArchiveImportError } from './errors'
import {
  isLiveSDModelError,
  resolveAtlasPagePath as resolveLiveSDAtlasPagePath,
} from '../../model'

const DRIVE_LETTER_PATH = /^[a-zA-Z]:/

function assertRelativePath(rawPath: string): string {
  if (rawPath.includes('\0')) {
    throw new PrskArchiveImportError(
      'ARCHIVE_UNSAFE_PATH',
      'NUL 문자가 포함된 아카이브 경로는 사용할 수 없습니다.',
      { path: rawPath },
    )
  }

  const slashPath = rawPath.replaceAll('\\', '/')

  if (slashPath.startsWith('/') || DRIVE_LETTER_PATH.test(slashPath)) {
    throw new PrskArchiveImportError(
      'ARCHIVE_UNSAFE_PATH',
      `절대 아카이브 경로는 사용할 수 없습니다: ${rawPath}`,
      { path: rawPath },
    )
  }

  return slashPath
}

export function normalizeArchivePath(rawPath: string): string {
  const slashPath = assertRelativePath(rawPath)
  const segments: string[] = []

  for (const segment of slashPath.split('/')) {
    if (segment === '' || segment === '.') {
      continue
    }

    if (segment === '..') {
      if (segments.length === 0) {
        throw new PrskArchiveImportError(
          'ARCHIVE_UNSAFE_PATH',
          `아카이브 루트 밖을 가리키는 경로입니다: ${rawPath}`,
          { path: rawPath },
        )
      }

      segments.pop()
      continue
    }

    segments.push(segment)
  }

  if (segments.length === 0) {
    throw new PrskArchiveImportError(
      'ARCHIVE_UNSAFE_PATH',
      `비어 있는 아카이브 경로는 사용할 수 없습니다: ${rawPath}`,
      { path: rawPath },
    )
  }

  return segments.join('/')
}

export function archiveBasename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function resolveAtlasPagePath(
  atlasPath: string,
  rawPagePath: string,
): string {
  try {
    return resolveLiveSDAtlasPagePath(atlasPath, rawPagePath)
  } catch (error) {
    if (isLiveSDModelError(error)) {
      throw new PrskArchiveImportError(
        'ARCHIVE_UNSAFE_PATH',
        `atlas가 안전하지 않은 페이지 경로를 참조합니다: ${rawPagePath}`,
        { cause: error, path: rawPagePath },
      )
    }
    throw error
  }
}
