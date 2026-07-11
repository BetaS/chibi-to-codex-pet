export type SharedSkeletonInputErrorCode =
  | 'SHARED_SKELETON_FALLBACK_LOAD_FAILED'
  | 'SHARED_SKELETON_INVALID_TYPE'
  | 'SHARED_SKELETON_REQUIRED'

export class SharedSkeletonInputError extends Error {
  readonly code: SharedSkeletonInputErrorCode

  constructor(
    code: SharedSkeletonInputErrorCode,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'SharedSkeletonInputError'
    this.code = code
  }
}

export interface LoadSharedSkeletonOptions {
  readonly fallback?: () => Promise<ArrayBuffer>
}

export async function loadSharedSkeleton(
  selectedFile: File | null,
  options: LoadSharedSkeletonOptions = {},
): Promise<ArrayBuffer> {
  if (selectedFile) {
    if (!selectedFile.name.toLocaleLowerCase('en-US').endsWith('.skel')) {
      throw new SharedSkeletonInputError(
        'SHARED_SKELETON_INVALID_TYPE',
        `공통 스켈레톤은 .skel 파일이어야 합니다: ${selectedFile.name}`,
      )
    }

    return selectedFile.arrayBuffer()
  }

  if (!options.fallback) {
    throw new SharedSkeletonInputError(
      'SHARED_SKELETON_REQUIRED',
      '공통 .skel 파일을 직접 선택해야 합니다.',
    )
  }

  try {
    return await options.fallback()
  } catch (error) {
    throw new SharedSkeletonInputError(
      'SHARED_SKELETON_FALLBACK_LOAD_FAILED',
      '공통 스켈레톤 fallback을 읽을 수 없습니다. 파일을 직접 선택하세요.',
      { cause: error },
    )
  }
}
