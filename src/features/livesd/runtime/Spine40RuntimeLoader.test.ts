import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  SPINE_40_RUNTIME_LICENSE_URL,
  SPINE_40_RUNTIME_NOTICES_URL,
  Spine40RuntimeLoader,
  type Spine40Runtime,
} from './Spine40RuntimeLoader'
import type { Spine36Runtime } from './runtimeLoader'

function createSpine40Runtime(): Spine40Runtime {
  return {
    AnimationState: class {},
    AnimationStateData: class {},
    AtlasAttachmentLoader: class {},
    GLTexture: class {},
    ManagedWebGLRenderingContext: class {},
    Matrix4: class {},
    MixBlend: { setup: 0 },
    MixDirection: { mixIn: 0 },
    PolygonBatcher: class {},
    Shader: class {},
    Skeleton: class {},
    SkeletonBinary: class {},
    SkeletonRenderer: class {},
    TextureAtlas: class {},
    Vector2: class {},
  } as unknown as Spine40Runtime
}

function createSpine36Runtime(): Spine36Runtime {
  return {
    AtlasAttachmentLoader: class {},
    SkeletonBinary: class {},
    TextureAtlas: class {},
    webgl: { GLTexture: class {} },
  } as unknown as Spine36Runtime
}

afterEach(() => {
  Reflect.deleteProperty(window, 'spine')
  vi.restoreAllMocks()
})

describe('Spine40RuntimeLoader', () => {
  it('deployment base 아래의 원문 license와 notice URL을 제공한다', () => {
    const root =
      `${import.meta.env.BASE_URL}vendor/esotericsoftware-spine-4.0.31`
    expect(SPINE_40_RUNTIME_LICENSE_URL).toBe(`${root}/LICENSE`)
    expect(SPINE_40_RUNTIME_NOTICES_URL).toBe(
      `${root}/THIRD_PARTY_NOTICES.md`,
    )
  })

  it('동시 load가 하나의 ESM import promise와 module identity를 재사용한다', async () => {
    const runtime = createSpine40Runtime()
    let resolveImport: ((value: Spine40Runtime) => void) | undefined
    const importRuntime = vi.fn(
      () => new Promise<Spine40Runtime>((resolve) => {
        resolveImport = resolve
      }),
    )
    const loader = new Spine40RuntimeLoader(importRuntime)

    const first = loader.load()
    const second = loader.load()
    expect(first).toBe(second)
    expect(importRuntime).toHaveBeenCalledOnce()

    resolveImport?.(runtime)
    await expect(first).resolves.toBe(runtime)
    await expect(second).resolves.toBe(runtime)
  })

  it('기존 Spine 3.6 global identity를 변경하지 않는다', async () => {
    const spine36 = createSpine36Runtime()
    window.spine = spine36
    const runtime = createSpine40Runtime()

    await expect(
      new Spine40RuntimeLoader(async () => runtime).load(),
    ).resolves.toBe(runtime)
    expect(window.spine).toBe(spine36)
    expect(runtime).not.toBe(spine36)
  })

  it('고정 설치된 공식 ESM 4.0.31 namespace를 실제로 lazy load한다', async () => {
    const spine36 = createSpine36Runtime()
    window.spine = spine36

    const runtime = await new Spine40RuntimeLoader().load()

    expect(runtime.SkeletonBinary).toBeTypeOf('function')
    expect(runtime.TextureAtlas).toBeTypeOf('function')
    expect(runtime.GLTexture).toBeTypeOf('function')
    expect(window.spine).toBe(spine36)
    expect(Reflect.has(runtime, 'webgl')).toBe(false)
    expect(Reflect.has(runtime, 'LoadingScreen')).toBe(false)
  })

  it('불완전한 API shape를 stable 오류로 거부하고 다음 load에서 재시도한다', async () => {
    const runtime = createSpine40Runtime()
    const importRuntime = vi
      .fn<() => Promise<Spine40Runtime>>()
      .mockResolvedValueOnce({} as Spine40Runtime)
      .mockResolvedValueOnce(runtime)
    const loader = new Spine40RuntimeLoader(importRuntime)

    await expect(loader.load()).rejects.toMatchObject({
      code: 'RUNTIME_PROFILE_API_INVALID',
    })
    await expect(loader.load()).resolves.toBe(runtime)
    expect(importRuntime).toHaveBeenCalledTimes(2)
  })

  it('ESM import 실패를 profile load 오류로 격리하고 3.6 global을 유지한다', async () => {
    const spine36 = createSpine36Runtime()
    window.spine = spine36
    const loader = new Spine40RuntimeLoader(async () => {
      throw new Error('import exploded')
    })

    await expect(loader.load()).rejects.toMatchObject({
      code: 'RUNTIME_PROFILE_LOAD_FAILED',
      context: expect.objectContaining({ runtimeKey: 'spine-4.0' }),
    })
    expect(window.spine).toBe(spine36)
  })

  it('importer가 기존 3.6 global을 바꾸면 identity를 복구하고 거부한다', async () => {
    const original = createSpine36Runtime()
    window.spine = original
    const loader = new Spine40RuntimeLoader(async () => {
      window.spine = createSpine36Runtime()
      return createSpine40Runtime()
    })

    await expect(loader.load()).rejects.toMatchObject({
      code: 'RUNTIME_PROFILE_API_INVALID',
    })
    expect(window.spine).toBe(original)
  })
})
