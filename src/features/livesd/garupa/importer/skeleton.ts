import { readSpine40SkeletonHeaderFields } from '../../runtime/skeletonRuntimeHeader'
import { GarupaPackImportError } from './errors'
import type { GarupaSpineSkeletonHeader } from './types'

const SPINE_40_VERSION = /^4\.0(?:\.\d+)?$/u
const VERIFIED_GARUPA_VERSION = '4.0.64'

export function inspectGarupaSpineSkeleton(
  data: ArrayBuffer,
): GarupaSpineSkeletonHeader {
  let hash: string | null
  let version: string | null

  try {
    const fields = readSpine40SkeletonHeaderFields(data)
    hash = fields.hash
    version = fields.version
  } catch (error) {
    throw new GarupaPackImportError(
      'GARUPA_SKELETON_CORRUPT',
      'Garupa skeleton binary header가 손상되었습니다.',
      { cause: error },
    )
  }

  if (!version) {
    throw new GarupaPackImportError(
      'GARUPA_SKELETON_CORRUPT',
      'Garupa skeleton binary header에 version이 없습니다.',
    )
  }
  if (!SPINE_40_VERSION.test(version)) {
    throw new GarupaPackImportError(
      'GARUPA_SKELETON_UNSUPPORTED_VERSION',
      `지원하지 않는 Garupa Spine version입니다: ${version}`,
      { actualVersion: version },
    )
  }

  return Object.freeze({
    hash,
    version,
    compatibility:
      version === VERIFIED_GARUPA_VERSION ? 'verified' : 'experimental',
  })
}

export { VERIFIED_GARUPA_VERSION }
