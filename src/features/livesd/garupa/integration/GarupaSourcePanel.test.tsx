import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider, LocaleSelector } from '../../../../i18n'
import { readCodexPetSettingsPresetCatalog } from '../../../codex-pet/settingsPresets'
import type { GarupaCanonicalSource } from '../importer'
import type { GarupaPinnedCharacterCatalog } from '../remote'
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

function characterCatalog(): GarupaPinnedCharacterCatalog {
  const kasumiNames = {
    en: 'Kasumi Toyama',
    ja: '戸山 香澄',
    ko: '토야마 카스미',
    zhCN: '户山 香澄',
  }
  return {
    entries: [
      {
        bandId: 1,
        bundleName: '00001',
        characterId: 1,
        characterKind: 'unique',
        names: kasumiNames,
        resolution: 'exact',
      },
      {
        bandId: 1,
        bundleName: '00001_2023',
        characterId: 1,
        characterKind: 'unique',
        names: kasumiNames,
        resolution: 'base',
      },
      {
        bandId: 2,
        bundleName: '00002',
        characterId: 2,
        characterKind: 'unique',
        names: {
          en: 'Ran Mitake',
          ja: '美竹 蘭',
          ko: '미타케 란',
          zhCN: '美竹 兰',
        },
        resolution: 'exact',
      },
      {
        bandId: null,
        bundleName: '01001',
        characterId: 1001,
        characterKind: 'mob',
        names: {
          en: 'Mob A',
          ja: 'モブA',
          ko: '모브A',
          zhCN: 'Mob A',
        },
        resolution: 'exact',
      },
      {
        bandId: null,
        bundleName: '01002',
        characterId: 1002,
        characterKind: 'mob',
        names: {
          en: 'Mob B',
          ja: 'モブB',
          ko: '모브B',
          zhCN: 'Mob B',
        },
        resolution: 'exact',
      },
      {
        bandId: null,
        bundleName: '01003',
        characterId: null,
        characterKind: 'mob',
        names: null,
        resolution: 'ambiguous',
      },
      {
        bandId: null,
        bundleName: '09999',
        characterId: null,
        characterKind: 'unmapped',
        names: null,
        resolution: 'unresolved',
      },
    ],
  }
}

function renderPanel(
  controller: GarupaSourceController,
  characterCatalogLoader?: () => Promise<GarupaPinnedCharacterCatalog>,
) {
  const canvas = document.createElement('canvas')
  const catalogProps = characterCatalogLoader
    ? { characterCatalogLoader }
    : {}
  return render(
    <I18nProvider initialLocale="ko" storage={null}>
      <LocaleSelector />
      <GarupaSourcePanel
        controller={controller}
        onLoad={() => void controller.load(canvas)}
        onPresetLoad={vi.fn()}
        onPresetSelectionChange={vi.fn()}
        presetCatalog={readCodexPetSettingsPresetCatalog(null)}
        selectedPresetName={null}
        {...catalogProps}
      />
    </I18nProvider>,
  )
}

async function loadCatalogAndSelectKasumi(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: '캐릭터 목록 불러오기' }),
  )
  const character = screen.getByRole('combobox', { name: '캐릭터' })
  await waitFor(() => expect(character).toBeEnabled())
  await user.click(character)
  await user.type(character, '카스미')
  await user.click(screen.getByRole('option', { name: '토야마 카스미' }))
  return screen.getByRole('combobox', { name: '모델' })
}

afterEach(() => {
  delete window.gtag
})

