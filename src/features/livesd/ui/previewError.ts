import { isLiveSDPreviewError } from '../adapter'
import { SharedSkeletonInputError } from '../input/sharedSkeleton'
import { RuntimeLoadError } from '../runtime/runtimeLoader'

export type PreviewUIFallbackErrorCode = 'PREVIEW_UNKNOWN_ERROR'

export interface PreviewUiNotice {
  readonly code: string
  readonly message: string
  readonly details?: Readonly<
    Record<string, string | number | undefined>
  >
}

export type PreviewUiErrorAdapter = (
  error: unknown,
) => PreviewUiNotice | null

function errorDetails(
  error: Error,
): PreviewUiNotice['details'] {
  const details: Record<string, string | number> = {}
  for (const key of ['path', 'resource', 'status', 'url'] as const) {
    const value = Reflect.get(error, key)
    if (typeof value === 'string' || typeof value === 'number') {
      details[key] = value
    }
  }
  return Object.keys(details).length > 0 ? details : undefined
}

export function toPreviewUiNotice(
  error: unknown,
  sourceAdapter?: PreviewUiErrorAdapter,
): PreviewUiNotice {
  const sourceNotice = sourceAdapter?.(error)
  if (sourceNotice) {
    return sourceNotice
  }

  if (
    isLiveSDPreviewError(error) ||
    error instanceof RuntimeLoadError ||
    error instanceof SharedSkeletonInputError
  ) {
    return {
      code: error.code,
      details: errorDetails(error),
      message: error.message,
    }
  }

  return {
    code: 'PREVIEW_UNKNOWN_ERROR',
    message: '미리보기를 준비하는 중 알 수 없는 오류가 발생했습니다.',
  }
}
