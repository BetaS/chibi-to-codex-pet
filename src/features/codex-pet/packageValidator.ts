import {
  BlobReader,
  Uint8ArrayWriter,
  ZipReader,
  type FileEntry,
} from '@zip.js/zip.js'

import {
  CODEX_PET_ATLAS_COLUMNS,
  CODEX_PET_ATLAS_HEIGHT,
  CODEX_PET_ATLAS_ROWS,
  CODEX_PET_ATLAS_WIDTH,
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_STATES,
  type CodexPetStateId,
} from './contract'
import {
  CODEX_PET_SPRITESHEET_FILENAME,
  CODEX_PET_SPRITE_VERSION,
  isSafeCodexPetId,
  slugifyCodexPetId,
  type CodexPetManifest,
} from './manifest'
import { CODEX_PET_MAX_SPRITESHEET_BYTES } from './packageExporter'

const MAX_MANIFEST_BYTES = 64 * 1024
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const
const VISIBLE_ALPHA_THRESHOLD = 2
const CELL_SAFE_MARGIN_PX = 4
const MINIMUM_STANDARD_OCCUPANCY = 0.7
const EXPECTED_MANIFEST_KEYS = [
  'description',
  'displayName',
  'id',
  'spriteVersionNumber',
  'spritesheetPath',
] as const

export interface DecodedCodexPetPng {
  readonly data: Uint8Array | Uint8ClampedArray
  readonly height: number
  readonly width: number
}

export type CodexPetPngDecoder = (
  pngBytes: Uint8Array,
) => Promise<DecodedCodexPetPng>

export interface CodexPetPackageValidatorOptions {
  readonly allowEdgeClipping?: boolean
  readonly decodePng?: CodexPetPngDecoder
}

export interface ValidatedCodexPetPackage {
  readonly id: string
  readonly manifest: CodexPetManifest
  readonly spritesheet: Blob
  readonly spritesheetBytes: Uint8Array
}

export type CodexPetPackageValidationErrorCode =
  | 'MANIFEST_INVALID'
  | 'PACKAGE_ENTRY_ENCRYPTED'
  | 'PACKAGE_ENTRY_STRUCTURE_INVALID'
  | 'PACKAGE_ENTRY_UNSAFE'
  | 'PACKAGE_ZIP_INVALID'
  | 'PNG_CELL_EMPTY'
  | 'PNG_CELL_CLIPPED'
  | 'PNG_DECODE_FAILED'
  | 'PNG_GEOMETRY_INVALID'
  | 'PNG_INVALID'
  | 'PNG_OCCUPANCY_TOO_SMALL'
  | 'PNG_TOO_LARGE'
  | 'PNG_UNUSED_CELL_NOT_TRANSPARENT'

export interface CodexPetPackageValidationErrorOptions extends ErrorOptions {
  readonly column?: number
  readonly measured?: number
  readonly path?: string
  readonly row?: number
  readonly state?: CodexPetStateId
}

export class CodexPetPackageValidationError extends Error {
  readonly code: CodexPetPackageValidationErrorCode
  readonly column?: number
  readonly measured?: number
  readonly path?: string
  readonly row?: number
  readonly state?: CodexPetStateId

  constructor(
    code: CodexPetPackageValidationErrorCode,
    message: string,
    options: CodexPetPackageValidationErrorOptions = {},
  ) {
    super(message, options)
    this.name = 'CodexPetPackageValidationError'
    this.code = code
    this.column = options.column
    this.measured = options.measured
    this.path = options.path
    this.row = options.row
    this.state = options.state
  }
}

function toZipBlob(input: ArrayBuffer | Blob | Uint8Array): Blob {
  if (
    typeof (input as Blob).arrayBuffer === 'function' &&
    typeof (input as Blob).size === 'number'
  ) {
    return input as Blob
  }

  const bytes =
    input instanceof Uint8Array ? input.slice().buffer : input.slice(0)
  return new Blob([bytes], { type: 'application/zip' })
}

function failUnsafeEntry(path: string, reason: string): never {
  throw new CodexPetPackageValidationError(
    'PACKAGE_ENTRY_UNSAFE',
    reason + ': ' + path,
    { path },
  )
}

