import { describe, expect, it, vi } from 'vitest'

import type { LiveSDProjection } from '../../rendering/alphaBounds'
import { GarupaRenderingError } from './errors'
import {
  applyGarupaGazeDirection,
  resolveGarupaDualEyeRig,
} from './lookRig'
import { applyGarupaPlannedFramePose } from './pose'
import type {
  GarupaPlannedFrame,
  GarupaRuntimeBone,
  GarupaRuntimeSlot,
  GarupaSpine40RuntimeSession,
} from './types'

const projection: LiveSDProjection = { x: -96, y: -104, width: 192, height: 208 }

function createBone(
  name: string,
  parent: GarupaRuntimeBone | null,
  matrix = { a: 1, b: 0, c: 0, d: 1 },
): GarupaRuntimeBone {
  return { ...matrix, name, parent, x: 0, y: 0 }
}

function eyeSlot(
  name: string,
  bone: GarupaRuntimeBone,
  options: { alpha?: number; attachmentName?: string; size?: number } = {},
): GarupaRuntimeSlot {
  const size = options.size ?? 24
  return {
    alpha: options.alpha ?? 1,
    attachment: {
      alpha: options.alpha ?? 1,
      height: size,
      name: options.attachmentName ?? `${name}_eye`,
      width: size,
    },
    bone,
    name,
  }
}

function createSession(options: {
  leftParent?: GarupaRuntimeBone
  rightParent?: GarupaRuntimeBone
  slots?: readonly GarupaRuntimeSlot[]
} = {}): {
  readonly left: GarupaRuntimeBone
  readonly right: GarupaRuntimeBone
  readonly session: GarupaSpine40RuntimeSession
} {
  const leftParent = options.leftParent ?? createBone('left-parent', null)
  const rightParent = options.rightParent ?? createBone('right-parent', null)
  const left = createBone('F_eyeL', leftParent)
  const right = createBone('F_eyeR', rightParent)
  const bones = new Map([
    [left.name, left],
    [right.name, right],
  ])
  const slots = options.slots ?? [eyeSlot('left-eye', left), eyeSlot('right-eye', right)]

  const session = {
    adapterIdentity: 'mock-4.0',
    animations: [{ duration: 1, name: 'Idle' }],
    applyAnimation: vi.fn(() => {
      left.x = 0
      left.y = 0
      right.x = 0
      right.y = 0
    }),
    dispose: vi.fn(),
    draw: vi.fn(),
    findBone: (name: string) => bones.get(name) ?? null,
    getBounds: () => ({ minX: -1, minY: -1, maxX: 1, maxY: 1 }),
    runtimeKey: 'spine-4.0',
    setProjection: vi.fn(),
    slots,
    updateWorldTransform: vi.fn(),
    version: '4.0.64',
  } satisfies GarupaSpine40RuntimeSession

  return { left, right, session }
}

describe('garupa-dual-eye-v1', () => {
  it('converts one screen delta independently through different parents', () => {
    const leftParent = createBone('left-parent', null)
    const rightParent = createBone('right-parent', null, {
      a: 0,
      b: -1,
      c: 1,
      d: 0,
    })
    const { left, right, session } = createSession({ leftParent, rightParent })

    const deltas = applyGarupaGazeDirection(
      resolveGarupaDualEyeRig(session),
      projection,
      90,
    )

    expect(deltas.world.x).toBeCloseTo(2)
    expect(deltas.world.y).toBeCloseTo(0)
    expect(deltas.left.x).toBeCloseTo(2)
    expect(deltas.left.y).toBeCloseTo(0)
    expect(deltas.right.x).toBeCloseTo(0)
    expect(deltas.right.y).toBeCloseTo(-2)
    expect(left.x).toBeCloseTo(deltas.left.x)
    expect(left.y).toBeCloseTo(deltas.left.y)
    expect(right.x).toBeCloseTo(0)
    expect(right.y).toBeCloseTo(-2)
  })

  it('restarts from the animation pose so eye offsets never accumulate', () => {
    const { left, right, session } = createSession()
    const frame: GarupaPlannedFrame = {
      animationDuration: 1,
      animationName: 'Idle',
      column: 4,
      frameIndex: 4,
      lookDirectionDegrees: 90,
      lookDirectionIndex: 4,
      mirrorX: false,
      row: 9,
      sampleTime: 0,
      stateId: 'idle',
    }

    applyGarupaPlannedFramePose(session, frame, projection)
    const first = { left: left.x, right: right.x }
    applyGarupaPlannedFramePose(session, frame, projection)

    expect({ left: left.x, right: right.x }).toEqual(first)
    expect(session.applyAnimation).toHaveBeenCalledTimes(2)
    expect(session.applyAnimation).toHaveBeenLastCalledWith(
      expect.objectContaining({ resetToSetupPose: true }),
    )
  })

  it('rejects eyebrow, transparent, placeholder and singular rigs', () => {
    const singularParent = createBone('singular', null, {
      a: 1,
      b: 1,
      c: 1,
      d: 1,
    })
    const fixture = createSession({ leftParent: singularParent })
    expect(() => resolveGarupaDualEyeRig(fixture.session)).toThrowError(
      expect.objectContaining<Partial<GarupaRenderingError>>({
        code: 'GARUPA_LOOK_RIG_UNSUPPORTED',
      }),
    )

    const left = createBone('F_eyeL', createBone('left-parent', null))
    const right = createBone('F_eyeR', createBone('right-parent', null))
    const invalid = createSession({
      slots: [
        eyeSlot('left', left, { attachmentName: 'eyebrow', size: 40 }),
        eyeSlot('right', right, { alpha: 0, size: 40 }),
        eyeSlot('placeholder', left, { size: 1 }),
      ],
    })
    expect(() => resolveGarupaDualEyeRig(invalid.session)).toThrowError(
      expect.objectContaining<Partial<GarupaRenderingError>>({
        code: 'GARUPA_LOOK_RIG_UNSUPPORTED',
      }),
    )
  })
})
