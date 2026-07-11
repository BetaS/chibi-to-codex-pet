import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  LiveSD36RuntimeLoader,
  SPINE_36_RUNTIME_LICENSE_URL,
  SPINE_36_RUNTIME_NOTICES_URL,
  SPINE_36_RUNTIME_URL,
  type Spine36Runtime,
} from './runtimeLoader'

function createRuntime(): Spine36Runtime {
  return {
    AtlasAttachmentLoader: class {},
    SkeletonBinary: class {},
    TextureAtlas: class {},
    webgl: { GLTexture: class {} },
  } as unknown as Spine36Runtime
}

function pendingRuntimeScript(): HTMLScriptElement {
  const script = document.querySelector<HTMLScriptElement>(
    'script[data-livesd-runtime="3.6"]',
  )
  expect(script).not.toBeNull()
  return script as HTMLScriptElement
}

afterEach(() => {
  Reflect.deleteProperty(window, 'spine')
  document
    .querySelectorAll('script[data-livesd-runtime="3.6"]')
    .forEach((script) => script.remove())
  vi.restoreAllMocks()
})

describe('LiveSD36RuntimeLoader', () => {
  it('Vite base path 아래의 runtime과 고지 URL을 제공한다', () => {
    const runtimeRoot =
      `${import.meta.env.BASE_URL}vendor/estertion-spine-3.6`

    expect(SPINE_36_RUNTIME_URL).toBe(`${runtimeRoot}/spine-webgl.js`)
    expect(SPINE_36_RUNTIME_LICENSE_URL).toBe(`${runtimeRoot}/LICENSE`)
    expect(SPINE_36_RUNTIME_NOTICES_URL).toBe(
      `${runtimeRoot}/THIRD_PARTY_NOTICES.md`,
    )
  })

  it('필수 API shape을 가진 기존 global을 script 없이 재사용한다', async () => {
    const runtime = createRuntime()
    window.spine = runtime
    const append = vi.spyOn(document.head, 'append')

    await expect(new LiveSD36RuntimeLoader().load()).resolves.toBe(runtime)
    expect(append).not.toHaveBeenCalled()
  })

  it('same-origin classic script 하나와 동시 load promise를 재사용한다', async () => {
    const loader = new LiveSD36RuntimeLoader()
    const first = loader.load()
    const second = loader.load()
    const script = pendingRuntimeScript()

    expect(first).toBe(second)
    expect(script.getAttribute('src')).toBe(SPINE_36_RUNTIME_URL)
    expect(document.querySelectorAll('script[data-livesd-runtime="3.6"]')).toHaveLength(1)

    const runtime = createRuntime()
    window.spine = runtime
    script.dispatchEvent(new Event('load'))

    await expect(first).resolves.toBe(runtime)
    await expect(second).resolves.toBe(runtime)
    expect(script.isConnected).toBe(false)
  })

  it('script 오류를 구분하고 실패한 promise를 지운 뒤 재시도한다', async () => {
    const loader = new LiveSD36RuntimeLoader()
    const failed = loader.load()
    pendingRuntimeScript().dispatchEvent(new Event('error'))

    await expect(failed).rejects.toMatchObject({
      code: 'RUNTIME_SCRIPT_LOAD_FAILED',
    })

    const retried = loader.load()
    const retryScript = pendingRuntimeScript()
    const runtime = createRuntime()
    window.spine = runtime
    retryScript.dispatchEvent(new Event('load'))

    await expect(retried).resolves.toBe(runtime)
  })

  it('load 뒤 global API shape가 없으면 구분된 오류를 반환하고 재시도한다', async () => {
    const loader = new LiveSD36RuntimeLoader()
    const failed = loader.load()
    pendingRuntimeScript().dispatchEvent(new Event('load'))

    await expect(failed).rejects.toMatchObject({
      code: 'RUNTIME_GLOBAL_MISSING',
    })

    const retried = loader.load()
    const retryScript = pendingRuntimeScript()
    const runtime = createRuntime()
    window.spine = runtime
    retryScript.dispatchEvent(new Event('load'))

    await expect(retried).resolves.toBe(runtime)
  })
})