function assertSafeEntryPath(entry: FileEntry): readonly [string, string] {
  const path = entry.filename

  if (path.includes('\0')) {
    failUnsafeEntry(path, 'NUL 문자가 포함된 ZIP 경로는 사용할 수 없습니다')
  }
  if (path.includes('\\')) {
    failUnsafeEntry(path, '역슬래시가 포함된 ZIP 경로는 사용할 수 없습니다')
  }
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    failUnsafeEntry(path, '절대 ZIP 경로는 사용할 수 없습니다')
  }

  let rawPath: string
  try {
    rawPath = new TextDecoder('utf-8', { fatal: true }).decode(
      entry.rawFilename,
    )
  } catch (error) {
    throw new CodexPetPackageValidationError(
      'PACKAGE_ENTRY_UNSAFE',
      'UTF-8로 해석할 수 없는 ZIP 경로입니다: ' + path,
      { cause: error, path },
    )
  }
  if (rawPath !== path) {
    failUnsafeEntry(path, '모호하게 인코딩된 ZIP 경로는 사용할 수 없습니다')
  }

  const segments = path.split('/')
  if (
    segments.length !== 2 ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    failUnsafeEntry(path, 'Pet 디렉터리 바로 아래 파일만 포함할 수 있습니다')
  }

  const [id, filename] = segments
  if (!id || !filename || !isSafeCodexPetId(id)) {
    failUnsafeEntry(path, '안전하지 않은 Pet id가 포함된 ZIP 경로입니다')
  }
  return [id, filename]
}

function assertEntrySize(
  entry: FileEntry,
  maximum: number,
  code: CodexPetPackageValidationErrorCode,
): void {
  if (
    !Number.isSafeInteger(entry.uncompressedSize) ||
    entry.uncompressedSize < 0
  ) {
    throw new CodexPetPackageValidationError(
      'PACKAGE_ZIP_INVALID',
      'ZIP 항목 크기가 유효하지 않습니다: ' + entry.filename,
      { path: entry.filename },
    )
  }
  if (entry.uncompressedSize > maximum) {
    throw new CodexPetPackageValidationError(
      code,
      'ZIP 항목 크기 제한을 초과했습니다: ' + entry.filename,
      { path: entry.filename },
    )
  }
}

function parseManifest(bytes: Uint8Array, directoryId: string): CodexPetManifest {
  let value: unknown
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    value = JSON.parse(text)
  } catch (error) {
    throw new CodexPetPackageValidationError(
      'MANIFEST_INVALID',
      'pet.json을 UTF-8 JSON으로 읽을 수 없습니다.',
      { cause: error },
    )
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CodexPetPackageValidationError(
      'MANIFEST_INVALID',
      'pet.json 최상위 값은 객체여야 합니다.',
    )
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (
    keys.length !== EXPECTED_MANIFEST_KEYS.length ||
    EXPECTED_MANIFEST_KEYS.some((key, index) => key !== keys[index])
  ) {
    throw new CodexPetPackageValidationError(
      'MANIFEST_INVALID',
      'pet.json은 v2 필수 필드만 포함해야 합니다.',
    )
  }

  if (
    typeof record.id !== 'string' ||
    !isSafeCodexPetId(record.id) ||
    record.id !== directoryId
  ) {
    throw new CodexPetPackageValidationError(
      'MANIFEST_INVALID',
      'manifest id는 안전해야 하며 Pet 디렉터리 id와 같아야 합니다.',
    )
  }
  if (
    typeof record.displayName !== 'string' ||
    !record.displayName.trim() ||
    record.displayName !== record.displayName.trim() ||
    slugifyCodexPetId(record.displayName) !== record.id
  ) {
    throw new CodexPetPackageValidationError(
      'MANIFEST_INVALID',
      'manifest displayName과 id가 정규화 규칙에 맞지 않습니다.',
    )
  }
  if (
    typeof record.description !== 'string' ||
    record.description !== record.description.trim()
  ) {
    throw new CodexPetPackageValidationError(
      'MANIFEST_INVALID',
      'manifest description은 trim된 문자열이어야 합니다.',
    )
  }
  if (record.spriteVersionNumber !== CODEX_PET_SPRITE_VERSION) {
    throw new CodexPetPackageValidationError(
      'MANIFEST_INVALID',
      'spriteVersionNumber는 2여야 합니다.',
    )
  }
  if (record.spritesheetPath !== CODEX_PET_SPRITESHEET_FILENAME) {
    throw new CodexPetPackageValidationError(
      'MANIFEST_INVALID',
      'spritesheetPath는 spritesheet.png여야 합니다.',
    )
  }

  return record as unknown as CodexPetManifest
}

export interface PngGeometry {
  readonly height: number
  readonly width: number
}