describe('Garupa source panel lifecycle', () => {
  it('uses the live pack by default and keeps local ZIP loading in advanced controls', async () => {
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

    expect(screen.getByTestId('garupa-resource-preset-selector')).toBeVisible()
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeDisabled()
    expect(screen.getByRole('button', {
      name: '캐릭터 목록 불러오기',
    })).toBeEnabled()
    expect(
      screen.getByRole('heading', { name: '캐릭터 선택' }),
    ).toBeVisible()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByText(/github\.com\/panxuc/u)).not.toBeInTheDocument()
    expect(screen.queryByText(/15b3e023/u)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '캐릭터' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: '모델' })).toBeDisabled()
    expect(importLocal).not.toHaveBeenCalled()
    expect(materializePinned).not.toHaveBeenCalled()
    expect(createPreview).not.toHaveBeenCalled()

    await user.click(screen.getByText('고급 기능 · 로컬 ZIP'))
    await user.upload(
      screen.getByLabelText('Garupa Spine pack ZIP 선택'),
      new File(['fixture'], 'character.zip', { type: 'application/zip' }),
    )
    expect(importLocal).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '로컬 ZIP 불러오기' }))

    await waitFor(() => expect(controller.getState().phase).toBe('ready'))
    expect(importLocal).toHaveBeenCalledOnce()
    expect(materializePinned).not.toHaveBeenCalled()
    expect(createPreview).toHaveBeenCalledOnce()
    expect(controller.getActiveSource()).toBe(localSource)
  })

  it('filters models by character and loads each model immediately on selection', async () => {
    const user = userEvent.setup()
    const googleTag = vi.fn()
    window.gtag = googleTag
    const firstPreview = preview('00001')
    const secondPreview = preview('00001_2023')
    const materializePinned = vi.fn(async (bundleName: string) =>
      source(bundleName),
    )
    const createPreview = vi
      .fn()
      .mockResolvedValueOnce(firstPreview)
      .mockResolvedValueOnce(secondPreview)
    const controller = new GarupaSourceController({
      createPreview,
      materializePinned,
    })
    const loadCatalog = vi.fn(async () => characterCatalog())
    renderPanel(controller, loadCatalog)

    const model = await loadCatalogAndSelectKasumi(user)
    expect(model).toBeEnabled()
    expect(screen.getByText('캐릭터 3명 · 모델 7개')).toBeVisible()
    expect(materializePinned).not.toHaveBeenCalled()

    await user.click(model)
    expect(screen.getByRole('option', { name: '00001' })).toBeVisible()
    expect(screen.getByRole('option', { name: '00001_2023' })).toBeVisible()
    expect(screen.queryByRole('option', { name: '00002' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '00001' }))

    await waitFor(() =>
      expect(controller.getActiveSource()?.metadata.sdAssetBundleName).toBe(
        '00001',
      ),
    )
    expect(materializePinned).toHaveBeenCalledTimes(1)
    expect(controller.getState().active?.defaultDisplayName).toBe(
      '00001 - 토야마 카스미',
    )
    expect(screen.queryByRole('button', { name: '불러오기' })).not.toBeInTheDocument()

    await user.click(model)
    await user.click(screen.getByRole('option', { name: '00001_2023' }))
    await waitFor(() =>
      expect(controller.getActiveSource()?.metadata.sdAssetBundleName).toBe(
        '00001_2023',
      ),
    )
    expect(materializePinned).toHaveBeenCalledTimes(2)
    expect(controller.getState().active?.defaultDisplayName).toBe(
      '00001_2023 - 토야마 카스미',
    )
    expect(firstPreview.dispose).toHaveBeenCalledOnce()
    expect(secondPreview.dispose).not.toHaveBeenCalled()
    expect(googleTag).toHaveBeenCalledWith(
      'event',
      'character_select',
      {
        character_id: '1',
        game_id: 'garupa',
        source_type: 'pinned',
      },
    )
    expect(googleTag).toHaveBeenCalledWith(
      'event',
      'model_select',
      {
        game_id: 'garupa',
        model_id: '00001_2023',
        source_type: 'pinned',
      },
    )
  })

  it('groups characters under official band sections and searches section aliases', async () => {
    const user = userEvent.setup()
    const materializePinned = vi.fn(async (bundleName: string) =>
      source(bundleName),
    )
    const controller = new GarupaSourceController({
      createPreview: vi.fn(async () => preview('unused')),
      materializePinned,
    })
    renderPanel(controller, vi.fn(async () => characterCatalog()))

    await user.click(
      screen.getByRole('button', { name: '캐릭터 목록 불러오기' }),
    )
    const character = screen.getByRole('combobox', { name: '캐릭터' })
    await waitFor(() => expect(character).toBeEnabled())
    await user.click(character)

    const listbox = screen.getByRole('listbox', { name: '캐릭터' })
    expect(
      within(listbox).getAllByRole('group').map(
        (group) => group.querySelector(
          '.searchable-combobox__group-heading',
        )?.textContent,
      ),
    ).toEqual(["Poppin'Party", 'Afterglow', '기타'])
    expect(
      within(listbox).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['토야마 카스미', '미타케 란', 'Mob', '기타 모델'])

    await user.type(character, 'popipa')
    expect(
      within(listbox).getAllByRole('group').map((group) => group.textContent),
    ).toEqual(["Poppin'Party토야마 카스미"])
    expect(within(listbox).getAllByRole('option')).toHaveLength(1)
    expect(materializePinned).not.toHaveBeenCalled()
  })

  it('merges Mob entries into one character while preserving bundle identities', async () => {
    const user = userEvent.setup()
    const materializePinned = vi.fn(async (bundleName: string) =>
      source(bundleName),
    )
    const controller = new GarupaSourceController({
      createPreview: vi.fn(async () => preview('mob')),
      materializePinned,
    })
    const loadCatalog = vi.fn(async () => characterCatalog())
    renderPanel(controller, loadCatalog)

    await user.click(
      screen.getByRole('button', { name: '캐릭터 목록 불러오기' }),
    )
    const character = screen.getByRole('combobox', { name: '캐릭터' })
    await waitFor(() => expect(character).toBeEnabled())
    await user.click(character)
    expect(screen.getAllByRole('option', { name: 'Mob' })).toHaveLength(1)
    expect(screen.getByRole('option', { name: '기타 모델' })).toBeVisible()
    await user.click(screen.getByRole('option', { name: 'Mob' }))

    const model = screen.getByRole('combobox', { name: '모델' })
    await user.click(model)
    expect(screen.getByRole('option', { name: '01001' })).toBeVisible()
    expect(screen.getByRole('option', { name: '01002' })).toBeVisible()
    expect(screen.getByRole('option', { name: '01003' })).toBeVisible()
    expect(screen.queryByRole('option', { name: '00001' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '09999' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '01002' }))

    await waitFor(() =>
      expect(controller.getActiveSource()?.metadata.sdAssetBundleName).toBe(
        '01002',
      ),
    )
    expect(materializePinned).toHaveBeenCalledWith(
      '01002',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(controller.getState().active?.defaultDisplayName).toBe(
      '01002 - 모브B',
    )

    await user.click(
      screen.getByRole('button', { name: '캐릭터 목록 불러오기' }),
    )
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(2))
    expect(character).toHaveValue('Mob')
    expect(model).toHaveValue('01002')

    await user.click(character)
    await user.click(screen.getByRole('option', { name: '기타 모델' }))
    await user.click(model)
    expect(screen.getByRole('option', { name: '09999' })).toBeVisible()
    expect(screen.queryByRole('option', { name: '01001' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '01002' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '01003' })).not.toBeInTheDocument()
  })

  it('preserves the previous ready model when an immediate replacement fails', async () => {
    const user = userEvent.setup()
    const readyPreview = preview('ready')
    const materializePinned = vi.fn(async (bundleName: string) =>
      source(bundleName),
    )
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
      materializePinned,
    })
    renderPanel(controller, vi.fn(async () => characterCatalog()))

    const model = await loadCatalogAndSelectKasumi(user)
    await user.click(model)
    await user.click(screen.getByRole('option', { name: '00001' }))
    await waitFor(() => expect(controller.getState().phase).toBe('ready'))

    await user.click(model)
    await user.click(screen.getByRole('option', { name: '00001_2023' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      '캐릭터 미리보기를 만들지 못했습니다.',
    )
    expect(alert).not.toHaveTextContent('/Users/private')
    expect(alert).toHaveAttribute('data-code', 'GARUPA_PREVIEW_RENDER_FAILED')
    expect(controller.getActiveSource()?.metadata.sdAssetBundleName).toBe('00001')
    expect(readyPreview.dispose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The character preview could not be created.',
    )
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
