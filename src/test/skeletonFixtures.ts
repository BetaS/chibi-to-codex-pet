function encodeVarInt(value: number): number[] {
  const bytes: number[] = []
  let remaining = value

  do {
    let byte = remaining & 0x7f
    remaining >>>= 7
    if (remaining > 0) byte |= 0x80
    bytes.push(byte)
  } while (remaining > 0)

  return bytes
}

function encodeSkeletonString(value: string | null): number[] {
  if (value === null) return [0]

  const bytes = [...new TextEncoder().encode(value)]
  return [...encodeVarInt(bytes.length + 1), ...bytes]
}

export function createSkeletonHeader(
  version: string,
  hash = 'fixture-hash',
): ArrayBuffer {
  return new Uint8Array([
    ...encodeSkeletonString(hash),
    ...encodeSkeletonString(version),
    1,
    2,
    3,
  ]).buffer
}

export const SPINE_40_FIXTURE_HASH = '2064b5e6-650e410b'

export function createSpine40SkeletonHeader(version: string): ArrayBuffer {
  return new Uint8Array([
    0x9a,
    0xf1,
    0xbe,
    0xf5,
    0x20,
    0x64,
    0xb5,
    0xe6,
    ...encodeSkeletonString(version),
    1,
    2,
    3,
  ]).buffer
}