export function readPngGeometry(bytes: Uint8Array): PngGeometry {
  const signatureMatches = PNG_SIGNATURE.every(
    (expected, index) => bytes[index] === expected,
  )
  const hasIhdr =
    bytes.length >= 24 &&
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      8,
      false,
    ) === 13 &&
    bytes[12] === 73 &&
    bytes[13] === 72 &&
    bytes[14] === 68 &&
    bytes[15] === 82

  if (!signatureMatches || !hasIhdr) {
    throw new CodexPetPackageValidationError(
      'PNG_INVALID',
      'spritesheet.png의 PNG signature 또는 IHDR가 유효하지 않습니다.',
    )
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return {
    height: view.getUint32(20, false),
    width: view.getUint32(16, false),
  }
}

export const decodeCodexPetPngInBrowser: CodexPetPngDecoder = async (
  bytes,
) => {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('이 브라우저는 createImageBitmap을 지원하지 않습니다.')
  }

  const bitmap = await createImageBitmap(
    new Blob([bytes.slice().buffer], { type: 'image/png' }),
  )
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        throw new Error('PNG 검증용 2D canvas를 만들 수 없습니다.')
      }
      context.drawImage(bitmap, 0, 0)
      const imageData = context.getImageData(
        0,
        0,
        bitmap.width,
        bitmap.height,
      )
      return {
        data: imageData.data,
        height: bitmap.height,
        width: bitmap.width,
      }
    }

    if (typeof document === 'undefined') {
      throw new Error('PNG 검증용 canvas를 만들 수 없습니다.')
    }
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('PNG 검증용 2D canvas를 만들 수 없습니다.')
    }
    context.drawImage(bitmap, 0, 0)
    const imageData = context.getImageData(
      0,
      0,
      bitmap.width,
      bitmap.height,
    )
    return {
      data: imageData.data,
      height: bitmap.height,
      width: bitmap.width,
    }
  } finally {
    bitmap.close()
  }
}

interface CellAlphaBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

function cellHasAnyAlpha(
  pixels: Uint8Array | Uint8ClampedArray,
  row: number,
  column: number,
): boolean {
  const startX = column * CODEX_PET_CELL_WIDTH
  const startY = row * CODEX_PET_CELL_HEIGHT
  const endX = startX + CODEX_PET_CELL_WIDTH
  const endY = startY + CODEX_PET_CELL_HEIGHT

  for (let y = startY; y < endY; y += 1) {
    let alphaOffset = (y * CODEX_PET_ATLAS_WIDTH + startX) * 4 + 3
    const endOffset = (y * CODEX_PET_ATLAS_WIDTH + endX) * 4
    for (; alphaOffset < endOffset; alphaOffset += 4) {
      if (pixels[alphaOffset] !== 0) {
        return true
      }
    }
  }
  return false
}

function measureCellAlphaBounds(
  pixels: Uint8Array | Uint8ClampedArray,
  row: number,
  column: number,
): CellAlphaBounds | null {
  const startX = column * CODEX_PET_CELL_WIDTH
  const startY = row * CODEX_PET_CELL_HEIGHT
  let minX = CODEX_PET_CELL_WIDTH
  let minY = CODEX_PET_CELL_HEIGHT
  let maxX = -1
  let maxY = -1

  for (let localY = 0; localY < CODEX_PET_CELL_HEIGHT; localY += 1) {
    const atlasY = startY + localY
    let alphaOffset = (atlasY * CODEX_PET_ATLAS_WIDTH + startX) * 4 + 3
    const endOffset =
      (atlasY * CODEX_PET_ATLAS_WIDTH + startX + CODEX_PET_CELL_WIDTH) * 4
    for (
      let localX = 0;
      alphaOffset < endOffset;
      localX += 1, alphaOffset += 4
    ) {
      if (pixels[alphaOffset] < VISIBLE_ALPHA_THRESHOLD) {
        continue
      }
      minX = Math.min(minX, localX)
      minY = Math.min(minY, localY)
      maxX = Math.max(maxX, localX)
      maxY = Math.max(maxY, localY)
    }
  }

  return maxX < 0 ? null : { minX, minY, maxX, maxY }
}

function mergeCellAlphaBounds(
  current: CellAlphaBounds | null,
  next: CellAlphaBounds,
): CellAlphaBounds {
  if (!current) {
    return next
  }
  return {
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
  }
}

function assertCellSafeMargin(
  bounds: CellAlphaBounds,
  row: number,
  column: number,
  state?: CodexPetStateId,
): void {
  if (
    bounds.minX < CELL_SAFE_MARGIN_PX ||
    bounds.minY < CELL_SAFE_MARGIN_PX ||
    bounds.maxX >= CODEX_PET_CELL_WIDTH - CELL_SAFE_MARGIN_PX ||
    bounds.maxY >= CODEX_PET_CELL_HEIGHT - CELL_SAFE_MARGIN_PX
  ) {
    throw new CodexPetPackageValidationError(
      'PNG_CELL_CLIPPED',
      `${row}행 ${column}열의 가시 pixel이 4px 안전 여백을 침범합니다.`,
      { column, row, state },
    )
  }
}

