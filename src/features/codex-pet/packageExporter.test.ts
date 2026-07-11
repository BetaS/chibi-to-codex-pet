import {
  BlobReader,
  TextWriter,
  Uint8ArrayWriter,
  ZipReader,
} from '@zip.js/zip.js'
import { describe, expect, it } from 'vitest'

import {
  CODEX_PET_MAX_SPRITESHEET_BYTES,
  exportCodexPetPackage,
} from './packageExporter'

describe('Codex Pet package exporter', () => {
  it('writes only manifest and PNG below the safe pet id', async () => {
    const exported = await exportCodexPetPackage({
      metadata: {
        description: ' Airi normal ',
        displayName: ' Airi Normal ',
      },
      spritesheet: new Uint8Array([137, 80, 78, 71]),
    })

    expect(exported.filename).toBe('airi-normal.codex-pet.zip')
    expect(exported.blob.type).toBe('application/zip')

    const reader = new ZipReader(new BlobReader(exported.blob), {
      useWebWorkers: false,
    })
    try {
      const entries = await reader.getEntries()
      expect(entries.map(({ filename }) => filename).sort()).toEqual([
        'airi-normal/pet.json',
        'airi-normal/spritesheet.png',
      ])
      expect(entries).toHaveLength(2)

      const manifestEntry = entries.find(
        ({ filename }) => filename === 'airi-normal/pet.json',
      )
      const pngEntry = entries.find(
        ({ filename }) => filename === 'airi-normal/spritesheet.png',
      )
      if (!manifestEntry || manifestEntry.directory) {
        throw new Error('manifest entry missing')
      }
      if (!pngEntry || pngEntry.directory) {
        throw new Error('spritesheet entry missing')
      }

      const manifest = JSON.parse(
        await manifestEntry.getData(new TextWriter()),
      ) as unknown
      expect(manifest).toEqual(exported.manifest)
      expect(manifest).toMatchObject({ spriteVersionNumber: 2 })
      expect(
        await pngEntry.getData(new Uint8ArrayWriter()),
      ).toEqual(new Uint8Array([137, 80, 78, 71]))
    } finally {
      await reader.close()
    }
  })

  it('rejects an empty spritesheet', async () => {
    await expect(
      exportCodexPetPackage({
        metadata: { displayName: 'Airi' },
        spritesheet: new Uint8Array(),
      }),
    ).rejects.toMatchObject({ code: 'SPRITESHEET_EMPTY' })
  })

  it('rejects a spritesheet above the 20MiB package limit', async () => {
    await expect(
      exportCodexPetPackage({
        metadata: { displayName: 'Airi' },
        spritesheet: new Blob([
          new Uint8Array(CODEX_PET_MAX_SPRITESHEET_BYTES + 1),
        ]),
      }),
    ).rejects.toMatchObject({ code: 'SPRITESHEET_TOO_LARGE' })
  })
})
