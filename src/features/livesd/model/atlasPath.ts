import { LiveSDModelError } from './errors'

const DRIVE_LETTER_PATH = /^[a-zA-Z]:/

function normalizeRelativePath(rawPath: string): string {
  const slashPath = rawPath.replaceAll('\\', '/')
  if (
    rawPath.includes('\0') ||
    slashPath.startsWith('/') ||
    DRIVE_LETTER_PATH.test(slashPath)
  ) {
    throw new LiveSDModelError(
      'ATLAS_PAGE_PATH_INVALID',
      `LiveSD atlas 페이지 경로는 안전한 상대 경로여야 합니다: ${rawPath}`,
      { path: rawPath },
    )
  }

  const segments: string[] = []
  for (const segment of slashPath.split('/')) {
    if (segment === '' || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (segments.length === 0) {
        throw new LiveSDModelError(
          'ATLAS_PAGE_PATH_INVALID',
          `LiveSD atlas 페이지가 source root 밖을 가리킵니다: ${rawPath}`,
          { path: rawPath },
        )
      }
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  if (segments.length === 0) {
    throw new LiveSDModelError(
      'ATLAS_PAGE_PATH_INVALID',
      `LiveSD atlas 페이지 경로가 비어 있습니다: ${rawPath}`,
      { path: rawPath },
    )
  }
  return segments.join('/')
}

export function resolveAtlasPagePath(
  atlasPath: string,
  rawPagePath: string,
): string {
  const separatorIndex = atlasPath.lastIndexOf('/')
  const atlasDirectory =
    separatorIndex === -1 ? '' : atlasPath.slice(0, separatorIndex)
  const combinedPath = atlasDirectory
    ? `${atlasDirectory}/${rawPagePath}`
    : rawPagePath

  return normalizeRelativePath(combinedPath)
}
