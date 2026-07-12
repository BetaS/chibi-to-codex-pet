import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '../../../../i18n'
import type { GarupaCanonicalSource } from '../importer'
import type { GarupaSpine40PreviewSession } from '../rendering'
import { GarupaSourceController } from './GarupaSourceController'
import { GarupaSourceIntegration } from './GarupaSourceIntegration'

function source(): GarupaCanonicalSource {
  return {
    skeletonData: new ArrayBuffer(4),
    atlasBundle: {
      sourceName: 'band-00001',
      atlasPath: 'costume/band-00001.atlas',
      atlasText: 'band-00001.png\nsize: 1,1\n',
      atlasPages: new Map([['costume/band-00001.png', new Blob()]]),
    },
    metadata: {
      gameId: 'garupa',
      assetFamily: 'sdchara',
      sdAssetBundleName: '00001',
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

function preview(): GarupaSpine40PreviewSession {
  return {
    adapterIdentity: 'adapter:garupa-layout-test',
    animations: ['Idle', 'Run', 'Wave', 'Jump'],
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

describe('Garupa PRSK-aligned workspace', () => {
  it('loads into the shared preview layout and wires framing and state controls', async () => {
    const user = userEvent.setup()
    const activeSource = source()
    const activePreview = preview()
    const controller = new GarupaSourceController({
      importLocal: vi.fn(async () => activeSource),
      createPreview: vi.fn(async () => activePreview),
    })

    render(
      <I18nProvider initialLocale="ko" storage={null}>
        <GarupaSourceIntegration controllerFactory={() => controller} />
      </I18nProvider>,
    )

    const canvas = screen.getByLabelText('Garupa Spine WebGL 미리보기')
    expect(canvas.closest('.preview-panel')).not.toBeNull()
    expect(canvas.closest('.control-panel')).toBeNull()
    expect(screen.getByLabelText('Pet 크기 슬라이더')).toBeDisabled()

    await user.click(screen.getByText('고급 기능 · 로컬 ZIP'))
    await user.upload(
      screen.getByLabelText('Garupa Spine pack ZIP 선택'),
      new File(['fixture'], 'band.zip', { type: 'application/zip' }),
    )
    await user.click(screen.getByRole('button', { name: '로컬 ZIP 불러오기' }))

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 2, name: 'band-00001' }),
      ).toBeVisible(),
    )
    expect(screen.getByLabelText('Pet 크기 슬라이더')).toBeEnabled()
    expect(screen.getByRole('combobox', { name: '애니메이션' })).toBeEnabled()
    expect(screen.getByText('Spine 4.0.64')).toBeVisible()

    fireEvent.change(screen.getByLabelText('Pet 크기 슬라이더'), {
      target: { value: '125' },
    })
    expect(activePreview.setFramingScale).toHaveBeenLastCalledWith(1.25)

    const idleShortcut = screen.getByRole('button', {
      name: '대기 미리보기: 차분한 호흡과 눈 깜박임',
    })
    await waitFor(() => expect(idleShortcut).toBeEnabled())
    await user.click(idleShortcut)
    expect(activePreview.play).toHaveBeenCalled()
    expect(idleShortcut).toHaveAttribute('aria-pressed', 'true')
  })
})
