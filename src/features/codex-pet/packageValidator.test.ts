import {
  BlobWriter,
  TextReader,
  Uint8ArrayReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { describe, expect, it } from 'vitest'

import {
  CODEX_PET_ATLAS_HEIGHT,
  CODEX_PET_ATLAS_WIDTH,
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_STATES,
} from './contract'
import { createCodexPetManifest } from './manifest'
import { exportCodexPetPackage } from './packageExporter'
import {
  validateCodexPetPackage,
  type CodexPetPngDecoder,
} from './packageValidator'

function createPngHeader(
  width = CODEX_PET_ATLAS_WIDTH,
  height = CODEX_PET_ATLAS_HEIGHT,
): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13, false)
  bytes.set([73, 72, 68, 82], 12)
  view.setUint32(16, width, false)
  view.setUint32(20, height, false)
  return bytes
}

interface CellRectangle {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

const VALID_CELL_RECTANGLE: CellRectangle = {
  minX: 24,
  minY: 20,
  maxX: 167,
  maxY: 187,
}

function setCellAlpha(
  pixels: Uint8ClampedArray,
  row: number,
  column: number,
  localX: number,
  localY: number,
  alpha: number,
): void {
  const x = column * CODEX_PET_CELL_WIDTH + localX
  const y = row * CODEX_PET_CELL_HEIGHT + localY
  pixels[(y * CODEX_PET_ATLAS_WIDTH + x) * 4 + 3] = alpha
}

function paintCellRectangle(
  pixels: Uint8ClampedArray,
  row: number,
  column: number,
  rectangle: CellRectangle,
): void {
  for (let y = rectangle.minY; y <= rectangle.maxY; y += 1) {
    for (let x = rectangle.minX; x <= rectangle.maxX; x += 1) {
      setCellAlpha(pixels, row, column, x, y, 255)
    }
  }
}

function clearCell(
  pixels: Uint8ClampedArray,
  row: number,
  column: number,
): void {
  for (let y = 0; y < CODEX_PET_CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CODEX_PET_CELL_WIDTH; x += 1) {
      setCellAlpha(pixels, row, column, x, y, 0)
    }
  }
}

function createValidPixels(
  rectangle: CellRectangle = VALID_CELL_RECTANGLE,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(
    CODEX_PET_ATLAS_WIDTH * CODEX_PET_ATLAS_HEIGHT * 4,
  )
  for (const state of CODEX_PET_STATES) {
    for (let column = 0; column < state.frameCount; column += 1) {
      paintCellRectangle(pixels, state.row, column, rectangle)
    }
  }
  for (const direction of CODEX_PET_LOOK_DIRECTIONS) {
    paintCellRectangle(pixels, direction.row, direction.column, rectangle)
  }
  return pixels
}

function decoderFor(
  pixels: Uint8ClampedArray,
  width = CODEX_PET_ATLAS_WIDTH,
  height = CODEX_PET_ATLAS_HEIGHT,
): CodexPetPngDecoder {
  return async () => ({ data: pixels, height, width })
}

async function createPackage(
  manifest: unknown,
  png: Uint8Array,
  manifestPath = 'airi/pet.json',
  pngPath = 'airi/spritesheet.png',
): Promise<Blob> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    useWebWorkers: false,
  })
  await writer.add(manifestPath, new TextReader(JSON.stringify(manifest)), {
    level: 0,
    useWebWorkers: false,
  })
  await writer.add(pngPath, new Uint8ArrayReader(png), {
    level: 0,
    useWebWorkers: false,
  })
  return writer.close()
}

async function createValidPackage(): Promise<Blob> {
  return (
    await exportCodexPetPackage({
      metadata: { description: 'normal', displayName: 'Airi' },
      spritesheet: createPngHeader(),
    })
  ).blob
}

