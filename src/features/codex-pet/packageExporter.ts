import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from '@zip.js/zip.js'

import {
  CODEX_PET_SPRITESHEET_FILENAME,
  createCodexPetManifest,
  serializeCodexPetManifest,
  type CodexPetManifest,
  type CodexPetMetadataInput,
} from './manifest'

export const CODEX_PET_MAX_SPRITESHEET_BYTES = 20 * 1024 * 1024
export const CODEX_PET_ZIP_MEDIA_TYPE = 'application/zip' as const

export interface CodexPetPackageExportInput {
  readonly metadata: CodexPetMetadataInput
  readonly spritesheet: ArrayBuffer | Blob | Uint8Array
}

export interface ExportedCodexPetPackage {
  readonly blob: Blob
  readonly filename: string
  readonly manifest: CodexPetManifest
}

export type CodexPetPackageExportErrorCode =
  | 'SPRITESHEET_EMPTY'
  | 'SPRITESHEET_TOO_LARGE'

export class CodexPetPackageExportError extends Error {
  readonly code: CodexPetPackageExportErrorCode

  constructor(code: CodexPetPackageExportErrorCode, message: string) {
    super(message)
    this.name = 'CodexPetPackageExportError'
    this.code = code
  }
}

function toPngBlob(input: ArrayBuffer | Blob | Uint8Array): Blob {
  if (
    typeof (input as Blob).arrayBuffer === 'function' &&
    typeof (input as Blob).size === 'number'
  ) {
    return input as Blob
  }

  const bytes =
    input instanceof Uint8Array ? input.slice().buffer : input.slice(0)
  return new Blob([bytes], { type: 'image/png' })
}

export async function exportCodexPetPackage(
  input: CodexPetPackageExportInput,
): Promise<ExportedCodexPetPackage> {
  const manifest = createCodexPetManifest(input.metadata)
  const spritesheet = toPngBlob(input.spritesheet)

  if (spritesheet.size === 0) {
    throw new CodexPetPackageExportError(
      'SPRITESHEET_EMPTY',
      'spritesheet PNG가 비어 있습니다.',
    )
  }

  if (spritesheet.size > CODEX_PET_MAX_SPRITESHEET_BYTES) {
    throw new CodexPetPackageExportError(
      'SPRITESHEET_TOO_LARGE',
      'spritesheet PNG는 20MiB 이하여야 합니다.',
    )
  }

  const zipWriter = new ZipWriter(
    new BlobWriter(CODEX_PET_ZIP_MEDIA_TYPE),
    { useWebWorkers: false },
  )
  const basePath = manifest.id + '/'
  const entryOptions = {
    extendedTimestamp: false,
    lastModDate: new Date('1980-01-01T00:00:00.000Z'),
    level: 0,
    useWebWorkers: false,
  } as const

  await zipWriter.add(
    basePath + 'pet.json',
    new TextReader(serializeCodexPetManifest(manifest)),
    entryOptions,
  )
  await zipWriter.add(
    basePath + CODEX_PET_SPRITESHEET_FILENAME,
    new BlobReader(spritesheet),
    entryOptions,
  )

  const blob = await zipWriter.close()
  return {
    blob,
    filename: manifest.id + '.codex-pet.zip',
    manifest,
  }
}

export class CodexPetPackageExporter {
  export(
    input: CodexPetPackageExportInput,
  ): Promise<ExportedCodexPetPackage> {
    return exportCodexPetPackage(input)
  }
}