function validateCellAlpha(
  decoded: DecodedCodexPetPng,
  allowEdgeClipping: boolean,
): void {
  if (
    decoded.width !== CODEX_PET_ATLAS_WIDTH ||
    decoded.height !== CODEX_PET_ATLAS_HEIGHT
  ) {
    throw new CodexPetPackageValidationError(
      'PNG_GEOMETRY_INVALID',
      'decode된 spritesheet 크기는 1536x2288이어야 합니다.',
    )
  }
  if (decoded.data.length !== decoded.width * decoded.height * 4) {
    throw new CodexPetPackageValidationError(
      'PNG_DECODE_FAILED',
      'decode된 spritesheet RGBA 길이가 유효하지 않습니다.',
    )
  }
  if (
    CODEX_PET_ATLAS_COLUMNS * CODEX_PET_CELL_WIDTH !== decoded.width ||
    CODEX_PET_ATLAS_ROWS * CODEX_PET_CELL_HEIGHT !== decoded.height
  ) {
    throw new CodexPetPackageValidationError(
      'PNG_GEOMETRY_INVALID',
      'Codex Pet cell 계약과 atlas 크기가 일치하지 않습니다.',
    )
  }

  let standardUnion: CellAlphaBounds | null = null
  for (const state of CODEX_PET_STATES) {
    for (let column = 0; column < state.frameCount; column += 1) {
      const bounds = measureCellAlphaBounds(decoded.data, state.row, column)
      if (!bounds) {
        throw new CodexPetPackageValidationError(
          'PNG_CELL_EMPTY',
          state.id + ' 상태의 ' + column + '번 frame이 비어 있습니다.',
          { column, row: state.row, state: state.id },
        )
      }
      if (!allowEdgeClipping) {
        assertCellSafeMargin(bounds, state.row, column, state.id)
      }
      standardUnion = mergeCellAlphaBounds(standardUnion, bounds)
    }
    for (
      let column = state.frameCount;
      column < CODEX_PET_ATLAS_COLUMNS;
      column += 1
    ) {
      if (cellHasAnyAlpha(decoded.data, state.row, column)) {
        throw new CodexPetPackageValidationError(
          'PNG_UNUSED_CELL_NOT_TRANSPARENT',
          state.row + '행 ' + column + '열의 미사용 cell이 투명하지 않습니다.',
          { column, row: state.row, state: state.id },
        )
      }
    }
  }

  for (const direction of CODEX_PET_LOOK_DIRECTIONS) {
    const bounds = measureCellAlphaBounds(
      decoded.data,
      direction.row,
      direction.column,
    )
    if (!bounds) {
      throw new CodexPetPackageValidationError(
        'PNG_CELL_EMPTY',
        direction.row +
          '행 ' +
          direction.column +
          '열의 look direction cell이 비어 있습니다.',
        { column: direction.column, row: direction.row },
      )
    }
    if (!allowEdgeClipping) {
      assertCellSafeMargin(bounds, direction.row, direction.column)
    }
  }

  if (!standardUnion) {
    throw new CodexPetPackageValidationError(
      'PNG_OCCUPANCY_TOO_SMALL',
      '표준 frame의 가시 점유율을 계산할 수 없습니다.',
      { measured: 0 },
    )
  }

  const occupancy = Math.max(
    (standardUnion.maxX - standardUnion.minX + 1) / CODEX_PET_CELL_WIDTH,
    (standardUnion.maxY - standardUnion.minY + 1) / CODEX_PET_CELL_HEIGHT,
  )
  if (occupancy < MINIMUM_STANDARD_OCCUPANCY) {
    throw new CodexPetPackageValidationError(
      'PNG_OCCUPANCY_TOO_SMALL',
      `표준 frame의 가시 점유율 ${occupancy.toFixed(4)}가 최소 0.70보다 작습니다.`,
      { measured: occupancy },
    )
  }
}

export class CodexPetPackageValidator {
  readonly #allowEdgeClipping: boolean
  readonly #decodePng: CodexPetPngDecoder

  constructor(options: CodexPetPackageValidatorOptions = {}) {
    this.#allowEdgeClipping = options.allowEdgeClipping ?? false
    this.#decodePng = options.decodePng ?? decodeCodexPetPngInBrowser
  }

