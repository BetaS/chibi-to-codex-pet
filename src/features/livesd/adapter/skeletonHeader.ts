import { LiveSDPreviewError } from './errors'
import type {
  LiveSDSkeletonHeader,
  LiveSDSkeletonCompatibility,
} from './types'

const VERIFIED_PRSK_VERSION = '3.6.53'
const VERIFIED_PRSK_PROFILE = '3.6.53D4'

class SkeletonHeaderReader {
  readonly #bytes: Uint8Array
  #offset = 0

  constructor(data: ArrayBuffer) {
    this.#bytes = new Uint8Array(data)
  }

  readString(): string | null {
    const encodedLength = this.#readVarInt()
    if (encodedLength === 0) {
      return null
    }

    const byteLength = encodedLength - 1
    if (
      byteLength < 0 ||
      this.#offset + byteLength > this.#bytes.byteLength
    ) {
      throw new Error('Invalid skeleton header string length')
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
      if (this.#offset >= this.#bytes.byteLength) {
        throw new Error('Unexpected end of skeleton header')
      }

      const byte = this.#bytes[this.#offset]
      this.#offset += 1
      if (byte === undefined) {
        throw new Error('Unexpected end of skeleton header')
      }

      value += (byte & 0x7f) * 2 ** (index * 7)
      if ((byte & 0x80) === 0) {
        return value
      }
    }

    throw new Error('Invalid skeleton header varint')
  }
}

export function inspectLiveSD36Skeleton(
  data: ArrayBuffer,
): LiveSDSkeletonHeader {
  let hash: string | null
  let version: string | null

  try {
    const reader = new SkeletonHeaderReader(data)
    hash = reader.readString()
    version = reader.readString()
  } catch (error) {
    throw new LiveSDPreviewError(
      'SKELETON_HEADER_CORRUPT',
      '공통 스켈레톤의 LiveSD 헤더가 손상되었습니다.',
      { cause: error },
    )
  }

  if (!version) {
    throw new LiveSDPreviewError(
      'SKELETON_HEADER_CORRUPT',
      '공통 스켈레톤 헤더에 버전이 없습니다.',
    )
  }

  return {
    hash,
    version,
    compatibility: classifyLiveSDSkeletonVersion(version),
  }
}

export function classifyLiveSDSkeletonVersion(
  version: string,
): LiveSDSkeletonCompatibility {
  if (version === VERIFIED_PRSK_VERSION || version === VERIFIED_PRSK_PROFILE) {
    return 'verified'
  }

  if (version === '3.6' || version.startsWith('3.6.')) {
    return 'experimental'
  }

  return 'best_effort'
}

export { VERIFIED_PRSK_PROFILE, VERIFIED_PRSK_VERSION }
