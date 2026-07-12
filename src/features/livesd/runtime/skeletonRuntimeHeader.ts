import { SpineRuntimeProfileError } from './versionedRuntimeError'
import type {
  SpineRuntimeKey,
  SpineRuntimeSkeletonHeader,
} from './versionedRuntimeTypes'

const MAX_HEADER_STRING_BYTES = 1024 * 1024

class BoundedSkeletonHeaderReader {
  readonly #bytes: Uint8Array
  readonly #view: DataView
  #offset = 0

  constructor(data: ArrayBuffer) {
    this.#bytes = new Uint8Array(data)
    this.#view = new DataView(
      this.#bytes.buffer,
      this.#bytes.byteOffset,
      this.#bytes.byteLength,
    )
  }

  readSpine40Hash(): string | null {
    const lowHash = this.#readInt32()
    const highHash = this.#readInt32()
    return highHash === 0 && lowHash === 0
      ? null
      : highHash.toString(16) + lowHash.toString(16)
  }

  readString(): string | null {
    const encodedLength = this.#readVarInt()
    if (encodedLength === 0) {
      return null
    }

    const byteLength = encodedLength - 1
    if (
      byteLength < 0 ||
      byteLength > MAX_HEADER_STRING_BYTES ||
      byteLength > this.#bytes.byteLength - this.#offset
    ) {
      throw new Error('Invalid bounded skeleton header string length.')
    }

    const value = new TextDecoder('utf-8', { fatal: true }).decode(
      this.#bytes.subarray(this.#offset, this.#offset + byteLength),
    )
    this.#offset += byteLength
    return value
  }

  #readVarInt(): number {
    let value = 0

    for (let index = 0; index < 5; index += 1) {
      const byte = this.#bytes[this.#offset]
      if (byte === undefined) {
        throw new Error('Unexpected end of skeleton header.')
      }
      this.#offset += 1
      value += (byte & 0x7f) * 2 ** (index * 7)
      if ((byte & 0x80) === 0) {
        return value
      }
    }

    throw new Error('Invalid skeleton header varint.')
  }

  #readInt32(): number {
    if (this.#offset + 4 > this.#bytes.byteLength) {
      throw new Error('Unexpected end of Spine 4.0 skeleton hash.')
    }
    const value = this.#view.getInt32(this.#offset)
    this.#offset += 4
    return value
  }
}

interface SpineSkeletonHeaderFields {
  readonly hash: string | null
  readonly version: string | null
}

function readLegacySkeletonHeaderFields(
  data: ArrayBuffer,
): SpineSkeletonHeaderFields {
  const reader = new BoundedSkeletonHeaderReader(data)
  return {
    hash: reader.readString(),
    version: reader.readString(),
  }
}

export function readSpine40SkeletonHeaderFields(
  data: ArrayBuffer,
): SpineSkeletonHeaderFields {
  const reader = new BoundedSkeletonHeaderReader(data)
  return {
    hash: reader.readSpine40Hash(),
    version: reader.readString(),
  }
}

function tryReadHeader(
  reader: (data: ArrayBuffer) => SpineSkeletonHeaderFields,
  data: ArrayBuffer,
): SpineSkeletonHeaderFields | null {
  try {
    return reader(data)
  } catch {
    return null
  }
}

function headerMajor(version: string | null): number | null {
  if (!version) return null
  const match = /^(\d+)\.(\d+)(?:\.|$)/u.exec(version)
  return match ? Number(match[1]) : null
}

function runtimeKeyForVersion(version: string): {
  majorMinor: string
  runtimeKey: SpineRuntimeKey
} {
  const match = /^(\d+)\.(\d+)(?:\.|$)/u.exec(version)
  if (!match) {
    throw new SpineRuntimeProfileError(
      'RUNTIME_PROFILE_UNSUPPORTED',
      `지원하지 않는 Spine skeleton version입니다: ${version}`,
      { actualVersion: version },
    )
  }

  const majorMinor = `${match[1]}.${match[2]}`
  if (majorMinor === '3.6') {
    return { majorMinor, runtimeKey: 'spine-3.6' }
  }
  if (majorMinor === '4.0') {
    return { majorMinor, runtimeKey: 'spine-4.0' }
  }

  throw new SpineRuntimeProfileError(
    'RUNTIME_PROFILE_UNSUPPORTED',
    `지원하지 않는 Spine runtime profile입니다: ${version}`,
    { actualVersion: version },
  )
}

export function readSpineRuntimeSkeletonHeader(
  data: ArrayBuffer,
): SpineRuntimeSkeletonHeader {
  const legacy = tryReadHeader(readLegacySkeletonHeaderFields, data)
  const spine40 = tryReadHeader(readSpine40SkeletonHeaderFields, data)
  const legacyMajor = headerMajor(legacy?.version ?? null)
  const spine40Major = headerMajor(spine40?.version ?? null)
  const legacyMatchesLayout = legacy !== null && legacyMajor !== null && legacyMajor < 4
  const spine40MatchesLayout =
    spine40 !== null && spine40Major !== null && spine40Major >= 4

  if (legacyMatchesLayout === spine40MatchesLayout) {
    throw new SpineRuntimeProfileError(
      'RUNTIME_PROFILE_PARSE_FAILED',
      'Spine skeleton runtime header를 읽지 못했습니다.',
      { actualVersion: null },
    )
  }

  const selectedHeader = legacyMatchesLayout ? legacy : spine40
  if (!selectedHeader) {
    throw new SpineRuntimeProfileError(
      'RUNTIME_PROFILE_PARSE_FAILED',
      'Spine skeleton runtime header를 읽지 못했습니다.',
      { actualVersion: null },
    )
  }
  const { hash, version } = selectedHeader
  if (!version) {
    throw new SpineRuntimeProfileError(
      'RUNTIME_PROFILE_PARSE_FAILED',
      'Spine skeleton runtime header에 version이 없습니다.',
      { actualVersion: null },
    )
  }

  const profile = runtimeKeyForVersion(version)
  return Object.freeze({ hash, version, ...profile })
}