  async validate(
    input: ArrayBuffer | Blob | Uint8Array,
  ): Promise<ValidatedCodexPetPackage> {
    const zipReader = new ZipReader(new BlobReader(toZipBlob(input)), {
      useWebWorkers: false,
    })

    try {
      const entries = await zipReader.getEntries()
      if (entries.length !== 2 || entries.some((entry) => entry.directory)) {
        throw new CodexPetPackageValidationError(
          'PACKAGE_ENTRY_STRUCTURE_INVALID',
          'ZIP에는 Pet 디렉터리 아래 두 파일만 있어야 합니다.',
        )
      }

      const files = entries as FileEntry[]
      if (files.some((entry) => entry.encrypted)) {
        const encrypted = files.find((entry) => entry.encrypted)!
        throw new CodexPetPackageValidationError(
          'PACKAGE_ENTRY_ENCRYPTED',
          '암호화된 ZIP 항목은 지원하지 않습니다: ' + encrypted.filename,
          { path: encrypted.filename },
        )
      }

      const parsedPaths = files.map((entry) => ({
        entry,
        segments: assertSafeEntryPath(entry),
      }))
      const ids = new Set(parsedPaths.map(({ segments }) => segments[0]))
      if (ids.size !== 1) {
        throw new CodexPetPackageValidationError(
          'PACKAGE_ENTRY_STRUCTURE_INVALID',
          'ZIP에는 하나의 top-level Pet 디렉터리만 있어야 합니다.',
        )
      }
      const id = parsedPaths[0]!.segments[0]
      const byFilename = new Map(
        parsedPaths.map(({ entry, segments }) => [segments[1], entry]),
      )
      const manifestEntry = byFilename.get('pet.json')
      const spritesheetEntry = byFilename.get(CODEX_PET_SPRITESHEET_FILENAME)
      if (
        byFilename.size !== 2 ||
        !manifestEntry ||
        !spritesheetEntry
      ) {
        throw new CodexPetPackageValidationError(
          'PACKAGE_ENTRY_STRUCTURE_INVALID',
          'ZIP에는 pet.json과 spritesheet.png만 있어야 합니다.',
        )
      }

      assertEntrySize(
        manifestEntry,
        MAX_MANIFEST_BYTES,
        'MANIFEST_INVALID',
      )
      assertEntrySize(
        spritesheetEntry,
        CODEX_PET_MAX_SPRITESHEET_BYTES,
        'PNG_TOO_LARGE',
      )
      const readOptions = {
        checkOverlappingEntry: true,
        checkSignature: true,
        useWebWorkers: false,
      } as const
      const manifestBytes = await manifestEntry.getData(
        new Uint8ArrayWriter(),
        readOptions,
      )
      const spritesheetBytes = await spritesheetEntry.getData(
        new Uint8ArrayWriter(),
        readOptions,
      )
      const manifest = parseManifest(manifestBytes, id)
      const geometry = readPngGeometry(spritesheetBytes)
      if (
        geometry.width !== CODEX_PET_ATLAS_WIDTH ||
        geometry.height !== CODEX_PET_ATLAS_HEIGHT
      ) {
        throw new CodexPetPackageValidationError(
          'PNG_GEOMETRY_INVALID',
          'spritesheet 크기는 1536x2288이어야 합니다.',
        )
      }

      let decoded: DecodedCodexPetPng
      try {
        decoded = await this.#decodePng(spritesheetBytes)
      } catch (error) {
        if (error instanceof CodexPetPackageValidationError) {
          throw error
        }
        throw new CodexPetPackageValidationError(
          'PNG_DECODE_FAILED',
          'spritesheet.png를 RGBA pixel로 decode할 수 없습니다.',
          { cause: error },
        )
      }
      validateCellAlpha(decoded, this.#allowEdgeClipping)

      return {
        id,
        manifest,
        spritesheet: new Blob([spritesheetBytes.slice().buffer], {
          type: 'image/png',
        }),
        spritesheetBytes,
      }
    } catch (error) {
      if (error instanceof CodexPetPackageValidationError) {
        throw error
      }
      throw new CodexPetPackageValidationError(
        'PACKAGE_ZIP_INVALID',
        'Codex Pet ZIP을 읽거나 검증할 수 없습니다.',
        { cause: error },
      )
    } finally {
      await zipReader.close().catch(() => undefined)
    }
  }
}

export function validateCodexPetPackage(
  input: ArrayBuffer | Blob | Uint8Array,
  options: CodexPetPackageValidatorOptions = {},
): Promise<ValidatedCodexPetPackage> {
  return new CodexPetPackageValidator(options).validate(input)
}
