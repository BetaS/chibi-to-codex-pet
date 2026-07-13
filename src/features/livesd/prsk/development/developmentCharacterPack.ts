import {
  PrskArchiveImportError,
  readAtlasPageReferences,
  resolveAtlasPagePath,
  type LiveSDAtlasBundle,
} from '../archive'

export const DEVELOPMENT_CHARACTER_NAME = 'sd_mob003'
export const DEVELOPMENT_CHARACTER_ROOT =
  `/assets/prsk/${DEVELOPMENT_CHARACTER_NAME}` as const
export const DEVELOPMENT_CHARACTER_ATLAS_URL =
  `${DEVELOPMENT_CHARACTER_ROOT}/sekai_atlas.atlas` as const
export const DEVELOPMENT_SKELETON_PATH =
  '/assets/prsk/base_model/sekai_skeleton.skel'

export type DevelopmentCharacterAssetErrorCode =
  'DEVELOPMENT_CHARACTER_LOAD_FAILED'

export class DevelopmentCharacterAssetError extends Error {
  readonly code: DevelopmentCharacterAssetErrorCode

  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options)
    this.name = 'DevelopmentCharacterAssetError'
    this.code = 'DEVELOPMENT_CHARACTER_LOAD_FAILED'
  }
}

export interface LoadDevelopmentCharacterPackOptions {
  readonly fetcher?: typeof fetch
}

export interface LoadDevelopmentSharedSkeletonOptions {
  readonly fetcher?: typeof fetch
}

function pageUrl(pagePath: string): string {
  const encodedPath = pagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${DEVELOPMENT_CHARACTER_ROOT}/${encodedPath}`
}

async function fetchRequired(
  fetcher: typeof fetch,
  url: string,
): Promise<Response> {
  let response: Response

  try {
    response = await fetcher(url, { cache: 'no-store' })
  } catch (error) {
    throw new DevelopmentCharacterAssetError(
      `개발용 기본 캐릭터 자산을 읽을 수 없습니다: ${url}`,
      { cause: error },
    )
  }

  if (!response.ok) {
    throw new DevelopmentCharacterAssetError(
      `개발용 기본 캐릭터 자산이 없습니다 (${response.status}): ${url}`,
    )
  }

  return response
}

export async function loadDevelopmentCharacterPack(
  options: LoadDevelopmentCharacterPackOptions = {},
): Promise<LiveSDAtlasBundle> {
  const fetcher = options.fetcher ?? fetch
  const atlasResponse = await fetchRequired(
    fetcher,
    DEVELOPMENT_CHARACTER_ATLAS_URL,
  )
  const atlasText = await atlasResponse.text()
  const pageReferences = readAtlasPageReferences(atlasText)
  const atlasPages = new Map<string, Blob>()

  for (const pageReference of pageReferences) {
    if (!pageReference.toLocaleLowerCase('en-US').endsWith('.png')) {
      throw new PrskArchiveImportError(
        'ATLAS_UNSUPPORTED_PAGE_FORMAT',
        `개발용 atlas는 PNG 페이지만 참조할 수 있습니다: ${pageReference}`,
        { path: pageReference },
      )
    }

    const pagePath = resolveAtlasPagePath(
      'sekai_atlas.atlas',
      pageReference,
    )
    const pageResponse = await fetchRequired(fetcher, pageUrl(pagePath))
    atlasPages.set(pagePath, await pageResponse.blob())
  }

  return {
    sourceName: `${DEVELOPMENT_CHARACTER_NAME} (기본 캐릭터)`,
    atlasPath: 'sekai_atlas.atlas',
    atlasText,
    atlasPages,
  }
}

export async function loadDevelopmentSharedSkeleton(
  options: LoadDevelopmentSharedSkeletonOptions = {},
): Promise<ArrayBuffer> {
  const response = await fetchRequired(
    options.fetcher ?? fetch,
    DEVELOPMENT_SKELETON_PATH,
  )
  return response.arrayBuffer()
}
