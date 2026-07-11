export function appendSkeletonTerminator(data: ArrayBuffer): ArrayBuffer {
  const source = new Uint8Array(data)
  const padded = new Uint8Array(source.byteLength + 1)
  padded.set(source)
  return padded.buffer
}
