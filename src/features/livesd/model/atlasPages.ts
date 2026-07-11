import { LiveSDModelError } from './errors'

const PAGE_PROPERTY = /^(?:size|format|filter|repeat|pma):/i

/** Reads only page headers from a Spine 3.6 atlas. */
export function readAtlasPageReferences(atlasText: string): readonly string[] {
  const lines = atlasText
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
  const pageReferences: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const candidate = line.trim()

    if (!candidate || /^\s/.test(line) || PAGE_PROPERTY.test(candidate)) {
      continue
    }

    let nextIndex = index + 1
    while (nextIndex < lines.length && !(lines[nextIndex] ?? '').trim()) {
      nextIndex += 1
    }

    const nextLine = lines[nextIndex] ?? ''
    if (nextLine && !/^\s/.test(nextLine) && PAGE_PROPERTY.test(nextLine)) {
      pageReferences.push(candidate)
    }
  }

  if (pageReferences.length === 0) {
    throw new LiveSDModelError(
      'ATLAS_PAGE_LIST_EMPTY',
      'LiveSD atlas에서 이미지 페이지를 찾을 수 없습니다.',
    )
  }

  return pageReferences
}
