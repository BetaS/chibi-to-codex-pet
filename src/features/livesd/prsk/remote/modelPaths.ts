import { resolveAtlasPagePath } from '../../model'
import { PrskRemoteError } from './errors'
import { validatePrskAssetBaseUrl } from './provider'
import {
  PRSK_REMOTE_LIMITS,
  type PrskRemoteCatalog,
} from './types'

export interface PrskRemoteModelUrls {
  readonly skeletonUrl: string
  readonly atlasUrl: string
  readonly characterRootUrl: string
}

export interface PrskRemoteAtlasPage {
  readonly path: string
  readonly url: string
}

export function buildPrskRemoteModelUrls(
  catalog: PrskRemoteCatalog,
  characterId: string,
): PrskRemoteModelUrls {
  const normalizedAssetBaseUrl = validatePrskAssetBaseUrl(catalog.assetBaseUrl)
  if (normalizedAssetBaseUrl !== catalog.assetBaseUrl) {
    throw new PrskRemoteError(
      'REMOTE_ASSET_URL_INVALID',
      'catalog의 asset base URL은 정규화된 canonical URL이어야 합니다.',
      { url: catalog.assetBaseUrl },
    )
  }

  const selectedOption = catalog.characters.find(
    (option) => option.id === characterId,
  )
  if (
    !selectedOption ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(selectedOption.id)
  ) {
    throw new PrskRemoteError(
      'REMOTE_SELECTION_INVALID',
      '현재 catalog에 없는 캐릭터는 불러올 수 없습니다.',
      { path: characterId },
    )
  }

  const characterRootUrl = `${normalizedAssetBaseUrl}/${characterId}/`
  return {
    skeletonUrl: `${normalizedAssetBaseUrl}/base_model/sekai_skeleton.skel`,
    atlasUrl: `${characterRootUrl}sekai_atlas.atlas`,
    characterRootUrl,
  }
}

function unsafePage(path: string, cause?: unknown): never {
  throw new PrskRemoteError(
    'REMOTE_ATLAS_PAGE_UNSAFE',
    `안전하지 않은 원격 atlas 페이지 경로입니다: ${path}`,
    cause === undefined ? { path } : { cause, path },
  )
}

export function resolvePrskRemoteAtlasPages(
  urls: PrskRemoteModelUrls,
  pageReferences: readonly string[],
): readonly PrskRemoteAtlasPage[] {
  const root = new URL(urls.characterRootUrl)
  const assetOrigin = new URL(urls.skeletonUrl).origin
  const seen = new Set<string>()
  const pages: PrskRemoteAtlasPage[] = []

  for (const reference of pageReferences) {
    const slashReference = reference.replaceAll('\\', '/')
    if (
      slashReference.startsWith('//') ||
      /^[A-Za-z][A-Za-z\d+.-]*:/.test(slashReference)
    ) {
      unsafePage(reference)
    }

    let path: string
    try {
      path = resolveAtlasPagePath('sekai_atlas.atlas', reference)
    } catch (error) {
      unsafePage(reference, error)
    }

    if (!path.toLocaleLowerCase('en-US').endsWith('.png')) {
      unsafePage(reference)
    }
    if (seen.has(path)) {
      unsafePage(reference)
    }
    seen.add(path)

    if (seen.size > PRSK_REMOTE_LIMITS.pngPages) {
      throw new PrskRemoteError(
        'REMOTE_ATLAS_PAGE_LIMIT_EXCEEDED',
        `원격 atlas는 PNG를 최대 ${PRSK_REMOTE_LIMITS.pngPages}개까지 참조할 수 있습니다.`,
        { resource: 'atlas' },
      )
    }

    const encodedPath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    const pageUrl = new URL(encodedPath, root)
    if (
      pageUrl.origin !== assetOrigin ||
      !pageUrl.pathname.startsWith(root.pathname)
    ) {
      unsafePage(reference)
    }

    pages.push({ path, url: pageUrl.toString() })
  }

  return pages
}
