import {
  BlobReader,
  BlobWriter,
  ZipReader,
  type FileEntry,
} from '@zip.js/zip.js'

import type { LiveSDAtlasBundle } from '../../model'

import {
  archiveBasename,
  normalizeArchivePath,
  resolveAtlasPagePath,
} from './archivePath'
import { readAtlasPageReferences } from './atlasPages'
import {
  isPrskArchiveImportError,
  PrskArchiveImportError,
} from './errors'
import {
  PRSK_ARCHIVE_LIMITS,
  type PrskCharacterArchiveImporterContract,
} from './types'

interface NormalizedFileEntry {
  readonly entry: FileEntry
  readonly path: string
}

function assertSafeEntrySize(entry: FileEntry): void {
  if (
    !Number.isSafeInteger(entry.uncompressedSize) ||
    entry.uncompressedSize < 0
  ) {
    throw new PrskArchiveImportError(
      'ARCHIVE_CORRUPT',
      `ZIP 항목 크기가 유효하지 않습니다: ${entry.filename}`,
      { path: entry.filename },
    )
  }
}

function decodeAtlasText(data: ArrayBuffer, atlasPath: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch (error) {
    throw new PrskArchiveImportError(
      'ATLAS_INVALID_TEXT',
      `atlas를 UTF-8 텍스트로 읽을 수 없습니다: ${atlasPath}`,
      { cause: error, path: atlasPath },
    )
  }
}

export class PrskCharacterArchiveImporter
  implements PrskCharacterArchiveImporterContract
{
  async import(file: File): Promise<LiveSDAtlasBundle> {
    if (file.size > PRSK_ARCHIVE_LIMITS.compressedBytes) {
      throw new PrskArchiveImportError(
        'ARCHIVE_TOO_LARGE',
        `ZIP은 32MiB 이하여야 합니다: ${file.name}`,
      )
    }

    const zipReader = new ZipReader(new BlobReader(file), {
      useWebWorkers: false,
    })

    try {
      const entries = await zipReader.getEntries()
      const normalizedPaths = new Map<string, string>()
      const files: NormalizedFileEntry[] = []

      for (const entry of entries) {
        const normalizedPath = normalizeArchivePath(entry.filename)
        const existingPath = normalizedPaths.get(normalizedPath)

        if (existingPath !== undefined) {
          throw new PrskArchiveImportError(
            'ARCHIVE_PATH_COLLISION',
            `정규화 후 경로가 충돌합니다: ${existingPath}, ${entry.filename}`,
            { path: normalizedPath },
          )
        }

        normalizedPaths.set(normalizedPath, entry.filename)

        if (entry.directory) {
          continue
        }

        assertSafeEntrySize(entry)
        files.push({ entry, path: normalizedPath })
      }

      if (files.length > PRSK_ARCHIVE_LIMITS.fileEntries) {
        throw new PrskArchiveImportError(
          'ARCHIVE_ENTRY_LIMIT_EXCEEDED',
          `ZIP의 파일은 ${PRSK_ARCHIVE_LIMITS.fileEntries}개 이하여야 합니다: ${files.length}개`,
        )
      }

      const uncompressedBytes = files.reduce(
        (total, fileEntry) => total + fileEntry.entry.uncompressedSize,
        0,
      )

      if (uncompressedBytes > PRSK_ARCHIVE_LIMITS.uncompressedBytes) {
        throw new PrskArchiveImportError(
          'ARCHIVE_UNCOMPRESSED_LIMIT_EXCEEDED',
          `압축 해제 후 파일 합계는 64MiB 이하여야 합니다: ${uncompressedBytes} bytes`,
        )
      }

      const encryptedEntry = files.find(({ entry }) => entry.encrypted)
      if (encryptedEntry) {
        throw new PrskArchiveImportError(
          'ARCHIVE_ENCRYPTED_ENTRY',
          `암호화된 ZIP 항목은 지원하지 않습니다: ${encryptedEntry.path}`,
          { path: encryptedEntry.path },
        )
      }

      const skeletonEntry = files.find(({ path }) =>
        path.toLocaleLowerCase('en-US').endsWith('.skel'),
      )
      if (skeletonEntry) {
        throw new PrskArchiveImportError(
          'ARCHIVE_SKEL_FORBIDDEN',
          `캐릭터 ZIP에는 공통 .skel을 포함할 수 없습니다: ${skeletonEntry.path}`,
          { path: skeletonEntry.path },
        )
      }

      const atlasEntries = files.filter(
        ({ path }) => archiveBasename(path) === 'sekai_atlas.atlas',
      )

      if (atlasEntries.length === 0) {
        throw new PrskArchiveImportError(
          'ATLAS_MISSING',
          'ZIP에 sekai_atlas.atlas가 없습니다.',
        )
      }

      if (atlasEntries.length > 1) {
        throw new PrskArchiveImportError(
          'ATLAS_MULTIPLE',
          `ZIP에는 sekai_atlas.atlas가 정확히 하나만 있어야 합니다: ${atlasEntries.length}개`,
        )
      }

      const atlasEntry = atlasEntries[0]
      if (!atlasEntry) {
        throw new PrskArchiveImportError(
          'ATLAS_MISSING',
          'ZIP에 sekai_atlas.atlas가 없습니다.',
        )
      }

      const atlasText = decodeAtlasText(
        await atlasEntry.entry.arrayBuffer({ useWebWorkers: false }),
        atlasEntry.path,
      )
      const pageReferences = readAtlasPageReferences(atlasText)
      const fileByPath = new Map(files.map((fileEntry) => [fileEntry.path, fileEntry]))
      const atlasPages = new Map<string, Blob>()

      for (const pageReference of pageReferences) {
        if (!pageReference.toLocaleLowerCase('en-US').endsWith('.png')) {
          throw new PrskArchiveImportError(
            'ATLAS_UNSUPPORTED_PAGE_FORMAT',
            `atlas는 PNG 페이지만 참조할 수 있습니다: ${pageReference}`,
            { path: pageReference },
          )
        }

        const pagePath = resolveAtlasPagePath(atlasEntry.path, pageReference)

        if (atlasPages.has(pagePath)) {
          throw new PrskArchiveImportError(
            'ATLAS_DUPLICATE_PAGE',
            `atlas가 같은 페이지를 두 번 참조합니다: ${pagePath}`,
            { path: pagePath },
          )
        }

        const pageEntry = fileByPath.get(pagePath)
        if (!pageEntry) {
          throw new PrskArchiveImportError(
            'ATLAS_PAGE_MISSING',
            `atlas가 참조하는 PNG가 ZIP에 없습니다: ${pagePath}`,
            { path: pagePath },
          )
        }

        atlasPages.set(
          pagePath,
          await pageEntry.entry.getData(new BlobWriter('image/png'), {
            useWebWorkers: false,
          }),
        )
      }

      return {
        sourceName: file.name,
        atlasPath: atlasEntry.path,
        atlasText,
        atlasPages,
      }
    } catch (error) {
      if (isPrskArchiveImportError(error)) {
        throw error
      }

      throw new PrskArchiveImportError(
        'ARCHIVE_CORRUPT',
        `ZIP을 읽거나 압축 해제할 수 없습니다: ${file.name}`,
        { cause: error },
      )
    } finally {
      await zipReader.close().catch(() => undefined)
    }
  }
}

export const prskCharacterArchiveImporter =
  new PrskCharacterArchiveImporter()
