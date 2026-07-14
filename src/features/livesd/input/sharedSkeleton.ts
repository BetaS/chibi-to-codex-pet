export type SharedSkeletonInputErrorCode =
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

export async function loadSharedSkeleton(
  selectedFile: File | null,
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

  throw new SharedSkeletonInputError(
    'SHARED_SKELETON_REQUIRED',
    '공통 .skel 파일을 직접 선택해야 합니다.',
  )
}
