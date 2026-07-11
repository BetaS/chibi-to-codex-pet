import type { LiveSDAtlasBundle } from '../../model'

export const PRSK_ARCHIVE_LIMITS = Object.freeze({
  compressedBytes: 32 * 1024 * 1024,
  fileEntries: 32,
  uncompressedBytes: 64 * 1024 * 1024,
})

export interface PrskCharacterArchiveImporterContract {
  import(file: File): Promise<LiveSDAtlasBundle>
}