describe('Codex Pet package validator', () => {
  it('independently restores a valid exported manifest and spritesheet', async () => {
    const zip = await createValidPackage()
    const validated = await validateCodexPetPackage(zip, {
      decodePng: decoderFor(createValidPixels()),
    })

    expect(validated.id).toBe('airi')
    expect(validated.manifest).toEqual({
      description: 'normal',
      displayName: 'Airi',
      id: 'airi',
      spriteVersionNumber: 2,
      spritesheetPath: 'spritesheet.png',
    })
    expect(validated.spritesheet.type).toBe('image/png')
    expect(validated.spritesheetBytes).toEqual(createPngHeader())
  })

  it('rejects an unsafe ZIP entry before extracting content', async () => {
    const zip = await createPackage(
      createCodexPetManifest({ displayName: 'Airi' }),
      createPngHeader(),
      '../airi/pet.json',
    )

    await expect(
      validateCodexPetPackage(zip, {
        decodePng: decoderFor(createValidPixels()),
      }),
    ).rejects.toMatchObject({ code: 'PACKAGE_ENTRY_UNSAFE' })
  })

  it('rejects a manifest that is not the exact v2 schema', async () => {
    const manifest = {
      ...createCodexPetManifest({ displayName: 'Airi' }),
      spriteVersionNumber: 1,
    }
    const zip = await createPackage(manifest, createPngHeader())

    await expect(
      validateCodexPetPackage(zip, {
        decodePng: decoderFor(createValidPixels()),
      }),
    ).rejects.toMatchObject({ code: 'MANIFEST_INVALID' })
  })

  it('rejects a PNG with incorrect IHDR geometry', async () => {
    const zip = await createPackage(
      createCodexPetManifest({ displayName: 'Airi' }),
      createPngHeader(CODEX_PET_ATLAS_WIDTH - 1),
    )

    await expect(
      validateCodexPetPackage(zip, {
        decodePng: decoderFor(createValidPixels()),
      }),
    ).rejects.toMatchObject({ code: 'PNG_GEOMETRY_INVALID' })
  })

  it('reports the state and frame of an empty used cell', async () => {
    const pixels = createValidPixels()
    clearCell(pixels, 0, 0)

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        decodePng: decoderFor(pixels),
      }),
    ).rejects.toMatchObject({
      code: 'PNG_CELL_EMPTY',
      column: 0,
      row: 0,
      state: 'idle',
    })
  })

  it('does not treat alpha 1-only noise as a visible used cell', async () => {
    const pixels = createValidPixels()
    clearCell(pixels, 0, 0)
    setCellAlpha(pixels, 0, 0, 96, 104, 1)

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        decodePng: decoderFor(pixels),
      }),
    ).rejects.toMatchObject({
      code: 'PNG_CELL_EMPTY',
      column: 0,
      row: 0,
      state: 'idle',
    })
  })

  it('reports the row and column of an empty look direction cell', async () => {
    const pixels = createValidPixels()
    const direction = CODEX_PET_LOOK_DIRECTIONS[9]
    clearCell(pixels, direction.row, direction.column)

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        decodePng: decoderFor(pixels),
      }),
    ).rejects.toMatchObject({
      code: 'PNG_CELL_EMPTY',
      column: 1,
      row: 10,
    })
  })

  it.each([
    ['left', 3, 100],
    ['right', CODEX_PET_CELL_WIDTH - 4, 100],
    ['top', 100, 3],
    ['bottom', 100, CODEX_PET_CELL_HEIGHT - 4],
  ] as const)(
    'rejects a standard cell that reaches the %s 4px safety margin',
    async (_edge, localX, localY) => {
      const pixels = createValidPixels()
      setCellAlpha(pixels, 0, 0, localX, localY, 2)

      await expect(
        validateCodexPetPackage(await createValidPackage(), {
          decodePng: decoderFor(pixels),
        }),
      ).rejects.toMatchObject({
        code: 'PNG_CELL_CLIPPED',
        column: 0,
        row: 0,
        state: 'idle',
      })
    },
  )

  it('reports a clipped look cell by row and column', async () => {
    const pixels = createValidPixels()
    const direction = CODEX_PET_LOOK_DIRECTIONS[9]
    setCellAlpha(pixels, direction.row, direction.column, 100, 3, 2)

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        decodePng: decoderFor(pixels),
      }),
    ).rejects.toMatchObject({
      code: 'PNG_CELL_CLIPPED',
      column: direction.column,
      row: direction.row,
    })
  })

  it('custom framing에서는 edge crop만 허용한다', async () => {
    const pixels = createValidPixels()
    setCellAlpha(pixels, 0, 0, 0, 100, 255)
    const look = CODEX_PET_LOOK_DIRECTIONS[0]
    setCellAlpha(pixels, look.row, look.column, 100, 0, 255)

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        allowEdgeClipping: true,
        decodePng: decoderFor(pixels),
      }),
    ).resolves.toMatchObject({ id: 'airi' })

    clearCell(pixels, 0, 0)
    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        allowEdgeClipping: true,
        decodePng: decoderFor(pixels),
      }),
    ).rejects.toMatchObject({
      code: 'PNG_CELL_EMPTY',
      column: 0,
      row: 0,
    })
  })

  it('rejects a standard-frame union below 70% occupancy with its measurement', async () => {
    const pixels = createValidPixels({
      minX: 76,
      minY: 79,
      maxX: 115,
      maxY: 128,
    })

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        decodePng: decoderFor(pixels),
      }),
    ).rejects.toMatchObject({
      code: 'PNG_OCCUPANCY_TOO_SMALL',
      measured: 50 / CODEX_PET_CELL_HEIGHT,
    })
  })

  it('ignores alpha 1 noise for visible bounds and safety margins', async () => {
    const pixels = createValidPixels()
    setCellAlpha(pixels, 0, 0, 0, 0, 1)
    const look = CODEX_PET_LOOK_DIRECTIONS[0]
    setCellAlpha(pixels, look.row, look.column, 0, 0, 1)

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        decodePng: decoderFor(pixels),
      }),
    ).resolves.toMatchObject({ id: 'airi' })
  })

  it('rejects decoded pixels with v1 geometry even when IHDR is v2', async () => {
    const v1Height = CODEX_PET_CELL_HEIGHT * 9
    const v1Pixels = new Uint8ClampedArray(
      CODEX_PET_ATLAS_WIDTH * v1Height * 4,
    )

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        decodePng: decoderFor(
          v1Pixels,
          CODEX_PET_ATLAS_WIDTH,
          v1Height,
        ),
      }),
    ).rejects.toMatchObject({ code: 'PNG_GEOMETRY_INVALID' })
  })

  it('reports a non-transparent unused cell by row and column', async () => {
    const pixels = createValidPixels()
    const unusedColumn = CODEX_PET_STATES[0].frameCount
    pixels[unusedColumn * CODEX_PET_CELL_WIDTH * 4 + 3] = 255

    await expect(
      validateCodexPetPackage(await createValidPackage(), {
        decodePng: decoderFor(pixels),
      }),
    ).rejects.toMatchObject({
      code: 'PNG_UNUSED_CELL_NOT_TRANSPARENT',
      column: unusedColumn,
      row: 0,
    })
  })
})
