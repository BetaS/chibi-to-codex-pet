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
