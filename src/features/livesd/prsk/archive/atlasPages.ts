import {
  isLiveSDModelError,
  readAtlasPageReferences as readLiveSDAtlasPageReferences,
} from '../../model'
import { PrskArchiveImportError } from './errors'

export function readAtlasPageReferences(atlasText: string): readonly string[] {
  try {
    return readLiveSDAtlasPageReferences(atlasText)
  } catch (error) {
    if (isLiveSDModelError(error)) {
      throw new PrskArchiveImportError(
        'ATLAS_PAGE_LIST_EMPTY',
        'sekai_atlas.atlas에서 이미지 페이지를 찾을 수 없습니다.',
        { cause: error },
      )
    }
    throw error
  }
}
