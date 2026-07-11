import {
  TextReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from '@zip.js/zip.js'

export interface ZipFixtureEntry {
  readonly content?: string | Uint8Array
  readonly name: string
  readonly password?: string
}

export const VALID_ATLAS = `
page.png
size: 1,1
format: RGBA8888
filter: Linear,Linear
repeat: none
region
  rotate: false
  xy: 0,0
  size: 1,1
  orig: 1,1
  offset: 0,0
  index: -1
`

export async function createZipFile(
  entries: readonly ZipFixtureEntry[],
  name = 'character.zip',
): Promise<File> {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
  })

  for (const entry of entries) {
    const reader =
      entry.content instanceof Uint8Array
        ? new Uint8ArrayReader(entry.content)
        : new TextReader(entry.content ?? '')
    await writer.add(entry.name, reader, {
      level: 0,
      password: entry.password,
      useWebWorkers: false,
    })
  }

  const bytes = await writer.close()
  return new File([bytes], name, { type: 'application/zip' })
}

interface MetadataZipEntry {
  readonly name: string
  readonly uncompressedSize?: number
}

function writeUint16(view: DataView, offset: number, value: number): number {
  view.setUint16(offset, value, true)
  return offset + 2
}

function writeUint32(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value, true)
  return offset + 4
}

/** ZIP metadata validation tests can avoid allocating the advertised payload. */
export function createMetadataOnlyZipFile(
  entries: readonly MetadataZipEntry[],
  name = 'metadata.zip',
): File {
  const encoder = new TextEncoder()
  const names = entries.map((entry) => encoder.encode(entry.name))
  const localSize = names.reduce((total, bytes) => total + 30 + bytes.length, 0)
  const centralSize = names.reduce((total, bytes) => total + 46 + bytes.length, 0)
  const bytes = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(bytes.buffer)
  const localOffsets: number[] = []
  let offset = 0

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const nameBytes = names[index]
    if (!entry || !nameBytes) continue

    localOffsets.push(offset)
    offset = writeUint32(view, offset, 0x04034b50)
    offset = writeUint16(view, offset, 20)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint32(view, offset, 0)
    offset = writeUint32(view, offset, 0)
    offset = writeUint32(view, offset, entry.uncompressedSize ?? 0)
    offset = writeUint16(view, offset, nameBytes.length)
    offset = writeUint16(view, offset, 0)
    bytes.set(nameBytes, offset)
    offset += nameBytes.length
  }

  const centralOffset = offset
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const nameBytes = names[index]
    if (!entry || !nameBytes) continue

    offset = writeUint32(view, offset, 0x02014b50)
    offset = writeUint16(view, offset, 20)
    offset = writeUint16(view, offset, 20)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint32(view, offset, 0)
    offset = writeUint32(view, offset, 0)
    offset = writeUint32(view, offset, entry.uncompressedSize ?? 0)
    offset = writeUint16(view, offset, nameBytes.length)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint16(view, offset, 0)
    offset = writeUint32(view, offset, 0)
    offset = writeUint32(view, offset, localOffsets[index] ?? 0)
    bytes.set(nameBytes, offset)
    offset += nameBytes.length
  }

  offset = writeUint32(view, offset, 0x06054b50)
  offset = writeUint16(view, offset, 0)
  offset = writeUint16(view, offset, 0)
  offset = writeUint16(view, offset, entries.length)
  offset = writeUint16(view, offset, entries.length)
  offset = writeUint32(view, offset, centralSize)
  offset = writeUint32(view, offset, centralOffset)
  writeUint16(view, offset, 0)

  return new File([bytes], name, { type: 'application/zip' })
}
