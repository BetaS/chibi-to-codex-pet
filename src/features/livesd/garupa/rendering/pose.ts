import type { LiveSDProjection } from '../../rendering/alphaBounds'
import type { LiveSDLookTarget } from '../../rendering/lookTarget'
import {
  applyGarupaGazeDirection,
  applyGarupaGazeTarget,
  resolveGarupaDualEyeRig,
} from './lookRig'
import type {
  GarupaPlannedFrame,
  GarupaSpine40RuntimeSession,
} from './types'

export function applyGarupaPlannedFramePose(
  session: GarupaSpine40RuntimeSession,
  frame: GarupaPlannedFrame,
  projection?: LiveSDProjection,
  lookMovementScale = 1,
): void {
  session.applyAnimation({
    animationName: frame.animationName,
    duration: frame.animationDuration,
    loop: frame.animationDuration > 0,
    resetToSetupPose: true,
    time: frame.sampleTime,
  })
  session.updateWorldTransform()

  if (frame.lookDirectionDegrees === undefined) return
  if (!projection) {
    throw new RangeError('A look frame requires a canonical projection.')
  }

  applyGarupaGazeDirection(
    resolveGarupaDualEyeRig(session),
    projection,
    frame.lookDirectionDegrees,
    lookMovementScale,
  )
  session.updateWorldTransform()
}

export function applyGarupaPreviewPose(
  session: GarupaSpine40RuntimeSession,
  animationName: string,
  duration: number,
  time: number,
  projection: LiveSDProjection,
  lookTarget: LiveSDLookTarget | null,
  lookMovementScale: number,
): void {
  session.applyAnimation({
    animationName,
    duration,
    loop: duration > 0,
    resetToSetupPose: true,
    time,
  })
  session.updateWorldTransform()

  if (!lookTarget) return
  applyGarupaGazeTarget(
    resolveGarupaDualEyeRig(session),
    projection,
    lookTarget,
    lookMovementScale,
  )
  session.updateWorldTransform()
}
