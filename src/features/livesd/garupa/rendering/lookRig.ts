import type { LiveSDProjection } from '../../rendering/alphaBounds'
import {
  calculateLiveSDLookWorldDelta,
  calculateLiveSDLookWorldDeltaFromTarget,
  convertLiveSDWorldDeltaToLocal,
  LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX,
  LIVE_SD_LOOK_VERTICAL_RADIUS_PX,
  type LiveSDLookDelta,
  type LiveSDLookTarget,
} from '../../rendering/lookTarget'
import { GarupaRenderingError } from './errors'
import type {
  GarupaRuntimeBone,
  GarupaRuntimeSlot,
  GarupaSpine40RuntimeSession,
} from './types'

const PARENT_DETERMINANT_EPSILON = 1e-8

export interface GarupaDualEyeRig {
  readonly left: GarupaRuntimeBone
  readonly right: GarupaRuntimeBone
}

export interface GarupaAppliedEyeDeltas {
  readonly left: LiveSDLookDelta
  readonly right: LiveSDLookDelta
  readonly world: LiveSDLookDelta
}

function isBoneAtOrBelow(
  bone: GarupaRuntimeBone,
  ancestor: GarupaRuntimeBone,
): boolean {
  let current: GarupaRuntimeBone | null = bone
  while (current) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}

function hasVisibleEyeAttachment(
  slots: readonly GarupaRuntimeSlot[],
  eyeBone: GarupaRuntimeBone,
): boolean {
  return slots.some((slot) => {
    const attachment = slot.attachment
    if (
      !isBoneAtOrBelow(slot.bone, eyeBone) ||
      slot.alpha <= 0 ||
      !attachment ||
      attachment.alpha <= 0
    ) {
      return false
    }

    const name = `${slot.name} ${attachment.name}`
    return (
      /eye/i.test(name) &&
      !/eyebrow/i.test(name) &&
      Number.isFinite(attachment.width) &&
      Number.isFinite(attachment.height) &&
      attachment.width > 1 &&
      attachment.height > 1
    )
  })
}

function parentMatrix(bone: GarupaRuntimeBone): {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
} {
  const parent = bone.parent
  if (!parent) {
    throw new GarupaRenderingError(
      'GARUPA_LOOK_RIG_UNSUPPORTED',
      'A Garupa eye bone does not have a parent transform.',
      { boneName: bone.name },
    )
  }

  const matrix = { a: parent.a, b: parent.b, c: parent.c, d: parent.d }
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (
    !Object.values(matrix).every(Number.isFinite) ||
    !Number.isFinite(determinant) ||
    Math.abs(determinant) < PARENT_DETERMINANT_EPSILON
  ) {
    throw new GarupaRenderingError(
      'GARUPA_LOOK_RIG_UNSUPPORTED',
      'A Garupa eye parent transform is singular.',
      { boneName: bone.name },
    )
  }
  return matrix
}

export function resolveGarupaDualEyeRig(
  session: GarupaSpine40RuntimeSession,
): GarupaDualEyeRig {
  const left = session.findBone('F_eyeL')
  const right = session.findBone('F_eyeR')
  if (!left || !right) {
    throw new GarupaRenderingError(
      'GARUPA_LOOK_RIG_UNSUPPORTED',
      'Garupa paired eye bones are unavailable.',
      { leftFound: Boolean(left), rightFound: Boolean(right) },
    )
  }

  parentMatrix(left)
  parentMatrix(right)
  if (
    !hasVisibleEyeAttachment(session.slots, left) ||
    !hasVisibleEyeAttachment(session.slots, right)
  ) {
    throw new GarupaRenderingError(
      'GARUPA_LOOK_RIG_UNSUPPORTED',
      'Garupa paired eye attachments are not visible.',
      { stage: 'attachment-validation' },
    )
  }

  return { left, right }
}

function applyWorldDelta(
  rig: GarupaDualEyeRig,
  world: LiveSDLookDelta,
): GarupaAppliedEyeDeltas {
  let left: LiveSDLookDelta
  let right: LiveSDLookDelta
  try {
    left = convertLiveSDWorldDeltaToLocal(parentMatrix(rig.left), world)
    right = convertLiveSDWorldDeltaToLocal(parentMatrix(rig.right), world)
  } catch (error) {
    throw new GarupaRenderingError(
      'GARUPA_LOOK_RIG_UNSUPPORTED',
      'Garupa eye parent transforms cannot represent the gaze delta.',
      { stage: 'world-to-local' },
      { cause: error },
    )
  }

  rig.left.x += left.x
  rig.left.y += left.y
  rig.right.x += right.x
  rig.right.y += right.y
  return { left, right, world }
}

export function applyGarupaGazeDirection(
  rig: GarupaDualEyeRig,
  projection: LiveSDProjection,
  directionDegrees: number,
  movementScale = 1,
): GarupaAppliedEyeDeltas {
  const world = calculateLiveSDLookWorldDelta(
    projection,
    directionDegrees,
    LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX * movementScale,
    LIVE_SD_LOOK_VERTICAL_RADIUS_PX * movementScale,
  )
  return applyWorldDelta(rig, world)
}

export function applyGarupaGazeTarget(
  rig: GarupaDualEyeRig,
  projection: LiveSDProjection,
  target: LiveSDLookTarget,
  movementScale = 1,
): GarupaAppliedEyeDeltas {
  const world = calculateLiveSDLookWorldDeltaFromTarget(
    projection,
    target,
    LIVE_SD_LOOK_HORIZONTAL_RADIUS_PX * movementScale,
    LIVE_SD_LOOK_VERTICAL_RADIUS_PX * movementScale,
  )
  return applyWorldDelta(rig, world)
}
