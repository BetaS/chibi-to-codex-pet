import { describe, expect, it, vi, type Mock } from 'vitest'

import {
  createSkeletonHeader,
  createSpine40SkeletonHeader,
  SPINE_40_FIXTURE_HASH,
} from '../../../test/skeletonFixtures'
import { readSpineRuntimeSkeletonHeader } from './skeletonRuntimeHeader'
import { SpineVersionedRuntimeRegistry } from './versionedRuntimeRegistry'
import type {
  SpineRuntimeKey,
  SpineRuntimeProfileAdapter,
} from './versionedRuntimeTypes'

function createAdapter(
  runtimeKey: SpineRuntimeKey,
  adapterIdentity = `${runtimeKey}:fixture`,
): SpineRuntimeProfileAdapter & { readonly load: Mock<() => Promise<void>> } {
  const load = vi.fn<() => Promise<void>>(async () => undefined)
  return {
    adapterIdentity,
    runtimeKey,
    createSession: vi.fn(async () => {
      throw new Error('createSession is not used by this registry test.')
    }),
    load,
  } as SpineRuntimeProfileAdapter & {
    readonly load: Mock<() => Promise<void>>
  }
}

function createRuntimeSkeletonHeader(version: string): ArrayBuffer {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10)
  return major >= 4
    ? createSpine40SkeletonHeader(version)
    : createSkeletonHeader(version)
}

describe('Spine runtime skeleton header routing', () => {
  it.each([
    ['3.6.53D4', '3.6', 'spine-3.6', 'fixture-hash'],
    ['4.0.64', '4.0', 'spine-4.0', SPINE_40_FIXTURE_HASH],
  ] as const)('%s byte header를 %s profile로 bounded routing한다', (
    version,
    majorMinor,
    runtimeKey,
    hash,
  ) => {
    expect(readSpineRuntimeSkeletonHeader(createRuntimeSkeletonHeader(version))).toEqual({
      hash,
      majorMinor,
      runtimeKey,
      version,
    })
  })

  it.each(['3.8', '4.1.0', '5.0']) (
    '지원하지 않는 %s를 fallback 없이 거부한다',
    (version) => {
      expect(() =>
        readSpineRuntimeSkeletonHeader(createRuntimeSkeletonHeader(version)),
      ).toThrowError(
        expect.objectContaining({
          code: 'RUNTIME_PROFILE_UNSUPPORTED',
          context: expect.objectContaining({ actualVersion: version }),
        }),
      )
    },
  )

  it.each([
    new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x80]).buffer,
    new Uint8Array([2, 0xff, 0]).buffer,
    new Uint8Array([0, 0]).buffer,
    createSkeletonHeader('4.0.64'),
    createSpine40SkeletonHeader('3.6.53'),
  ])('손상된 header를 stable parse 오류로 정규화한다', (data) => {
    expect(() => readSpineRuntimeSkeletonHeader(data)).toThrowError(
      expect.objectContaining({ code: 'RUNTIME_PROFILE_PARSE_FAILED' }),
    )
  })
})

describe('SpineVersionedRuntimeRegistry', () => {
  it('byte profile을 선택하되 runtime은 명시적 session 생성 전 로드하지 않는다', () => {
    const spine36 = createAdapter('spine-3.6')
    const spine40 = createAdapter('spine-4.0')
    const registry = new SpineVersionedRuntimeRegistry([spine36, spine40])

    const selection = registry.select(
      createRuntimeSkeletonHeader('4.0.64'),
      'spine-4.0',
    )

    expect(selection.adapter).toBe(spine40)
    expect(selection.header.version).toBe('4.0.64')
    expect(spine36.load).not.toHaveBeenCalled()
    expect(spine40.load).not.toHaveBeenCalled()
  })

  it('metadata와 실제 byte 불일치를 runtime load 전에 거부한다', () => {
    const spine36 = createAdapter('spine-3.6')
    const spine40 = createAdapter('spine-4.0')
    const registry = new SpineVersionedRuntimeRegistry([spine36, spine40])

    expect(() =>
      registry.select(createSkeletonHeader('3.6.53'), 'spine-4.0'),
    ).toThrowError(
      expect.objectContaining({
        code: 'RUNTIME_PROFILE_MISMATCH',
        context: {
          actualVersion: '3.6.53',
          requestedRuntimeKey: 'spine-4.0',
          runtimeKey: 'spine-3.6',
        },
      }),
    )
    expect(spine36.load).not.toHaveBeenCalled()
    expect(spine40.load).not.toHaveBeenCalled()
  })

  it('ready handoff에 runtime과 adapter identity를 고정하고 drift를 거부한다', () => {
    const spine40 = createAdapter('spine-4.0', 'spine-4.0:exact')
    const registry = new SpineVersionedRuntimeRegistry([spine40])
    const selection = registry.select(
      createRuntimeSkeletonHeader('4.0.64'),
      'spine-4.0',
    )
    const source = { modelName: 'fixture' }
    const handoff = registry.createHandoff(selection, source, {
      x: -10,
      y: -20,
      width: 20,
      height: 40,
    })

    expect(Object.isFrozen(handoff)).toBe(true)
    expect(Object.isFrozen(handoff.canonicalBounds)).toBe(true)
    expect(registry.resolveHandoff(handoff)).toBe(spine40)
    expect(() =>
      registry.resolveHandoff(handoff, 'spine-3.6'),
    ).toThrowError(
      expect.objectContaining({ code: 'RUNTIME_PROFILE_MISMATCH' }),
    )

    const replacementRegistry = new SpineVersionedRuntimeRegistry([
      createAdapter('spine-4.0', 'spine-4.0:replacement'),
    ])
    expect(() => replacementRegistry.resolveHandoff(handoff)).toThrowError(
      expect.objectContaining({ code: 'RUNTIME_PROFILE_MISMATCH' }),
    )
  })

  it('같은 runtime key의 adapter 중복 등록을 거부한다', () => {
    expect(() =>
      new SpineVersionedRuntimeRegistry([
        createAdapter('spine-3.6', 'first'),
        createAdapter('spine-3.6', 'second'),
      ]),
    ).toThrowError(/Duplicate Spine runtime profile/u)
  })
})
