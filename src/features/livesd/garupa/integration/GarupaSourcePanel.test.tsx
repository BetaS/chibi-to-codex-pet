import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider, LocaleSelector } from '../../../../i18n'
import type { GarupaCanonicalSource } from '../importer'
import type { GarupaSpine40PreviewSession } from '../rendering'
import { GarupaSourceController } from './GarupaSourceController'
import { GarupaSourcePanel } from './GarupaSourcePanel'

function source(id: string): GarupaCanonicalSource {
  return {
    skeletonData: new ArrayBuffer(4),
    atlasBundle: {
      sourceName: id,
      atlasPath: `costume/${id}.atlas`,
      atlasText: `${id}.png\nsize: 1,1\n`,
      atlasPages: new Map([[`costume/${id}.png`, new Blob()]]),
    },
    metadata: {
      gameId: 'garupa',
      assetFamily: 'sdchara',
      sdAssetBundleName: id,
      modelName: 's000_templete',
      runtimeKey: 'spine-4.0',
      skeletonVersion: '4.0.64',
      skeletonHeaderHash: 'fixture',
      compatibility: 'verified',
      fileSha256: {},
      provenance: {
        sourceKind: 'synthetic-test',
        sourceRevision: 'a'.repeat(40),
        acquiredAt: '2026-07-11T00:00:00Z',
      },
      alphaMode: 'straight',
      lookRigProfile: 'garupa-dual-eye-v1',
    },
  }
}

function preview(id: string): GarupaSpine40PreviewSession {
  return {
    adapterIdentity: `adapter:${id}`,
    animations: ['Idle'],
    compatibility: 'verified',
    currentAnimation: 'Idle',
    framingOffset: { x: 0, y: 0 },
    framingScale: 1,
    lookRigSupported: true,
    runtimeKey: 'spine-4.0',
    version: '4.0.64',
    dispose: vi.fn(),
    onError: vi.fn(() => () => undefined),
    play: vi.fn(),
    resize: vi.fn(),
    setFramingOffset: vi.fn(),
    setFramingScale: vi.fn(),
    setLookTarget: vi.fn(),
    setMirrorX: vi.fn(),
  }
}

function renderPanel(controller: GarupaSourceController) {
  return render(
    <I18nProvider initialLocale="ko" storage={null}>
      <LocaleSelector />
      <GarupaSourcePanel controller={controller} />
    </I18nProvider>,
  )
}

describe('Garupa source panel lifecycle', () => {
  it('mount, manifest display, and file selection perform no work until explicit load', async () => {
    const user = userEvent.setup()
    const localSource = source('local-00001')
    const importLocal = vi.fn(async () => localSource)
    const materializePinned = vi.fn(async () => source('remote-00001'))
    const createPreview = vi.fn(async () => preview('local'))
    const controller = new GarupaSourceController({
      createPreview,
      importLocal,
      materializePinned,
    })
    renderPanel(controller)

    expect(
      screen.getByText('https://github.com/panxuc/bangdream-live2d'),
    ).toBeVisible()
    expect(importLocal).not.toHaveBeenCalled()
    expect(materializePinned).not.toHaveBeenCalled()
    expect(createPreview).not.toHaveBeenCalled()

    await user.upload(
      screen.getByLabelText('Garupa Spine pack ZIP 선택'),
      new File(['fixture'], 'character.zip', { type: 'application/zip' }),
    )
    expect(importLocal).not.toHaveBeenCalled()
    expect(materializePinned).not.toHaveBeenCalled()
    expect(createPreview).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '불러오기' }))
    await waitFor(() =>
      expect(
        screen.getByText('Garupa의 첫 visible preview frame이 준비되었습니다.'),
      ).toBeVisible(),
    )
    expect(importLocal).toHaveBeenCalledOnce()
    expect(materializePinned).not.toHaveBeenCalled()
    expect(createPreview).toHaveBeenCalledOnce()
    expect(controller.getActiveSource()).toBe(localSource)
  })

  it('starts pinned requests only on load and preserves the previous ready source on failure', async () => {
    const user = userEvent.setup()
    const localSource = source('local-ready')
    const remoteSource = source('remote-fails')
    const readyPreview = preview('ready')
    const importLocal = vi.fn(async () => localSource)
    const materializePinned = vi.fn(async () => remoteSource)
    const createPreview = vi
      .fn()
      .mockResolvedValueOnce(readyPreview)
      .mockRejectedValueOnce({
        code: 'GARUPA_PREVIEW_RENDER_FAILED',
        message: '/Users/private/source.skel leaked',
        details: { path: '/Users/private/source.skel' },
      })
    const controller = new GarupaSourceController({
      createPreview,
      importLocal,
      materializePinned,
    })
    renderPanel(controller)

    await user.upload(
      screen.getByLabelText('Garupa Spine pack ZIP 선택'),
      new File(['fixture'], 'ready.zip', { type: 'application/zip' }),
    )
    await user.click(screen.getByRole('button', { name: '불러오기' }))
    await waitFor(() => expect(controller.getState().phase).toBe('ready'))

    await user.click(screen.getByRole('radio', { name: '고정 온라인 snapshot' }))
    expect(materializePinned).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '불러오기' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Garupa Spine 모델을 안전하게 미리보기 또는 sampling하지 못했습니다.',
    )
    expect(alert).not.toHaveTextContent('/Users/private')
    expect(alert).toHaveAttribute('data-code', 'GARUPA_PREVIEW_RENDER_FAILED')
    expect(alert).toHaveAttribute('data-generation', '2')
    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The Garupa Spine model could not be previewed or sampled safely.',
    )
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-code',
      'GARUPA_PREVIEW_RENDER_FAILED',
    )
    expect(screen.getByRole('alert')).toHaveAttribute('data-generation', '2')
    expect(controller.getActiveSource()).toBe(localSource)
    expect(readyPreview.dispose).not.toHaveBeenCalled()
    expect(materializePinned).toHaveBeenCalledOnce()
  })

  it('a new controller starts with memory-only idle state', () => {
    const createPreview = vi.fn(async () => preview('unused'))
    const first = new GarupaSourceController({ createPreview })
    first.selectPinned('00001')
    first.dispose()
    const refreshed = new GarupaSourceController({ createPreview })
    expect(refreshed.getState()).toMatchObject({
      active: null,
      diagnostic: null,
      phase: 'idle',
      selection: null,
    })
    expect(refreshed.getActiveSource()).toBeNull()
  })
})
