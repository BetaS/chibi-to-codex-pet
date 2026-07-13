import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '../../../../i18n'
import { recommendCodexPetMappings } from '../../../codex-pet/animationMapping'
import { saveCodexPetSettingsPreset } from '../../../codex-pet/settingsPresets'
import type { GarupaCanonicalSource } from '../importer'
import type { GarupaPinnedCharacterCatalog } from '../remote'
import type { GarupaSpine40PreviewSession } from '../rendering'
import { GarupaSourceController } from './GarupaSourceController'
import { GarupaSourceIntegration } from './GarupaSourceIntegration'

function source(sdAssetBundleName = '00001'): GarupaCanonicalSource {
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
      sdAssetBundleName,
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

    const canvas = screen.getByLabelText('Garupa 캐릭터 미리보기')
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
    expect(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    })).not.toBeChecked()
    expect(activePreview.setMirrorX).toHaveBeenCalledWith(false)

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

  it('pinned model의 기본 Pet 이름을 모델 - 캐릭터 순서로 만들고 전체 반전은 끈다', async () => {
    const user = userEvent.setup()
    const catalog: GarupaPinnedCharacterCatalog = {
      entries: [{
        bundleName: '00001',
        characterId: 1,
        names: {
          en: 'Kasumi Toyama',
          ja: '戸山 香澄',
          ko: '토야마 카스미',
          zhCN: '户山 香澄',
        },
        resolution: 'exact',
      }],
    }
    const activePreview = preview()
    const controller = new GarupaSourceController({
      createPreview: vi.fn(async () => activePreview),
      materializePinned: vi.fn(async (bundleName) => source(bundleName)),
    })

    render(
      <I18nProvider initialLocale="ko" storage={null}>
        <GarupaSourceIntegration
          characterCatalogLoader={vi.fn(async () => catalog)}
          controllerFactory={() => controller}
        />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', {
      name: '캐릭터 목록 불러오기',
    }))
    const character = screen.getByRole('combobox', { name: '캐릭터' })
    await waitFor(() => expect(character).toBeEnabled())
    await user.click(character)
    await user.click(screen.getByRole('option', { name: '토야마 카스미' }))
    const model = screen.getByRole('combobox', { name: '모델' })
    await user.click(model)
    await user.click(screen.getByRole('option', { name: '00001' }))

    expect(await screen.findByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      '00001 - 토야마 카스미',
    )
    expect(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    })).not.toBeChecked()
    expect(activePreview.setMirrorX).toHaveBeenLastCalledWith(false)
  })

  it('saved pinned preset은 명시적 불러오기 전에는 요청하지 않고 bundle과 설정을 복원한다', async () => {
    const user = userEvent.setup()
    const animations = ['Idle', 'Run', 'Wave', 'Jump'] as const
    saveCodexPetSettingsPreset({
      description: 'Saved Garupa settings',
      displayName: '토야마 카스미',
      framingOffset: { x: 7, y: -3 },
      framingScale: 1.2,
      globalMirrorX: true,
      lookMovementScale: 1.25,
      mappings: recommendCodexPetMappings(animations),
      source: {
        provider: 'garupa-pinned',
        sdAssetBundleName: '00001_2023',
      },
    }, localStorage, 10, 'garupa')
    const activePreview = preview()
    const materializePinned = vi.fn(async (bundleName: string) =>
      source(bundleName),
    )
    const controller = new GarupaSourceController({
      createPreview: vi.fn(async () => activePreview),
      materializePinned,
    })

    render(
      <I18nProvider initialLocale="ko" storage={null}>
        <GarupaSourceIntegration controllerFactory={() => controller} />
      </I18nProvider>,
    )

    expect(screen.getByTestId('garupa-resource-preset-selector')).toHaveValue(
      '토야마 카스미',
    )
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeEnabled()
    expect(screen.getByRole('button', {
      name: '캐릭터 목록 불러오기',
    })).toBeDisabled()
    expect(materializePinned).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', {
      name: '프리셋 불러오기',
    }))
    await waitFor(() =>
      expect(controller.getState().active?.sdAssetBundleName).toBe(
        '00001_2023',
      ),
    )
    expect(materializePinned).toHaveBeenCalledTimes(1)
    expect(materializePinned).toHaveBeenCalledWith(
      '00001_2023',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    const displayName = await screen.findByRole('textbox', { name: 'Pet 이름' })
    expect(displayName).toHaveValue('토야마 카스미')
    expect(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    })).toBeChecked()

    await user.clear(displayName)
    await user.type(displayName, 'edited')
    await user.click(screen.getByRole('button', {
      name: '프리셋 불러오기',
    }))
    await waitFor(() => expect(displayName).toHaveValue('토야마 카스미'))
    expect(materializePinned).toHaveBeenCalledTimes(1)
  })

  it('Garupa preset 복원 중 새 세션을 선택하면 pending model을 취소한다', async () => {
    const user = userEvent.setup()
    saveCodexPetSettingsPreset({
      description: '',
      displayName: 'Pending Kasumi',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: false,
      lookMovementScale: 1,
      mappings: recommendCodexPetMappings(['Idle', 'Run']),
      source: {
        provider: 'garupa-pinned',
        sdAssetBundleName: '00001',
      },
    }, localStorage, 10, 'garupa')
    let resolveMaterialization:
      | ((value: GarupaCanonicalSource) => void)
      | undefined
    let requestSignal: AbortSignal | undefined
    const materializePinned = vi.fn((
      _bundleName: string,
      options: { signal: AbortSignal },
    ) => {
      requestSignal = options.signal
      return new Promise<GarupaCanonicalSource>((resolve) => {
        resolveMaterialization = resolve
      })
    })
    const createPreview = vi.fn(async () => preview())
    const controller = new GarupaSourceController({
      createPreview,
      materializePinned,
    })

    render(
      <I18nProvider initialLocale="ko" storage={null}>
        <GarupaSourceIntegration controllerFactory={() => controller} />
      </I18nProvider>,
    )
    await user.click(screen.getByRole('button', {
      name: '프리셋 불러오기',
    }))
    await waitFor(() => expect(materializePinned).toHaveBeenCalledOnce())

    await user.selectOptions(
      screen.getByTestId('garupa-resource-preset-selector'),
      '',
    )
    expect(requestSignal?.aborted).toBe(true)
    expect(controller.getState().phase).toBe('idle')

    await act(async () => {
      resolveMaterialization?.(source())
      await Promise.resolve()
    })
    expect(createPreview).not.toHaveBeenCalled()
    expect(controller.getActiveSource()).toBeNull()
  })
})
