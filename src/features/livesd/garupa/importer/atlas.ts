import { GarupaPackImportError } from './errors'
import {
  garupaPathCollisionKey,
  normalizeGarupaPackPath,
} from './path'

const PAGE_PROPERTY = /^(size|format|filter|repeat|pma|scale)\s*:(.*)$/iu
const PMA_PROPERTY = /^\s*pma\s*:\s*(\S+)\s*$/iu

export interface GarupaAtlasPage {
  readonly path: string
  readonly reference: string
}

export interface GarupaAtlasDescription {
  readonly alphaMode: 'straight'
  readonly pages: readonly GarupaAtlasPage[]
}

function atlasInvalid(message: string, path?: string): never {
  throw new GarupaPackImportError('GARUPA_ATLAS_INVALID', message, { path })
}

function resolvePagePath(atlasPath: string, reference: string): string {
  const normalizedReference = normalizeGarupaPackPath(reference)
  const separator = atlasPath.lastIndexOf('/')
  const atlasDirectory = atlasPath.slice(0, separator)
  const path = normalizeGarupaPackPath(
    `${atlasDirectory}/${normalizedReference}`,
  )

  if (!path.startsWith(`${atlasDirectory}/`)) {
    throw new GarupaPackImportError(
      'GARUPA_PACK_UNSAFE_PATH',
      'atlas page는 atlas directory 안의 상대 경로여야 합니다.',
      { path: reference },
    )
  }
  return path
}

export function parseGarupaAtlas(
  atlasText: string,
  atlasPath: string,
): GarupaAtlasDescription {
  const lines = atlasText
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
  const pages: GarupaAtlasPage[] = []
  const pageKeys = new Set<string>()

  for (const line of lines) {
    const pma = PMA_PROPERTY.exec(line)
    if (!pma) continue
    const value = pma[1]?.toLocaleLowerCase('en-US')
    if (value === 'true') {
      throw new GarupaPackImportError(
        'GARUPA_ALPHA_MODE_UNSUPPORTED',
        'Garupa atlas의 pma: true는 지원하지 않습니다.',
      )
    }
    if (value !== 'false') {
      atlasInvalid('atlas pma 값은 false여야 합니다.')
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? ''
    const candidate = rawLine.trim()
    if (!candidate || /^\s/u.test(rawLine) || PAGE_PROPERTY.test(candidate)) {
      continue
    }

    let propertyIndex = index + 1
    while (propertyIndex < lines.length && !(lines[propertyIndex] ?? '').trim()) {
      propertyIndex += 1
    }
    const firstPropertyLine = lines[propertyIndex] ?? ''
    if (
      !firstPropertyLine ||
      /^\s/u.test(firstPropertyLine) ||
      !PAGE_PROPERTY.test(firstPropertyLine.trim())
    ) {
      continue
    }

    if (!candidate.toLocaleLowerCase('en-US').endsWith('.png')) {
      atlasInvalid('atlas page는 PNG 확장자를 사용해야 합니다.', candidate)
    }
    if (rawLine !== candidate) {
      throw new GarupaPackImportError(
        'GARUPA_PACK_UNSAFE_PATH',
        'atlas page 경로는 앞뒤 공백 없는 canonical path여야 합니다.',
        { path: candidate },
      )
    }

    let pmaValue: string | undefined
    for (
      let headerIndex = propertyIndex;
      headerIndex < lines.length;
      headerIndex += 1
    ) {
      const headerLine = lines[headerIndex] ?? ''
      if (!headerLine.trim() || /^\s/u.test(headerLine)) break

      const property = PAGE_PROPERTY.exec(headerLine.trim())
      if (!property) break
      if (property[1]?.toLocaleLowerCase('en-US') !== 'pma') continue
      if (pmaValue !== undefined) {
        atlasInvalid('atlas page에 pma가 중복 선언되었습니다.', candidate)
      }
      pmaValue = property[2]?.trim().toLocaleLowerCase('en-US')
    }

    if (pmaValue === 'true') {
      throw new GarupaPackImportError(
        'GARUPA_ALPHA_MODE_UNSUPPORTED',
        'Garupa atlas의 pma: true는 지원하지 않습니다.',
        { path: candidate },
      )
    }
    if (pmaValue !== undefined && pmaValue !== 'false') {
      atlasInvalid('atlas pma 값은 false여야 합니다.', candidate)
    }

    const path = resolvePagePath(atlasPath, candidate)
    const collisionKey = garupaPathCollisionKey(path)
    if (pageKeys.has(collisionKey)) {
      atlasInvalid('atlas가 같은 page를 중복 참조합니다.', path)
    }
    pageKeys.add(collisionKey)
    pages.push(Object.freeze({ path, reference: candidate }))
  }

  if (pages.length === 0) {
    atlasInvalid('atlas에서 texture page를 찾을 수 없습니다.', atlasPath)
  }

  return Object.freeze({
    alphaMode: 'straight',
    pages: Object.freeze(pages),
  })
}
