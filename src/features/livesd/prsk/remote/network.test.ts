import { describe, expect, it, vi } from 'vitest'

import { readLimitedResponseBody } from './network'
import type { PrskRemoteResourceKind } from './types'

function options(
  signal: AbortSignal,
  resource: PrskRemoteResourceKind = 'catalog',
) {
  return {
    signal,
    resource,
    tooLargeCode:
      resource === 'catalog'
        ? 'REMOTE_CATALOG_TOO_LARGE' as const
        : 'REMOTE_RESOURCE_TOO_LARGE' as const,
    url: `https://example.com/${resource}`,
  }
}

describe('readLimitedResponseBody', () => {
  it('Content-Length의 정확한 상한을 허용하고 초과는 body read 전에 취소한다', async () => {
    const signal = new AbortController().signal
    await expect(
      readLimitedResponseBody(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { 'content-length': '4' },
        }),
        4,
        options(signal),
      ),
    ).resolves.toHaveProperty('byteLength', 4)

    const cancel = vi.fn(async () => undefined)
    const response = {
      headers: new Headers({ 'content-length': '5' }),
      body: { cancel },
    } as unknown as Response
    await expect(
      readLimitedResponseBody(response, 4, options(signal)),
    ).rejects.toMatchObject({ code: 'REMOTE_CATALOG_TOO_LARGE' })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('Content-Length가 없는 chunk stream을 누적하고 정확한 상한을 허용한다', async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]))
          controller.enqueue(new Uint8Array([3, 4]))
          controller.close()
        },
      }),
    )
    const buffer = await readLimitedResponseBody(
      response,
      4,
      options(new AbortController().signal),
    )
    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3, 4])
  })

  it('chunk stream 누적 초과 시 reader를 취소한다', async () => {
    const cancel = vi.fn()
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]))
          controller.enqueue(new Uint8Array([3, 4, 5]))
        },
        cancel,
      }),
    )

    await expect(
      readLimitedResponseBody(
        response,
        4,
        options(new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: 'REMOTE_CATALOG_TOO_LARGE' })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it.each(['skeleton', 'atlas', 'png'] as const)(
    '%s reader도 Content-Length 없이 정확한 상한과 chunk 누적 초과를 구분한다',
    async (resource) => {
      const exact = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2]))
            controller.enqueue(new Uint8Array([3, 4]))
            controller.close()
          },
        }),
      )
      await expect(
        readLimitedResponseBody(
          exact,
          4,
          options(new AbortController().signal, resource),
        ),
      ).resolves.toHaveProperty('byteLength', 4)

      const overflow = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]))
            controller.enqueue(new Uint8Array([4, 5]))
          },
        }),
      )
      await expect(
        readLimitedResponseBody(
          overflow,
          4,
          options(new AbortController().signal, resource),
        ),
      ).rejects.toMatchObject({ code: 'REMOTE_RESOURCE_TOO_LARGE', resource })
    },
  )

  it('진행 중 reader를 사용자 abort로 취소하고 abort 코드를 유지한다', async () => {
    const cancel = vi.fn()
    const response = new Response(new ReadableStream({ cancel }))
    const controller = new AbortController()
    const pending = readLimitedResponseBody(response, 4, options(controller.signal))
    const expectation = expect(pending).rejects.toMatchObject({
      code: 'REMOTE_ABORTED',
    })

    controller.abort()

    await expectation
    expect(cancel).toHaveBeenCalledOnce()
  })
})
