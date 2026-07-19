import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { GITHUB_REPOSITORY_URL } from './features/github'
import {
  getGameSourceGridColumnCount,
  MAX_GAME_SOURCE_GRID_COLUMNS,
  NEW_GAME_SUPPORT_ISSUE_URL,
} from './features/gameSourceNavigation'
import type { CodexPetAnimationMappings } from './features/codex-pet/animationMapping'
import { CODEX_PET_STATES } from './features/codex-pet/contract'
import {
  readCodexPetSettingsPresetCatalog,
  saveCodexPetSettingsPreset,
} from './features/codex-pet/settingsPresets'
import {
  LiveSDPreviewError,
  liveSD36Adapter,
  type LiveSDPreviewSession,
} from './features/livesd/adapter'
import {
  PrskArchiveImportError,
  prskCharacterArchiveImporter,
  PJSEK_AI_ASSET_BASE_URL,
  PRSK_CHIBI_VIEWER_CATALOG_URL,
  PrskRemoteError,
  prskRemoteCatalogSource,
  prskRemoteResourceSource,
  type PrskRemoteCatalog,
  type PrskRemoteModelInput,
  toPrskPreviewUiNotice,
} from './features/livesd/prsk'
import type { LiveSDAtlasBundle } from './features/livesd/model'
import {
  SPINE_36_RUNTIME_LICENSE_URL,
  SPINE_36_RUNTIME_NOTICES_URL,
} from './features/livesd/runtime/runtimeLoader'
import { toPreviewUiNotice } from './features/livesd/ui/previewError'
import { createZipFile, VALID_ATLAS } from './test/zipFixtures'

interface MockSessionFixture {
  readonly dispose: ReturnType<typeof vi.fn>
  readonly emitError: (error: LiveSDPreviewError) => void
  readonly session: LiveSDPreviewSession
  readonly setAnimationMappings: ReturnType<typeof vi.fn>
  readonly setFramingOffset: ReturnType<typeof vi.fn>
  readonly setFramingScale: ReturnType<typeof vi.fn>
  readonly setLookTarget: ReturnType<typeof vi.fn>
  readonly setMirrorX: ReturnType<typeof vi.fn>
  readonly unsubscribe: ReturnType<typeof vi.fn>
}

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly reject: (reason?: unknown) => void
  readonly resolve: (value: T) => void
}

const REMOTE_CHARACTERS = [
  { id: 'sd_21miku_normal', label: 'Normal' },
  { id: 'sd_21miku_street', label: 'Street' },
  { id: 'sd_mob001', label: 'Mob Character' },
] as const

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

async function chooseSearchableOption(
  user: ReturnType<typeof userEvent.setup>,
  accessibleName: string,
  optionName: string,
) {
  const combobox = screen.getByRole('combobox', { name: accessibleName })
  await user.click(combobox)
  await user.clear(combobox)
  await user.type(combobox, optionName)
  await user.click(screen.getByRole('option', { name: optionName }))
}

function createBundle(sourceName: string): LiveSDAtlasBundle {
  return {
    sourceName,
    atlasPath: 'sekai_atlas.atlas',
    atlasText: VALID_ATLAS,
    atlasPages: new Map([
      ['page.png', new Blob(['png'], { type: 'image/png' })],
    ]),
  }
}

function createSession(
  version = '3.3',
  compatibility: LiveSDPreviewSession['compatibility'] = 'best_effort',
  animations: readonly string[] = ['idle', 'walk'],
  currentAnimation = animations[0] ?? '',
): MockSessionFixture {
  const listeners = new Set<(error: LiveSDPreviewError) => void>()
  const dispose = vi.fn()
  const setAnimationMappings = vi.fn()
  const setFramingOffset = vi.fn()
  const setFramingScale = vi.fn()
  const setLookTarget = vi.fn()
  const setMirrorX = vi.fn()
  const unsubscribe = vi.fn(() => listeners.clear())
  const session: LiveSDPreviewSession = {
    animations,
    compatibility,
    currentAnimation,
    framingOffset: { x: 0, y: 0 },
    framingScale: 1,
    version,
    dispose,
    onError: vi.fn((listener) => {
      listeners.add(listener)
      return unsubscribe
    }),
    play: vi.fn(),
    resize: vi.fn(),
    setAnimationMappings,
    setFramingOffset,
    setFramingScale,
    setLookTarget,
    setMirrorX,
  }

  return {
    dispose,
    emitError: (error) => {
      for (const listener of [...listeners]) {
        listener(error)
      }
    },
    session,
    setAnimationMappings,
    setFramingOffset,
    setFramingScale,
    setLookTarget,
    setMirrorX,
    unsubscribe,
  }
}

function createRemoteCatalog(
  characters: PrskRemoteCatalog['characters'] = REMOTE_CHARACTERS,
  assetBaseUrl = 'https://assets.example.test/area_sd',
): PrskRemoteCatalog {
  return {
    providerLabel: 'Test provider',
    assetBaseUrl,
    requestOrigins: [new URL(assetBaseUrl).origin],
    characters,
  }
}

function createRemoteModel(characterId: string): PrskRemoteModelInput {
  return {
    atlasBundle: createBundle(characterId),
    skeletonData: new Uint8Array([1, 2, 3]).buffer,
    sourceOrigin: 'https://assets.example.test',
  }
}

function comboboxRoot(combobox: HTMLElement): HTMLElement {
  const root = combobox.closest<HTMLElement>('.searchable-combobox')
  if (!root) {
    throw new Error('Expected searchable combobox root')
  }
  return root
}

function searchableOptions(): HTMLElement[] {
  return screen
    .getAllByRole('option')
    .filter((option) => option.tagName === 'LI')
}

type AppUser = ReturnType<typeof userEvent.setup>

async function loadCustomRemoteCatalog(
  user: AppUser,
  assetBaseUrl = 'https://assets.example.test/area_sd',
): Promise<HTMLInputElement> {
  await user.click(screen.getByRole('radio', { name: '다른 서버' }))
  const urlInput = screen.getByRole('textbox', {
    name: '캐릭터 서버 URL',
  })
  await user.type(urlInput, assetBaseUrl)
  await user.click(screen.getByRole('button', { name: '불러오기' }))

  const characterCombobox = screen.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  await waitFor(() => expect(characterCombobox).toBeEnabled())
  return characterCombobox as HTMLInputElement
}

function remoteModelCombobox(): HTMLInputElement {
  return screen.getByRole('combobox', {
    name: '모델 검색',
  }) as HTMLInputElement
}

async function selectRemoteCharacter(
  user: AppUser,
  characterName = '하츠네 미쿠',
): Promise<void> {
  await chooseSearchableOption(
    user,
    '캐릭터 검색',
    characterName,
  )
}

async function selectRemoteModel(
  user: AppUser,
  modelName: string,
): Promise<void> {
  await chooseSearchableOption(user, '모델 검색', modelName)
}

async function loadRemoteCharacterModel(
  user: AppUser,
  modelName = 'Normal',
  characterName = '하츠네 미쿠',
): Promise<void> {
  await selectRemoteCharacter(user, characterName)
  await selectRemoteModel(user, modelName)
}

function fileInputs(container: HTMLElement): readonly HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('input[type="file"]')]
}

async function uploadInputs(
  container: HTMLElement,
  fileName = 'character.zip',
): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole('radio', { name: '파일에서 불러오기' }))
  const [skeletonInput, archiveInput] = fileInputs(container)
  if (!skeletonInput || !archiveInput) {
    throw new Error('Expected skeleton and archive inputs')
  }

  await user.upload(skeletonInput, new File(['skel'], 'shared.skel'))
  await user.upload(
    archiveInput,
    new File(['zip'], fileName, { type: 'application/zip' }),
  )
  await user.click(
    screen.getByRole('button', { name: '캐릭터 미리보기' }),
  )
}

function mockPreview(
  bundles: readonly LiveSDAtlasBundle[],
  sessions: readonly LiveSDPreviewSession[],
) {
  const importSpy = vi.spyOn(prskCharacterArchiveImporter, 'import')
  for (const bundle of bundles) {
    importSpy.mockResolvedValueOnce(bundle)
  }

  vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
    hash: 'hash',
    version: '3.3',
    compatibility: 'best_effort',
  })
  const createSpy = vi.spyOn(liveSD36Adapter, 'createPreview')
  for (const session of sessions) {
    createSpy.mockResolvedValueOnce(session)
  }
  return { createSpy, importSpy }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete window.gtag
})

describe('App', () => {
  it('provider를 최대 네 열로 배치하고 하단에서 새 게임 지원 issue를 연다', () => {
    expect(getGameSourceGridColumnCount(0)).toBe(1)
    expect(getGameSourceGridColumnCount(3)).toBe(3)
    expect(getGameSourceGridColumnCount(4)).toBe(4)
    expect(getGameSourceGridColumnCount(5)).toBe(
      MAX_GAME_SOURCE_GRID_COLUMNS,
    )

    render(<App />)

    const navigation = screen.getByRole('navigation', { name: '게임 선택' })
    const tablist = within(navigation).getByRole('tablist', { name: '게임' })
    const supportRequest = within(navigation).getByRole('link', {
      name: '새 게임 지원요청 (새 탭에서 열림)',
    })

    expect(tablist.style.getPropertyValue('--game-source-columns')).toBe('3')
    expect(within(tablist).getAllByRole('tab')).toHaveLength(3)
    expect(within(tablist).queryByRole('link')).not.toBeInTheDocument()
    expect(navigation.lastElementChild).toBe(supportRequest)
    expect(supportRequest).toHaveTextContent('새 게임 지원요청')
    expect(supportRequest).toHaveAttribute('href', NEW_GAME_SUPPORT_ISSUE_URL)
    expect(supportRequest).toHaveAttribute('target', '_blank')
    expect(supportRequest).toHaveAttribute('rel', 'noreferrer')

    supportRequest.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    })
    fireEvent.click(supportRequest)

    expect(screen.getByRole('tab', { name: '프로세카' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('상단 GitHub Star 링크를 network 요청 없이 항상 표시한다', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('unexpected mount-time network request'),
    )

    render(<App />)

    const header = screen.getByRole('banner')
    const starLink = within(header).getByRole('link', {
      name: 'GitHub에서 Star (새 탭에서 열림)',
    })
    expect(starLink).toHaveTextContent('GitHub에서 Star')
    expect(starLink).toHaveAttribute('href', GITHUB_REPOSITORY_URL)
    expect(starLink).toHaveAttribute('target', '_blank')
    expect(starLink).toHaveAttribute('rel', 'noreferrer')
    expect(fetchSpy).not.toHaveBeenCalled()

    starLink.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    })
    fireEvent.click(starLink)
    expect(screen.getByRole('tab', { name: '프로세카' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('레뷰 스타라이트 탭에서 공통 preview와 Codex Pet builder를 활성화한다', async () => {
    const user = userEvent.setup()
    render(<App />)

    const prskTab = screen.getByRole('tab', { name: '프로세카' })
    const strrTab = screen.getByRole('tab', { name: '레뷰 스타라이트' })
    expect(strrTab).toBeEnabled()

    await user.click(strrTab)

    expect(prskTab).toHaveAttribute('aria-selected', 'false')
    expect(strrTab).toHaveAttribute('aria-selected', 'true')
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: '캐릭터 선택',
      }),
    ).toBeVisible()
    expect(screen.getByRole('button', {
      name: '캐릭터 목록 불러오기',
    })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: '캐릭터 검색' })).toBeDisabled()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Codex Pet 만들기' }),
    ).toBeVisible()
    expect(screen.getByRole('slider', {
      name: 'Pet 크기 슬라이더',
    })).toBeDisabled()
  })

  it('BanG Dream 탭을 선택하면 Garupa source와 builder를 활성화한다', async () => {
    const user = userEvent.setup()
    const googleTag = vi.fn()
    window.gtag = googleTag
    render(<App />)

    const prskTab = screen.getByRole('tab', { name: '프로세카' })
    const garupaTab = screen.getByRole('tab', { name: 'BanG Dream!' })
    expect(garupaTab).toBeEnabled()

    await user.click(garupaTab)

    expect(googleTag).toHaveBeenCalledWith(
      'event',
      'game_select',
      { game_id: 'garupa' },
    )

    expect(prskTab).toHaveAttribute('aria-selected', 'false')
    expect(garupaTab).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '캐릭터 선택',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: '캐릭터 목록 불러오기' }),
    ).toBeEnabled()
    expect(screen.getByRole('combobox', { name: '캐릭터' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: '모델' })).toBeDisabled()
    expect(screen.getByText('고급 기능 · 로컬 ZIP')).toBeVisible()
    expect(screen.queryByRole('radiogroup', { name: '소스' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: '캐릭터 미리보기' }),
    ).toBeVisible()
    expect(screen.getByText('아직 표시할 캐릭터가 없습니다.')).toBeVisible()
    expect(screen.getByLabelText('Pet 크기 슬라이더')).toBeDisabled()
    expect(screen.getByLabelText('Garupa 캐릭터 미리보기')).toHaveAttribute(
      'width',
      '192',
    )
    expect(
      screen.getByLabelText('Garupa 캐릭터 미리보기').closest(
        '.preview-panel',
      ),
    ).not.toBeNull()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Codex Pet 만들기' }),
    ).toBeVisible()
    expect(
      screen.getByText('먼저 캐릭터를 불러와주세요.'),
    ).toBeVisible()
  })

  it('StrictMode에서도 Garupa controller를 조기 dispose하지 않는다', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await user.click(screen.getByRole('tab', { name: 'BanG Dream!' }))
    expect(
      screen.getByRole('button', { name: '캐릭터 목록 불러오기' }),
    ).toBeEnabled()
    expect(screen.getByRole('combobox', { name: '캐릭터' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: '모델' })).toBeDisabled()
    expect(
      screen.getByText('캐릭터 목록을 불러온 뒤 캐릭터와 모델을 선택해주세요.'),
    ).toBeVisible()
  })

  it('StrictMode mount는 resource나 preview를 자동으로 불러오지 않는다', () => {
    const catalogSpy = vi.spyOn(prskRemoteCatalogSource, 'load')
    const modelSpy = vi.spyOn(prskRemoteResourceSource, 'load')
    const inspectSpy = vi.spyOn(liveSD36Adapter, 'inspectSkeleton')
    const createSpy = vi.spyOn(liveSD36Adapter, 'createPreview')

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    expect(catalogSpy).not.toHaveBeenCalled()
    expect(modelSpy).not.toHaveBeenCalled()
    expect(inspectSpy).not.toHaveBeenCalled()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('각 런타임의 preset catalog와 active 선택을 서로 격리한다', async () => {
    const user = userEvent.setup()
    const mappings = Object.fromEntries(
      CODEX_PET_STATES.map(({ id }) => [
        id,
        { animationName: 'idle', mirrorX: false },
      ]),
    ) as unknown as CodexPetAnimationMappings
    saveCodexPetSettingsPreset({
      description: 'PRSK settings',
      displayName: 'PRSK Preset',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: false,
      lookMovementScale: 1,
      mappings,
    }, localStorage, 1)
    saveCodexPetSettingsPreset({
      description: 'STRR settings',
      displayName: 'STRR Preset',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: true,
      lookMovementScale: 1,
      mappings,
    }, localStorage, 2, 'strr')
    saveCodexPetSettingsPreset({
      description: 'Garupa settings',
      displayName: 'Garupa Preset',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: false,
      lookMovementScale: 1,
      mappings,
    }, localStorage, 3, 'garupa')

    render(<App />)

    expect(screen.getByTestId('resource-preset-selector')).toHaveValue(
      'PRSK Preset',
    )
    expect(screen.queryByRole('option', { name: 'STRR Preset' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeEnabled()
    expect(screen.getByRole('button', { name: '새로 만들기' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '불러오기' }))
      .not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '레뷰 스타라이트' }))
    expect(screen.getByTestId('strr-resource-preset-selector')).toHaveValue(
      'STRR Preset',
    )
    expect(screen.queryByRole('option', { name: 'PRSK Preset' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeEnabled()
    expect(screen.getByRole('button', { name: '새로 만들기' })).toBeEnabled()
    expect(screen.queryByRole('button', {
      name: '캐릭터 목록 불러오기',
    })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'BanG Dream!' }))
    expect(screen.getByTestId('garupa-resource-preset-selector')).toHaveValue(
      'Garupa Preset',
    )
    expect(screen.queryByRole('option', { name: 'STRR Preset' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeEnabled()
    expect(screen.getByRole('button', { name: '새로 만들기' })).toBeEnabled()
    expect(screen.queryByRole('button', {
      name: '캐릭터 목록 불러오기',
    })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '새로 만들기' }))
    expect(screen.getByTestId('garupa-resource-preset-selector')).toHaveValue('')
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '새로 만들기' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: '캐릭터 목록 불러오기',
    })).toBeEnabled()

    expect(
      readCodexPetSettingsPresetCatalog(localStorage, 'garupa').activePresetName,
    ).toBeNull()
    expect(
      readCodexPetSettingsPresetCatalog(localStorage, 'prsk').activePresetName,
    ).toBe('PRSK Preset')
    expect(
      readCodexPetSettingsPresetCatalog(localStorage, 'strr').activePresetName,
    ).toBe('STRR Preset')

    await user.click(screen.getByRole('tab', { name: '프로세카' }))
    expect(screen.getByTestId('resource-preset-selector')).toHaveValue(
      'PRSK Preset',
    )
  })

  it('리소스 선택 전에 명시적으로 불러온 preset을 이후 source 전체 설정에 적용한다', async () => {
    const user = userEvent.setup()
    const mappings = Object.fromEntries(
      CODEX_PET_STATES.map(({ id }) => [
        id,
        { animationName: 'walk', mirrorX: id === 'running-right' },
      ]),
    ) as unknown as CodexPetAnimationMappings
    saveCodexPetSettingsPreset({
      description: 'Load this before the source',
      displayName: 'Miku First',
      framingOffset: { x: 7, y: 9 },
      framingScale: 1.24,
      globalMirrorX: true,
      lookMovementScale: 1.3,
      mappings,
    }, localStorage, 1)
    saveCodexPetSettingsPreset({
      description: 'Initially selected preset',
      displayName: 'Airi First',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: false,
      lookMovementScale: 1,
      mappings,
    }, localStorage, 2)
    const fixture = createSession(
      '3.6.53',
      'verified',
      ['idle', 'walk'],
      'idle',
    )
    const { createSpy } = mockPreview(
      [createBundle('preset-first-source')],
      [fixture.session],
    )
    const { container } = render(<App />)
    const presetSelector = screen.getByRole('combobox', {
      name: '저장 프리셋',
    })
    const sourceSelector = screen.getByRole('radio', {
      name: '기본 캐릭터',
    })

    expect(presetSelector).toHaveValue('Airi First')
    expect(
      presetSelector.compareDocumentPosition(sourceSelector) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await user.selectOptions(presetSelector, 'Miku First')
    expect(
      readCodexPetSettingsPresetCatalog(localStorage).activePresetName,
    ).toBe('Airi First')
    expect(createSpy).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', {
      name: '프리셋 불러오기',
    }))
    expect(
      readCodexPetSettingsPresetCatalog(localStorage).activePresetName,
    ).toBe('Miku First')

    await uploadInputs(container, 'preset-first-source.zip')
    await screen.findByRole('heading', { name: 'preset-first-source' })
    await waitFor(() =>
      expect(fixture.setAnimationMappings).toHaveBeenCalled(),
    )

    expect(presetSelector).toHaveValue('Miku First')
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      'Miku First',
    )
    expect(screen.getByRole('textbox', { name: 'Pet 설명' })).toHaveValue(
      'Load this before the source',
    )
    expect(screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    })).toHaveValue('130')
    expect(fixture.setFramingScale).toHaveBeenLastCalledWith(1.24)
    expect(fixture.setFramingOffset).toHaveBeenLastCalledWith({ x: 7, y: 9 })
    expect(fixture.setAnimationMappings.mock.calls.at(-1)?.[0]).toMatchObject({
      idle: { animationName: 'walk', mirrorX: false },
      'running-right': { animationName: 'walk', mirrorX: true },
    })
    expect(fixture.setMirrorX).toHaveBeenLastCalledWith(true)
  })

  it('원격 source preset은 명시적 불러오기 뒤에만 캐릭터를 복원한다', async () => {
    const user = userEvent.setup()
    const mappings = Object.fromEntries(
      CODEX_PET_STATES.map(({ id }) => [
        id,
        { animationName: 'walk', mirrorX: id === 'running-right' },
      ]),
    ) as unknown as CodexPetAnimationMappings
    saveCodexPetSettingsPreset({
      description: 'Miku remote preset',
      displayName: 'Miku Remote',
      framingOffset: { x: 6, y: -4 },
      framingScale: 1.22,
      globalMirrorX: true,
      lookMovementScale: 1.35,
      mappings,
      source: {
        provider: 'prsk-chibi-viewer',
        characterId: 'sd_21miku_normal',
      },
    }, localStorage, 1)
    saveCodexPetSettingsPreset({
      description: 'Street remote preset',
      displayName: 'Street Remote',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: false,
      lookMovementScale: 1,
      mappings,
      source: {
        provider: 'prsk-chibi-viewer',
        characterId: 'sd_21miku_street',
      },
    }, localStorage, 2)
    const catalogDeferred = createDeferred<PrskRemoteCatalog>()
    const catalog = createRemoteCatalog()
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockReturnValueOnce(catalogDeferred.promise)
      .mockResolvedValueOnce(catalog)
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockImplementation(async ({ characterId }) =>
        createRemoteModel(characterId),
      )
    const streetSession = createSession(
      '3.6.53',
      'verified',
      ['idle', 'walk'],
      'idle',
    )
    const mikuSession = createSession(
      '3.6.53',
      'verified',
      ['idle', 'walk'],
      'idle',
    )
    mockPreview([], [streetSession.session, mikuSession.session])

    render(<App />)

    expect(screen.getByTestId('livesd-preview-border-box')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByText('아직 표시할 캐릭터가 없습니다.')).toBeVisible()
    expect(catalogSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '불러오기' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '새로 만들기' })).toBeEnabled()
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeEnabled()
    await user.click(screen.getByRole('button', {
      name: '프리셋 불러오기',
    }))
    await waitFor(() => expect(catalogSpy).toHaveBeenCalledOnce())
    catalogDeferred.resolve(catalog)
    await screen.findByRole('heading', { name: 'sd_21miku_street' })
    expect(screen.getByTestId('livesd-preview-border-box')).toBeVisible()
    expect(catalogSpy).toHaveBeenCalledTimes(1)
    expect(modelSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      characterId: 'sd_21miku_street',
    }))

    await user.selectOptions(
      screen.getByRole('combobox', { name: '저장 프리셋' }),
      'Miku Remote',
    )
    expect(catalogSpy).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', {
      name: '프리셋 불러오기',
    }))

    await screen.findByRole('heading', { name: 'sd_21miku_normal' })
    expect(catalogSpy).toHaveBeenCalledTimes(2)
    expect(modelSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      characterId: 'sd_21miku_normal',
    }))
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      'Miku Remote',
    )
    expect(screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    })).toHaveValue('135')
    expect(mikuSession.setFramingScale).toHaveBeenLastCalledWith(1.22)
    expect(mikuSession.setFramingOffset).toHaveBeenLastCalledWith({
      x: 6,
      y: -4,
    })
    expect(mikuSession.setMirrorX).toHaveBeenLastCalledWith(true)
  })

  it('원격 preset 불러오기 중 새로 만들기를 누르면 이전 요청을 취소한다', async () => {
    const user = userEvent.setup()
    const catalogDeferred = createDeferred<PrskRemoteCatalog>()
    const mappings = Object.fromEntries(
      CODEX_PET_STATES.map(({ id }) => [
        id,
        { animationName: 'walk', mirrorX: id === 'running-right' },
      ]),
    ) as unknown as CodexPetAnimationMappings
    saveCodexPetSettingsPreset({
      description: '',
      displayName: 'Pending Remote',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: false,
      lookMovementScale: 1,
      mappings,
      source: {
        provider: 'prsk-chibi-viewer',
        characterId: 'sd_21miku_normal',
      },
    }, localStorage, 1)
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockReturnValue(catalogDeferred.promise)
    const modelSpy = vi.spyOn(prskRemoteResourceSource, 'load')
    const createSpy = vi.spyOn(liveSD36Adapter, 'createPreview')

    render(<App />)
    expect(catalogSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '불러오기' }))
      .not.toBeInTheDocument()
    await user.click(screen.getByRole('button', {
      name: '프리셋 불러오기',
    }))
    await waitFor(() => expect(catalogSpy).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: '새로 만들기' }))
    catalogDeferred.resolve(createRemoteCatalog())

    await waitFor(() =>
      expect(
        readCodexPetSettingsPresetCatalog(localStorage).activePresetName,
      ).toBeNull(),
    )
    expect(modelSpy).not.toHaveBeenCalled()
    expect(createSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('livesd-preview-border-box')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '새로 만들기' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '불러오기' })).toBeEnabled()
  })

  it('기본 제공 resource는 단일 불러오기 action으로 canonical catalog를 요청한다', async () => {
    const user = userEvent.setup()
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockResolvedValue(createRemoteCatalog())
    render(<App />)

    await user.click(screen.getByRole('button', { name: '불러오기' }))

    await waitFor(() => expect(catalogSpy).toHaveBeenCalledOnce())
    expect(catalogSpy.mock.calls[0]?.[0].provider).toMatchObject({
      kind: 'prsk-chibi-viewer',
      assetBaseUrl: PJSEK_AI_ASSET_BASE_URL,
      catalogUrl: PRSK_CHIBI_VIEWER_CATALOG_URL,
    })
    expect(
      screen.queryByRole('button', { name: 'prsk-chibi-viewer 사용' }),
    ).not.toBeInTheDocument()
  })

  it('제품 heading, 게임 탭과 기본 제공 resource의 idle 상태를 표시한다', () => {
    const { container } = render(<App />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'LiveSD Pet Builder',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('캐릭터 목록을 보려면 불러오기를 눌러주세요.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: '기본 캐릭터' }),
    ).toBeChecked()
    expect(screen.getByRole('tab', { name: '프로세카' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.getByRole('tab', { name: '레뷰 스타라이트' }),
    ).toBeEnabled()
    expect(screen.getByRole('tab', { name: 'BanG Dream!' })).toBeEnabled()
    expect(
      screen.getByText('기본 캐릭터', {
        selector: '.provided-resource-card strong',
      }),
    ).toBeVisible()
    expect(screen.getByTestId('livesd-preview-border-box')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(screen.getByText('아직 표시할 캐릭터가 없습니다.')).toBeVisible()
    expect(
      screen.getByRole('slider', { name: 'Pet 크기 슬라이더' }),
    ).toHaveValue('100')
    expect(
      screen.getByRole('slider', { name: 'Pet 크기 슬라이더' }),
    ).toBeDisabled()
    expect(screen.getByText('100%', { selector: 'output' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: '위치와 크기 초기화' }),
    ).toBeDisabled()
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
    expect(screen.queryByText(/best_effort|experimental|verified/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Spine runtime license' }),
    ).toHaveAttribute('href', SPINE_36_RUNTIME_LICENSE_URL)
    expect(
      screen.getByRole('link', { name: 'Third-party notices' }),
    ).toHaveAttribute(
      'href',
      SPINE_36_RUNTIME_NOTICES_URL,
    )
  })

  it('production upload는 공통 스켈레톤과 ZIP이 모두 준비될 때만 실행한다', async () => {
    const user = userEvent.setup()
    const archive = await createZipFile([
      { name: 'sekai_atlas.atlas', content: VALID_ATLAS },
      { name: 'page.png', content: 'png' },
    ])
    const { container } = render(<App />)
    await user.click(screen.getByRole('radio', { name: '파일에서 불러오기' }))
    const archiveInput = fileInputs(container)[1]
    if (!archiveInput) throw new Error('Expected archive input')

    await user.upload(archiveInput, archive)
    expect(
      screen.getByRole('button', { name: '캐릭터 미리보기' }),
    ).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('잘못된 공통 스켈레톤 확장자를 stable code와 한국어 message로 표시한다', async () => {
    const user = userEvent.setup()
    const archive = await createZipFile([
      { name: 'sekai_atlas.atlas', content: VALID_ATLAS },
      { name: 'page.png', content: 'png' },
    ])
    const { container } = render(<App />)
    await user.click(screen.getByRole('radio', { name: '파일에서 불러오기' }))
    const [skeletonInput, archiveInput] = fileInputs(container)
    if (!skeletonInput || !archiveInput) throw new Error('Expected file inputs')

    await user.upload(
      skeletonInput,
      new File(['json'], 'shared.json', {
        type: 'application/octet-stream',
      }),
    )
    await user.upload(archiveInput, archive)
    await user.click(
      screen.getByRole('button', { name: '캐릭터 미리보기' }),
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('SHARED_SKELETON_INVALID_TYPE')
    expect(alert).toHaveTextContent('유효한 공통 `.skel` 파일을 선택하고 다시 시도하세요.')
  })

  it('알 수 없는 예외를 raw 내용 없이 PREVIEW_UNKNOWN_ERROR로 정규화한다', () => {
    const notice = toPreviewUiNotice(
      new Error('secret runtime details and stack'),
    )

    expect(notice).toEqual({
      code: 'PREVIEW_UNKNOWN_ERROR',
      message: '미리보기를 준비하는 중 알 수 없는 오류가 발생했습니다.',
    })
    expect(notice.message).not.toContain('secret runtime details')
  })

  it('알려진 오류의 stable code, 한국어 message와 관련 path를 보존한다', () => {
    const notice = toPreviewUiNotice(
      new PrskArchiveImportError(
        'ATLAS_PAGE_MISSING',
        'atlas가 참조하는 PNG가 ZIP에 없습니다: nested/page.png',
        { path: 'nested/page.png' },
      ),
      toPrskPreviewUiNotice,
    )

    expect(notice).toEqual({
      code: 'ATLAS_PAGE_MISSING',
      details: { path: 'nested/page.png' },
      message: 'atlas가 참조하는 PNG가 ZIP에 없습니다: nested/page.png',
    })
  })

  it('generic sourceName을 표시하고 compatibility metadata는 UI에 표시하지 않는다', async () => {
    const fixture = createSession('3.3', 'best_effort')
    mockPreview([createBundle('memory-source')], [fixture.session])
    const { container } = render(<App />)

    await uploadInputs(container)

    expect(
      await screen.findByRole('heading', { name: 'memory-source' }),
    ).toBeVisible()
    expect(
      screen.getByRole('checkbox', { name: '전체 캐릭터 수평 반전' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: '오른쪽 이동 수평 반전' }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: '왼쪽 이동 수평 반전' }),
    ).not.toBeChecked()
    expect(screen.getByText('LiveSD 3.3')).toBeVisible()
    expect(screen.queryByText('best_effort')).not.toBeInTheDocument()
  })

  it('ready preview의 150% 크기와 X/Y 위치를 즉시 반영하고 reset을 동기화한다', async () => {
    const fixture = createSession('3.6.53', 'verified')
    const { createSpy } = mockPreview(
      [createBundle('scale-source')],
      [fixture.session],
    )
    const { container } = render(<App />)
    await uploadInputs(container)
    await screen.findByRole('heading', { name: 'scale-source' })

    const slider = screen.getByRole('slider', {
      name: 'Pet 크기 슬라이더',
    })
    const reset = screen.getByRole('button', {
      name: '위치와 크기 초기화',
    })
    const offsetX = screen.getByRole('slider', { name: '가로 위치' })
    const offsetY = screen.getByRole('slider', { name: '세로 위치' })
    expect(slider).toBeEnabled()
    expect(slider).toHaveAttribute('min', '80')
    expect(slider).toHaveAttribute('max', '150')
    expect(slider).toHaveAttribute('step', '1')
    expect(slider).toHaveAttribute('aria-valuetext', '100%')
    expect(fixture.setFramingScale).toHaveBeenLastCalledWith(1)
    expect(fixture.setFramingOffset).toHaveBeenLastCalledWith({ x: 0, y: 0 })

    fireEvent.change(slider, { target: { value: '150' } })
    fireEvent.change(offsetX, { target: { value: '12' } })
    fireEvent.change(offsetY, { target: { value: '8' } })

    expect(fixture.setFramingScale).toHaveBeenLastCalledWith(1.5)
    expect(fixture.setFramingOffset).toHaveBeenLastCalledWith({ x: 12, y: 8 })
    expect(slider).toHaveValue('150')
    expect(slider).toHaveAttribute('aria-valuetext', '150%')
    expect(offsetX).toHaveValue('12')
    expect(offsetY).toHaveValue('8')
    expect(
      screen.getByText('150%', {
        selector: 'output[for="pet-framing-scale"]',
      }),
    ).toBeVisible()
    expect(reset).toBeEnabled()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(fixture.session.play).not.toHaveBeenCalled()

    await userEvent.setup().click(reset)

    expect(fixture.setFramingScale).toHaveBeenLastCalledWith(1)
    expect(fixture.setFramingOffset).toHaveBeenLastCalledWith({ x: 0, y: 0 })
    expect(slider).toHaveValue('100')
    expect(offsetX).toHaveValue('0')
    expect(offsetY).toHaveValue('0')
    expect(
      screen.getByText('100%', {
        selector: 'output[for="pet-framing-scale"]',
      }),
    ).toBeVisible()
    expect(reset).toBeDisabled()
  })

  it('상태 mapping은 실제 Spine animation을 재생하고 pointer와 눈 이동량을 session에 전달한다', async () => {
    const user = userEvent.setup()
    const fixture = createSession(
      '3.6.53',
      'verified',
      ['w_happy_idle01_f', 'w_normal_walk01_f'],
      'w_happy_idle01_f',
    )
    mockPreview([createBundle('interactive-preview')], [fixture.session])
    const catalogSpy = vi.spyOn(prskRemoteCatalogSource, 'load')
    const modelSpy = vi.spyOn(prskRemoteResourceSource, 'load')
    const { container } = render(<App />)
    await uploadInputs(container)
    await screen.findByRole('heading', { name: 'interactive-preview' })
    await waitFor(() =>
      expect(fixture.setAnimationMappings).toHaveBeenCalled(),
    )
    expect(fixture.setAnimationMappings.mock.calls.at(-1)?.[0]).toMatchObject({
      idle: { animationName: 'w_happy_idle01_f' },
      'running-right': { animationName: 'w_normal_walk01_f' },
    })

    const idleShortcut = screen.getByRole('button', {
      name: /대기 미리보기: 차분한 호흡과 눈 깜박임/,
    })
    await user.click(idleShortcut)
    expect(fixture.session.play).toHaveBeenLastCalledWith('w_happy_idle01_f')
    expect(fixture.setMirrorX).toHaveBeenLastCalledWith(false)
    expect(idleShortcut).toHaveAttribute('aria-pressed', 'true')
    expect(catalogSpy).not.toHaveBeenCalled()
    expect(modelSpy).not.toHaveBeenCalled()

    const idleMapping = screen.getByRole('combobox', {
      name: '대기 애니메이션',
    })
    fireEvent.focus(idleMapping)
    expect(fixture.session.play).toHaveBeenLastCalledWith('w_happy_idle01_f')

    await user.clear(idleMapping)
    await user.type(idleMapping, 'w_normal_walk01_f')
    await user.click(screen.getByRole('option', {
      name: 'w_normal_walk01_f',
    }))
    expect(fixture.setAnimationMappings.mock.calls.at(-1)?.[0]).toMatchObject({
      idle: { animationName: 'w_normal_walk01_f' },
    })
    expect(fixture.session.play).toHaveBeenLastCalledWith('w_normal_walk01_f')
    expect(screen.getByText('w_normal_walk01_f', {
      selector: '.preview-meta span',
    })).toBeVisible()
    expect(idleShortcut).toHaveAttribute('aria-pressed', 'true')

    const runningRightShortcut = screen.getByRole('button', {
      name: /^오른쪽 이동 미리보기:/,
    })
    await user.click(runningRightShortcut)
    expect(fixture.session.play).toHaveBeenLastCalledWith('w_normal_walk01_f')
    expect(fixture.setMirrorX).toHaveBeenLastCalledWith(true)
    expect(runningRightShortcut).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    }))
    expect(fixture.setMirrorX).toHaveBeenLastCalledWith(false)

    await user.click(screen.getByRole('checkbox', {
      name: '오른쪽 이동 수평 반전',
    }))
    expect(fixture.setMirrorX).toHaveBeenLastCalledWith(true)
    expect(runningRightShortcut).toHaveAttribute('aria-pressed', 'true')

    const directAnimation = screen.getByRole('combobox', {
      name: '애니메이션',
    })
    await user.click(directAnimation)
    await user.type(directAnimation, 'HAPPY')
    await user.keyboard('{Enter}')
    expect(fixture.session.play).toHaveBeenLastCalledWith('w_happy_idle01_f')
    expect(fixture.setMirrorX).toHaveBeenLastCalledWith(true)
    expect(idleShortcut).toHaveAttribute('aria-pressed', 'false')
    expect(runningRightShortcut).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('combobox', {
      name: '대기 애니메이션',
    })).toHaveValue('w_normal_walk01_f')
    expect(catalogSpy).not.toHaveBeenCalled()
    expect(modelSpy).not.toHaveBeenCalled()

    const canvas = screen.getByLabelText('프로세카 캐릭터 미리보기')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 250,
      height: 200,
      left: 100,
      right: 500,
      top: 50,
      width: 400,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    })
    fireEvent.pointerMove(canvas, { clientX: 500, clientY: 150 })
    expect(fixture.setLookTarget).toHaveBeenLastCalledWith(
      { x: 1, y: 0 },
      1,
    )

    fireEvent.change(screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    }), { target: { value: '150' } })
    expect(fixture.setLookTarget).toHaveBeenLastCalledWith(
      { x: 1, y: 0 },
      1.5,
    )

    fireEvent.pointerLeave(canvas)
    expect(fixture.setLookTarget).toHaveBeenLastCalledWith(null, 1.5)
  })

  it('ready preview에서 locale을 바꿔도 session, animation, mapping과 배율을 보존한다', async () => {
    const user = userEvent.setup()
    const fixture = createSession(
      '3.6.53',
      'verified',
      ['w_happy_idle01_f', 'w_normal_walk01_f'],
      'w_happy_idle01_f',
    )
    const { createSpy, importSpy } = mockPreview(
      [createBundle('locale-state-source')],
      [fixture.session],
    )
    const catalogSpy = vi.spyOn(prskRemoteCatalogSource, 'load')
    const modelSpy = vi.spyOn(prskRemoteResourceSource, 'load')
    const { container } = render(<App />)
    await uploadInputs(container)
    await screen.findByRole('heading', { name: 'locale-state-source' })

    await chooseSearchableOption(
      user,
      '대기 애니메이션',
      'w_normal_walk01_f',
    )
    const idleShortcut = screen.getByRole('button', {
      name: /^대기 미리보기:/,
    })
    await user.click(idleShortcut)
    expect(idleShortcut).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    }))
    expect(fixture.setMirrorX).toHaveBeenLastCalledWith(true)
    const mirrorCallsBeforeLocale = fixture.setMirrorX.mock.calls.length
    fireEvent.change(screen.getByRole('slider', {
      name: 'Pet 크기 슬라이더',
    }), { target: { value: '84' } })
    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByRole('navigation', {
      name: 'Game selection',
    })).toBeVisible()
    expect(screen.getByRole('combobox', {
      name: 'Idle animation',
    })).toHaveValue('w_normal_walk01_f')
    expect(screen.getByRole('button', {
      name: /^Preview Idle:/,
    })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('checkbox', {
      name: 'Mirror the entire character horizontally',
    })).toBeChecked()
    expect(screen.getByRole('slider', {
      name: 'Pet size slider',
    })).toHaveValue('84')
    expect(screen.getByText('Previewing locale-state-source.')).toBeVisible()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(importSpy).toHaveBeenCalledTimes(1)
    expect(catalogSpy).not.toHaveBeenCalled()
    expect(modelSpy).not.toHaveBeenCalled()
    expect(fixture.dispose).not.toHaveBeenCalled()
    expect(fixture.setMirrorX).toHaveBeenCalledTimes(mirrorCallsBeforeLocale)
  })

  it('영어 locale은 archive stable code와 path를 보존하고 한국어 원문을 노출하지 않는다', async () => {
    const user = userEvent.setup()
    vi.spyOn(prskCharacterArchiveImporter, 'import').mockRejectedValue(
      new PrskArchiveImportError(
        'ATLAS_PAGE_MISSING',
        'atlas가 참조하는 PNG가 ZIP에 없습니다: nested/page.png',
        { path: 'nested/page.png' },
      ),
    )
    const { container } = render(<App />)

    await uploadInputs(container)
    await user.click(screen.getByRole('button', { name: 'English' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('ATLAS_PAGE_MISSING')
    expect(alert).toHaveTextContent('nested/page.png')
    expect(alert).toHaveTextContent('Some character images are missing or unreadable.')
    expect(alert).not.toHaveTextContent('참조하는 PNG')
  })

  it('ready 이후 render 오류를 구독해 code와 message를 표시한다', async () => {
    const fixture = createSession()
    mockPreview([createBundle('render-source')], [fixture.session])
    const { container } = render(<App />)
    await uploadInputs(container)
    await screen.findByRole('heading', { name: 'render-source' })

    act(() => {
      fixture.emitError(
        new LiveSDPreviewError(
          'PREVIEW_RENDER_FAILED',
          'LiveSD WebGL 미리보기를 계속 렌더링하지 못했습니다.',
        ),
      )
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('PREVIEW_RENDER_FAILED')
    expect(alert).toHaveTextContent('예상하지 못한 오류가 발생했습니다')
    expect(screen.getByRole('heading', { name: '캐릭터 미리보기' })).toBeVisible()
    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('새 source가 ready가 된 뒤에만 이전 session과 구독을 교체한다', async () => {
    const first = createSession('3.6.53', 'verified')
    const second = createSession('3.7.0', 'best_effort')
    const firstBundle = createBundle('first-source')
    const secondBundle = createBundle('second-source')
    const importSpy = vi
      .spyOn(prskCharacterArchiveImporter, 'import')
      .mockResolvedValueOnce(firstBundle)
      .mockResolvedValueOnce(secondBundle)
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      hash: 'hash',
      version: '3.6.53',
      compatibility: 'verified',
    })
    let resolveSecond: ((session: LiveSDPreviewSession) => void) | undefined
    const pendingSecond = new Promise<LiveSDPreviewSession>((resolve) => {
      resolveSecond = resolve
    })
    const createSpy = vi
      .spyOn(liveSD36Adapter, 'createPreview')
      .mockResolvedValueOnce(first.session)
      .mockReturnValueOnce(pendingSecond)
    const { container } = render(<App />)

    await uploadInputs(container, 'first.zip')
    await screen.findByRole('heading', { name: 'first-source' })

    const scaleSlider = screen.getByRole('slider', {
      name: 'Pet 크기 슬라이더',
    })
    fireEvent.change(scaleSlider, { target: { value: '80' } })
    expect(scaleSlider).toHaveValue('80')
    expect(first.setFramingScale).toHaveBeenLastCalledWith(0.8)

    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    }))
    expect(first.setMirrorX).toHaveBeenLastCalledWith(true)
    const archiveInput = fileInputs(container)[1]
    if (!archiveInput) throw new Error('Expected archive input')
    await user.upload(
      archiveInput,
      new File(['zip'], 'second.zip', { type: 'application/zip' }),
    )
    await user.click(
      screen.getByRole('button', { name: '캐릭터 미리보기' }),
    )
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2))
    expect(importSpy).toHaveBeenCalledTimes(2)
    expect(first.dispose).not.toHaveBeenCalled()
    expect(first.unsubscribe).not.toHaveBeenCalled()
    expect(scaleSlider).toHaveValue('80')
    expect(second.setFramingScale).not.toHaveBeenCalled()
    expect(second.setMirrorX).not.toHaveBeenCalled()

    await act(async () => {
      resolveSecond?.(second.session)
      await pendingSecond
    })

    expect(
      await screen.findByRole('heading', { name: 'second-source' }),
    ).toBeVisible()
    expect(first.unsubscribe).toHaveBeenCalledTimes(1)
    expect(first.dispose).toHaveBeenCalledTimes(1)
    expect(second.setFramingScale).toHaveBeenLastCalledWith(1)
    expect(second.setMirrorX).toHaveBeenLastCalledWith(false)
    expect(scaleSlider).toHaveValue('100')
    expect(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    })).not.toBeChecked()
  })

  it('초기 provided source와 게임 탭은 명시적 불러오기 전 요청을 시작하지 않는다', async () => {
    const user = userEvent.setup()
    const catalogSpy = vi.spyOn(prskRemoteCatalogSource, 'load')
    const modelSpy = vi.spyOn(prskRemoteResourceSource, 'load')
    const inspectSpy = vi.spyOn(liveSD36Adapter, 'inspectSkeleton')
    const createSpy = vi.spyOn(liveSD36Adapter, 'createPreview')

    render(<App />)

    expect(screen.getByRole('radio', { name: '기본 캐릭터' })).toBeChecked()
    expect(screen.queryByRole('textbox', {
      name: '캐릭터 서버 URL',
    })).not.toBeInTheDocument()
    expect(catalogSpy).not.toHaveBeenCalled()
    expect(modelSpy).not.toHaveBeenCalled()
    expect(inspectSpy).not.toHaveBeenCalled()
    expect(createSpy).not.toHaveBeenCalled()

    expect(screen.getByRole('combobox', {
      name: '캐릭터 검색',
    })).toBeDisabled()
    expect(document.body).not.toHaveTextContent(
      new URL(PRSK_CHIBI_VIEWER_CATALOG_URL).origin,
    )
    expect(document.body).not.toHaveTextContent(
      new URL(PJSEK_AI_ASSET_BASE_URL).origin,
    )
    expect(screen.getByText(
      '온라인 캐릭터는 변경되거나 제공이 중단될 수 있습니다. 불러오면 외부 서버에 연결됩니다.',
    )).toBeVisible()
    expect(catalogSpy).not.toHaveBeenCalled()
    expect(modelSpy).not.toHaveBeenCalled()
    expect(inspectSpy).not.toHaveBeenCalled()
    expect(createSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: '다른 서버' }))
    expect(screen.getByRole('textbox', {
      name: '캐릭터 서버 URL',
    })).toHaveAttribute('placeholder', 'https://provider.example/area_sd')
    expect(catalogSpy).not.toHaveBeenCalled()
  })

  it('catalog empty 오류를 stable code와 combobox 상태로 표시하고 명시적 재시도로 복구한다', async () => {
    const user = userEvent.setup()
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockRejectedValueOnce(
        new PrskRemoteError(
          'REMOTE_CATALOG_EMPTY',
          '원격 catalog에 사용할 수 있는 캐릭터가 없습니다.',
        ),
      )
      .mockRejectedValueOnce(
        new PrskRemoteError(
          'REMOTE_NETWORK_OR_CORS',
          '원격 서버에 연결할 수 없습니다. 네트워크 상태와 서버의 CORS 설정을 확인하세요.',
        ),
      )
      .mockResolvedValueOnce(createRemoteCatalog())
    const modelSpy = vi.spyOn(prskRemoteResourceSource, 'load')

    render(<App />)
    await user.click(screen.getByRole('radio', { name: '다른 서버' }))
    await user.type(
      screen.getByRole('textbox', { name: '캐릭터 서버 URL' }),
      'https://assets.example.test/area_sd',
    )
    await user.click(screen.getByRole('button', { name: '불러오기' }))

    const characterCombobox = screen.getByRole('combobox', {
      name: '캐릭터 검색',
    })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('REMOTE_CATALOG_EMPTY')
    expect(alert).toHaveTextContent('캐릭터 목록을 불러오지 못했습니다')
    expect(characterCombobox).toBeDisabled()
    expect(
      within(comboboxRoot(characterCombobox)).getByRole('status'),
    ).toHaveTextContent('캐릭터 목록을 불러오지 못했습니다')
    expect(modelSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '불러오기' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'REMOTE_NETWORK_OR_CORS',
      ),
    )
    expect(characterCombobox).toBeDisabled()
    expect(
      within(comboboxRoot(characterCombobox)).getByRole('status'),
    ).toHaveTextContent('네트워크와 URL을 확인해주세요')

    await user.click(screen.getByRole('button', { name: '불러오기' }))

    await waitFor(() => expect(characterCombobox).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(catalogSpy).toHaveBeenCalledTimes(3)
    expect(modelSpy).not.toHaveBeenCalled()
  })

  it('custom catalog는 캐릭터 commit 뒤 모델 commit에서만 모델을 요청한다', async () => {
    const user = userEvent.setup()
    const catalog = createRemoteCatalog()
    const fixture = createSession()
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockResolvedValue(catalog)
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValue(createRemoteModel('sd_21miku_street'))
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'best_effort',
      hash: 'remote-hash',
      version: '3.3',
    })
    const createSpy = vi
      .spyOn(liveSD36Adapter, 'createPreview')
      .mockResolvedValue(fixture.session)

    render(<App />)
    const characterCombobox = await loadCustomRemoteCatalog(user)

    expect(catalogSpy).toHaveBeenCalledTimes(1)
    expect(modelSpy).not.toHaveBeenCalled()
    await user.click(characterCombobox)
    await user.type(characterCombobox, 'MIKU')

    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      '하츠네 미쿠',
    ])
    expect(modelSpy).not.toHaveBeenCalled()
    await user.keyboard('{ArrowDown}')
    expect(modelSpy).not.toHaveBeenCalled()

    await user.keyboard('{Enter}')
    expect(characterCombobox).toHaveValue('하츠네 미쿠')
    expect(modelSpy).not.toHaveBeenCalled()

    const modelCombobox = remoteModelCombobox()
    expect(modelCombobox).toBeEnabled()
    await user.click(modelCombobox)
    await user.type(modelCombobox, 'STREET')
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'Street',
    ])
    expect(modelSpy).not.toHaveBeenCalled()
    await user.keyboard('{ArrowDown}')
    expect(modelSpy).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(modelSpy).toHaveBeenCalledTimes(1))
    const request = modelSpy.mock.calls[0]?.[0]
    expect(request?.catalog).toBe(catalog)
    expect(request?.characterId).toBe('sd_21miku_street')
    expect(request?.signal).toBeInstanceOf(AbortSignal)
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole('heading', { name: 'sd_21miku_street' }),
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      'Street - 하츠네 미쿠',
    )
  })

  it('PRSK locale 전환은 공식 캐릭터명만 갱신하고 선택, preview와 request를 보존한다', async () => {
    const user = userEvent.setup()
    const fixture = createSession()
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockResolvedValue(createRemoteCatalog())
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValue(createRemoteModel('sd_21miku_normal'))
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'best_effort',
      hash: 'remote-hash',
      version: '3.3',
    })
    const createSpy = vi
      .spyOn(liveSD36Adapter, 'createPreview')
      .mockResolvedValue(fixture.session)

    render(<App />)
    const characterCombobox = await loadCustomRemoteCatalog(user)
    await loadRemoteCharacterModel(user)
    await screen.findByRole('heading', { name: 'sd_21miku_normal' })

    expect(characterCombobox).toHaveValue('하츠네 미쿠')
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      'Normal - 하츠네 미쿠',
    )
    await user.click(screen.getByRole('button', { name: 'English' }))

    const englishCharacterCombobox = screen.getByRole('combobox', {
      name: 'Character search',
    })
    expect(englishCharacterCombobox).toHaveValue('Hatsune Miku')
    expect(screen.getByRole('combobox', {
      name: 'Model search',
    })).toHaveValue('Normal')
    expect(screen.getByRole('textbox', { name: 'Pet name' })).toHaveValue(
      'Normal - 하츠네 미쿠',
    )
    await user.click(englishCharacterCombobox)
    expect(screen.getByRole('option', {
      name: 'Hatsune Miku',
    })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Escape}')

    expect(catalogSpy).toHaveBeenCalledTimes(1)
    expect(modelSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(fixture.dispose).not.toHaveBeenCalled()
    expect(fixture.unsubscribe).not.toHaveBeenCalled()
  })

  it('catalog 재로드는 query와 제거된 option을 비우고 새 catalog에 남은 selection만 보존한다', async () => {
    const user = userEvent.setup()
    const firstCatalog = createRemoteCatalog()
    const retainedCatalog = createRemoteCatalog([
      REMOTE_CHARACTERS[0],
      { id: 'sd_new', label: 'New Character' },
    ])
    const removedCatalog = createRemoteCatalog([
      { id: 'sd_new', label: 'New Character' },
    ])
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockResolvedValueOnce(firstCatalog)
      .mockResolvedValueOnce(retainedCatalog)
      .mockResolvedValueOnce(removedCatalog)
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValue(createRemoteModel('sd_21miku_normal'))
    const fixture = createSession()
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'best_effort',
      hash: 'remote-hash',
      version: '3.3',
    })
    vi.spyOn(liveSD36Adapter, 'createPreview').mockResolvedValue(fixture.session)

    render(<App />)
    const characterCombobox = await loadCustomRemoteCatalog(user)
    await loadRemoteCharacterModel(user)
    await screen.findByRole('heading', { name: 'sd_21miku_normal' })
    const modelCombobox = remoteModelCombobox()

    await user.click(characterCombobox)
    await user.clear(characterCombobox)
    await user.type(characterCombobox, 'MIKU')
    expect(searchableOptions()).toHaveLength(1)
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '불러오기' }))
    await waitFor(() => expect(characterCombobox).toBeEnabled())

    expect(characterCombobox).toHaveValue('하츠네 미쿠')
    expect(modelCombobox).toHaveValue('Normal')
    await user.click(characterCombobox)
    const retainedOptions = searchableOptions()
    expect(retainedOptions.map((option) => option.textContent)).toEqual([
      '하츠네 미쿠',
      'New',
    ])
    expect(retainedOptions.find(
      (option) => option.textContent === '하츠네 미쿠',
    )).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: '불러오기' }))
    await waitFor(() => expect(characterCombobox).toBeEnabled())
    expect(characterCombobox).toHaveValue('')
    expect(modelCombobox).toHaveValue('')
    expect(modelCombobox).toBeDisabled()
    await user.click(characterCombobox)
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'New',
    ])
    expect(searchableOptions()[0]).toHaveAttribute('aria-selected', 'false')
    expect(catalogSpy).toHaveBeenCalledTimes(3)
    expect(modelSpy).toHaveBeenCalledTimes(1)
  })

  it('실제 session animation 검색은 재생을 유지하고 visible option commit만 재생한다', async () => {
    const user = userEvent.setup()
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockResolvedValue(createRemoteCatalog())
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValue(createRemoteModel('sd_21miku_normal'))
    const fixture = createSession(
      '3.6.53',
      'verified',
      ['pose_default', 'idle', 'walk'],
      'pose_default',
    )
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'verified',
      hash: 'remote-hash',
      version: '3.6.53',
    })
    vi.spyOn(liveSD36Adapter, 'createPreview').mockResolvedValue(fixture.session)

    render(<App />)
    await loadCustomRemoteCatalog(user)
    await loadRemoteCharacterModel(user)
    await screen.findByRole('heading', { name: 'sd_21miku_normal' })

    const animationCombobox = screen.getByRole('combobox', {
      name: '애니메이션',
    })
    expect(animationCombobox).toHaveValue('pose_default')
    await user.click(animationCombobox)
    await user.type(animationCombobox, 'WAL')

    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'walk',
    ])
    expect(fixture.session.play).not.toHaveBeenCalled()
    expect(catalogSpy).toHaveBeenCalledTimes(1)
    expect(modelSpy).toHaveBeenCalledTimes(1)

    await user.keyboard('{Enter}')

    expect(fixture.session.play).toHaveBeenCalledTimes(1)
    expect(fixture.session.play).toHaveBeenCalledWith('walk')
    expect(animationCombobox).toHaveValue('walk')
    expect(catalogSpy).toHaveBeenCalledTimes(1)
    expect(modelSpy).toHaveBeenCalledTimes(1)
  })

  it('서로 다른 원격 skeleton fixture의 파싱 결과로 animation option과 기본값을 통째로 교체한다', async () => {
    const user = userEvent.setup()
    const firstSkeleton = new Uint8Array([1, 10]).buffer
    const secondSkeleton = new Uint8Array([2, 20]).buffer
    const firstInput = {
      ...createRemoteModel('sd_21miku_normal'),
      skeletonData: firstSkeleton,
    }
    const secondInput = {
      ...createRemoteModel('sd_21miku_street'),
      skeletonData: secondSkeleton,
    }
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockResolvedValue(createRemoteCatalog())
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValueOnce(firstInput)
      .mockResolvedValueOnce(secondInput)
    const first = createSession(
      '3.6.53',
      'verified',
      ['first_idle', 'first_wave'],
      'first_idle',
    )
    const second = createSession(
      '3.6.53',
      'verified',
      ['pose_default', 'second_jump'],
      'pose_default',
    )
    const inspectSpy = vi
      .spyOn(liveSD36Adapter, 'inspectSkeleton')
      .mockReturnValue({
        compatibility: 'verified',
        hash: 'remote-hash',
        version: '3.6.53',
      })
    vi.spyOn(liveSD36Adapter, 'createPreview').mockImplementation(
      async ({ skeletonData }) =>
        skeletonData === firstSkeleton ? first.session : second.session,
    )

    render(<App />)
    await loadCustomRemoteCatalog(user)
    await loadRemoteCharacterModel(user)
    await screen.findByRole('heading', { name: 'sd_21miku_normal' })

    const animationCombobox = screen.getByRole('combobox', {
      name: '애니메이션',
    })
    expect(animationCombobox).toHaveValue('first_idle')
    await user.click(animationCombobox)
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'first_idle',
      'first_wave',
    ])
    await user.type(animationCombobox, 'WAVE')
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'first_wave',
    ])
    await user.keyboard('{Enter}')
    expect(first.session.play).toHaveBeenCalledWith('first_wave')

    await selectRemoteModel(user, 'Street')
    await screen.findByRole('heading', { name: 'sd_21miku_street' })

    expect(first.dispose).toHaveBeenCalledTimes(1)
    expect(animationCombobox).toHaveValue('pose_default')
    await user.click(animationCombobox)
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'pose_default',
      'second_jump',
    ])
    expect(screen.queryByRole('option', { name: 'first_wave' })).not.toBeInTheDocument()
    await user.type(animationCombobox, 'missing')
    expect(
      within(comboboxRoot(animationCombobox)).getByRole('status'),
    ).toHaveTextContent('검색 결과 없음')
    await user.keyboard('{Enter}')
    expect(second.session.play).not.toHaveBeenCalled()
    await user.clear(animationCombobox)
    expect(searchableOptions()).toHaveLength(2)
    await user.type(animationCombobox, 'JUMP')
    await user.keyboard('{Enter}')

    expect(second.session.play).toHaveBeenCalledWith('second_jump')
    expect(inspectSpy).toHaveBeenNthCalledWith(1, firstSkeleton)
    expect(inspectSpy).toHaveBeenNthCalledWith(2, secondSkeleton)
    expect(catalogSpy).toHaveBeenCalledTimes(1)
    expect(modelSpy).toHaveBeenCalledTimes(2)
  })

  it('캐릭터와 animation의 결과 없는 자유 입력은 선택이나 요청 및 재생으로 commit하지 않는다', async () => {
    const user = userEvent.setup()
    vi.spyOn(prskRemoteCatalogSource, 'load').mockResolvedValue(
      createRemoteCatalog(),
    )
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValue(createRemoteModel('sd_21miku_normal'))
    const fixture = createSession(
      '3.6.53',
      'verified',
      ['pose_default', 'idle'],
      'pose_default',
    )
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'verified',
      hash: 'remote-hash',
      version: '3.6.53',
    })
    vi.spyOn(liveSD36Adapter, 'createPreview').mockResolvedValue(fixture.session)

    render(<App />)
    const characterCombobox = await loadCustomRemoteCatalog(user)
    await user.click(characterCombobox)
    await user.type(characterCombobox, 'not-in-catalog')

    expect(within(comboboxRoot(characterCombobox)).getByRole('status')).toHaveTextContent(
      '검색 결과 없음',
    )
    expect(
      within(screen.getByRole('listbox')).queryAllByRole('option'),
    ).toHaveLength(0)
    await user.keyboard('{Enter}')
    expect(modelSpy).not.toHaveBeenCalled()

    await user.clear(characterCombobox)
    expect(searchableOptions()).toHaveLength(2)
    await user.click(screen.getByRole('option', { name: '하츠네 미쿠' }))
    expect(modelSpy).not.toHaveBeenCalled()

    const modelCombobox = remoteModelCombobox()
    await user.click(modelCombobox)
    await user.type(modelCombobox, 'not-a-model')
    expect(within(comboboxRoot(modelCombobox)).getByRole('status')).toHaveTextContent(
      '검색 결과 없음',
    )
    await user.keyboard('{Enter}')
    expect(modelSpy).not.toHaveBeenCalled()
    await user.clear(modelCombobox)
    await user.click(screen.getByRole('option', { name: 'Normal' }))
    await screen.findByRole('heading', { name: 'sd_21miku_normal' })

    const animationCombobox = screen.getByRole('combobox', {
      name: '애니메이션',
    })
    await user.click(animationCombobox)
    await user.type(animationCombobox, 'not-an-animation')
    expect(within(comboboxRoot(animationCombobox)).getByRole('status')).toHaveTextContent(
      '검색 결과 없음',
    )
    await user.keyboard('{Enter}')

    expect(fixture.session.play).not.toHaveBeenCalled()
    expect(modelSpy).toHaveBeenCalledTimes(1)
    expect(animationCombobox).toHaveValue('not-an-animation')
  })

  it('연속 catalog와 model 선택은 이전 signal을 abort하고 stale generation 결과를 무시한다', async () => {
    const user = userEvent.setup()
    const firstCatalogResult = createDeferred<PrskRemoteCatalog>()
    const secondCatalogResult = createDeferred<PrskRemoteCatalog>()
    const staleCatalog = createRemoteCatalog([
      { id: 'sd_stale', label: 'Stale Character' },
    ])
    const currentCatalog = createRemoteCatalog(REMOTE_CHARACTERS.slice(0, 2))
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockReturnValueOnce(firstCatalogResult.promise)
      .mockReturnValueOnce(secondCatalogResult.promise)
    const firstModelResult = createDeferred<PrskRemoteModelInput>()
    const secondModelResult = createDeferred<PrskRemoteModelInput>()
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockReturnValueOnce(firstModelResult.promise)
      .mockReturnValueOnce(secondModelResult.promise)
    const latestFixture = createSession()
    const inspectSpy = vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'best_effort',
      hash: 'latest-hash',
      version: '3.3',
    })
    const createSpy = vi
      .spyOn(liveSD36Adapter, 'createPreview')
      .mockResolvedValue(latestFixture.session)

    render(<App />)
    await user.click(screen.getByRole('radio', { name: '다른 서버' }))
    await user.type(
      screen.getByRole('textbox', { name: '캐릭터 서버 URL' }),
      'https://assets.example.test/area_sd',
    )
    await user.click(screen.getByRole('button', { name: '불러오기' }))
    const firstCatalogSignal = catalogSpy.mock.calls[0]?.[0].signal
    const loadButton = screen.getByRole('button', { name: '불러오기' })
    expect(loadButton).toBeDisabled()
    await user.click(loadButton)
    expect(catalogSpy).toHaveBeenCalledTimes(1)

    await user.type(
      screen.getByRole('textbox', { name: '캐릭터 서버 URL' }),
      '/v2',
    )

    expect(firstCatalogSignal?.aborted).toBe(true)
    await user.click(screen.getByRole('button', { name: '불러오기' }))
    await act(async () => {
      secondCatalogResult.resolve(currentCatalog)
      await secondCatalogResult.promise
    })
    const characterCombobox = screen.getByRole('combobox', {
      name: '캐릭터 검색',
    })
    await waitFor(() => expect(characterCombobox).toBeEnabled())

    await act(async () => {
      firstCatalogResult.resolve(staleCatalog)
      await firstCatalogResult.promise
    })
    await user.click(characterCombobox)
    expect(screen.queryByRole('option', { name: 'Stale' })).not.toBeInTheDocument()
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      '하츠네 미쿠',
    ])

    await user.click(screen.getByRole('option', { name: '하츠네 미쿠' }))
    expect(modelSpy).not.toHaveBeenCalled()
    const modelCombobox = remoteModelCombobox()
    await user.click(modelCombobox)
    await user.click(screen.getByRole('option', { name: 'Normal' }))
    const firstModelSignal = modelSpy.mock.calls[0]?.[0].signal
    await user.click(modelCombobox)
    await user.click(screen.getByRole('option', { name: 'Street' }))

    expect(firstModelSignal?.aborted).toBe(true)
    await act(async () => {
      secondModelResult.resolve(createRemoteModel('sd_21miku_street'))
      await secondModelResult.promise
    })
    expect(
      await screen.findByRole('heading', { name: 'sd_21miku_street' }),
    ).toBeVisible()

    await act(async () => {
      firstModelResult.resolve(createRemoteModel('sd_21miku_normal'))
      await firstModelResult.promise
    })
    expect(inspectSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'sd_21miku_street' })).toBeVisible()
  })

  it('진행 중 model 요청에서 두 combobox의 query와 highlight만 바꾸면 signal과 generation을 유지한다', async () => {
    const user = userEvent.setup()
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockResolvedValue(createRemoteCatalog())
    const pendingModel = createDeferred<PrskRemoteModelInput>()
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValueOnce(createRemoteModel('sd_21miku_normal'))
      .mockReturnValueOnce(pendingModel.promise)
    const first = createSession(
      '3.6.53',
      'verified',
      ['pose_default', 'idle', 'walk'],
      'pose_default',
    )
    const second = createSession(
      '3.6.53',
      'verified',
      ['pose_default', 'jump'],
      'pose_default',
    )
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'verified',
      hash: 'remote-hash',
      version: '3.6.53',
    })
    vi.spyOn(liveSD36Adapter, 'createPreview')
      .mockResolvedValueOnce(first.session)
      .mockResolvedValueOnce(second.session)

    render(<App />)
    const characterCombobox = await loadCustomRemoteCatalog(user)
    await loadRemoteCharacterModel(user)
    await screen.findByRole('heading', { name: 'sd_21miku_normal' })

    await selectRemoteModel(user, 'Street')
    await waitFor(() => expect(modelSpy).toHaveBeenCalledTimes(2))
    const pendingSignal = modelSpy.mock.calls[1]?.[0].signal
    expect(pendingSignal?.aborted).toBe(false)

    await user.click(characterCombobox)
    await user.clear(characterCombobox)
    await user.type(characterCombobox, 'MIKU')
    await user.keyboard('{ArrowDown}{ArrowUp}')
    const modelCombobox = remoteModelCombobox()
    await user.click(modelCombobox)
    await user.clear(modelCombobox)
    await user.type(modelCombobox, 'NOR')
    await user.keyboard('{ArrowDown}{ArrowUp}')
    const animationCombobox = screen.getByRole('combobox', {
      name: '애니메이션',
    })
    await user.click(animationCombobox)
    await user.type(animationCombobox, 'ID')
    await user.keyboard('{ArrowDown}{ArrowUp}')

    expect(pendingSignal?.aborted).toBe(false)
    expect(catalogSpy).toHaveBeenCalledTimes(1)
    expect(modelSpy).toHaveBeenCalledTimes(2)
    expect(first.session.play).not.toHaveBeenCalled()

    await act(async () => {
      pendingModel.resolve(createRemoteModel('sd_21miku_street'))
      await pendingModel.promise
    })
    expect(
      await screen.findByRole('heading', { name: 'sd_21miku_street' }),
    ).toBeVisible()
    expect(first.dispose).toHaveBeenCalledTimes(1)
  })

  it('provider 편집과 source mode 전환은 진행 중인 catalog 및 model 요청을 취소한다', async () => {
    const user = userEvent.setup()
    const pendingCatalog = createDeferred<PrskRemoteCatalog>()
    const catalog = createRemoteCatalog()
    const catalogSpy = vi
      .spyOn(prskRemoteCatalogSource, 'load')
      .mockReturnValueOnce(pendingCatalog.promise)
      .mockResolvedValueOnce(catalog)
    const pendingModel = createDeferred<PrskRemoteModelInput>()
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockReturnValueOnce(pendingModel.promise)
    const inspectSpy = vi.spyOn(liveSD36Adapter, 'inspectSkeleton')
    const createSpy = vi.spyOn(liveSD36Adapter, 'createPreview')

    render(<App />)
    await user.click(screen.getByRole('radio', { name: '다른 서버' }))
    const urlInput = screen.getByRole('textbox', {
      name: '캐릭터 서버 URL',
    })
    await user.type(urlInput, 'https://assets.example.test/area_sd')
    await user.click(screen.getByRole('button', { name: '불러오기' }))
    const catalogSignal = catalogSpy.mock.calls[0]?.[0].signal

    await user.type(urlInput, '/v2')

    expect(catalogSignal?.aborted).toBe(true)
    expect(screen.getByRole('combobox', {
      name: '캐릭터 검색',
    })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '불러오기' }))
    const characterCombobox = screen.getByRole('combobox', {
      name: '캐릭터 검색',
    })
    await waitFor(() => expect(characterCombobox).toBeEnabled())
    await loadRemoteCharacterModel(user)
    const modelSignal = modelSpy.mock.calls[0]?.[0].signal

    expect(modelSignal?.aborted).toBe(false)
    await user.click(screen.getByRole('radio', { name: '파일에서 불러오기' }))

    expect(modelSignal?.aborted).toBe(true)
    expect(screen.queryByRole('combobox', {
      name: '캐릭터 검색',
    })).not.toBeInTheDocument()
    expect(screen.getByText('.skel 선택')).toBeVisible()
    expect(inspectSpy).not.toHaveBeenCalled()
    expect(createSpy).not.toHaveBeenCalled()

    await act(async () => {
      pendingCatalog.resolve(createRemoteCatalog([
        { id: 'sd_stale', label: 'Stale Character' },
      ]))
      pendingModel.resolve(createRemoteModel('sd_21miku_normal'))
      await Promise.all([pendingCatalog.promise, pendingModel.promise])
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(inspectSpy).not.toHaveBeenCalled()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('원격 model 실패는 기존 session과 두 dropdown의 query 및 선택을 보존한다', async () => {
    const user = userEvent.setup()
    vi.spyOn(prskRemoteCatalogSource, 'load').mockResolvedValue(
      createRemoteCatalog(),
    )
    const modelSpy = vi
      .spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValueOnce(createRemoteModel('sd_21miku_normal'))
      .mockRejectedValueOnce(
        new PrskRemoteError(
          'REMOTE_NETWORK_OR_CORS',
          '원격 서버의 CORS 설정과 네트워크 상태를 확인하세요.',
        ),
      )
    const fixture = createSession(
      '3.6.53',
      'verified',
      ['pose_default', 'idle', 'walk'],
      'pose_default',
    )
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'verified',
      hash: 'remote-hash',
      version: '3.6.53',
    })
    vi.spyOn(liveSD36Adapter, 'createPreview').mockResolvedValue(fixture.session)

    render(<App />)
    const characterCombobox = await loadCustomRemoteCatalog(user)
    await loadRemoteCharacterModel(user)
    await screen.findByRole('heading', { name: 'sd_21miku_normal' })
    const modelCombobox = remoteModelCombobox()

    const animationCombobox = screen.getByRole('combobox', {
      name: '애니메이션',
    })
    await user.click(animationCombobox)
    await user.type(animationCombobox, 'ID')
    expect(searchableOptions()).toHaveLength(1)
    await user.keyboard('{Escape}')

    await user.click(characterCombobox)
    await user.clear(characterCombobox)
    await user.type(characterCombobox, 'MIKU')
    await user.keyboard('{Escape}')
    await selectRemoteModel(user, 'Street')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('REMOTE_NETWORK_OR_CORS')
    expect(screen.getByRole('heading', { name: 'sd_21miku_normal' })).toBeVisible()
    expect(fixture.dispose).not.toHaveBeenCalled()
    expect(fixture.unsubscribe).not.toHaveBeenCalled()
    expect(characterCombobox).toHaveValue('하츠네 미쿠')
    expect(modelCombobox).toHaveValue('Street')
    expect(animationCombobox).toHaveValue('pose_default')
    expect(fixture.session.play).not.toHaveBeenCalled()

    await user.click(characterCombobox)
    expect(characterCombobox).toHaveValue('MIKU')
    const characterOptions = searchableOptions()
    expect(characterOptions.map((option) => option.textContent)).toEqual([
      '하츠네 미쿠',
    ])
    expect(characterOptions[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Escape}')

    await user.click(modelCombobox)
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'Street',
    ])
    expect(searchableOptions()[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Escape}')

    await user.click(animationCombobox)
    expect(animationCombobox).toHaveValue('ID')
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'idle',
    ])
    expect(modelSpy).toHaveBeenCalledTimes(2)
  })

  it.each([
    [
      'SKELETON_PARSE_FAILED',
      '원격 스켈레톤을 LiveSD 3.6 runtime으로 파싱하지 못했습니다.',
    ],
    [
      'PREVIEW_RENDER_FAILED',
      'LiveSD WebGL 미리보기의 첫 프레임을 렌더링하지 못했습니다.',
    ],
  ] as const)(
    '%s가 발생해도 기존 session과 두 dropdown 상태를 보존한다',
    async (code, message) => {
      const user = userEvent.setup()
      vi.spyOn(prskRemoteCatalogSource, 'load').mockResolvedValue(
        createRemoteCatalog(),
      )
      vi.spyOn(prskRemoteResourceSource, 'load')
        .mockResolvedValueOnce(createRemoteModel('sd_21miku_normal'))
        .mockResolvedValueOnce(createRemoteModel('sd_21miku_street'))
      const fixture = createSession(
        '3.6.53',
        'verified',
        ['pose_default', 'idle', 'walk'],
        'pose_default',
      )
      vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
        compatibility: 'verified',
        hash: 'remote-hash',
        version: '3.6.53',
      })
      vi.spyOn(liveSD36Adapter, 'createPreview')
        .mockResolvedValueOnce(fixture.session)
        .mockRejectedValueOnce(new LiveSDPreviewError(code, message))

      render(<App />)
      const characterCombobox = await loadCustomRemoteCatalog(user)
      await loadRemoteCharacterModel(user)
      await screen.findByRole('heading', { name: 'sd_21miku_normal' })
      const modelCombobox = remoteModelCombobox()

      const animationCombobox = screen.getByRole('combobox', {
        name: '애니메이션',
      })
      await user.click(animationCombobox)
      await user.type(animationCombobox, 'ID')
      await user.keyboard('{Escape}')
      await user.click(characterCombobox)
      await user.clear(characterCombobox)
      await user.type(characterCombobox, 'MIKU')
      await user.keyboard('{Escape}')
      await selectRemoteModel(user, 'Street')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(code)
      expect(screen.getByRole('heading', { name: 'sd_21miku_normal' })).toBeVisible()
      expect(fixture.dispose).not.toHaveBeenCalled()
      expect(fixture.unsubscribe).not.toHaveBeenCalled()
      expect(characterCombobox).toHaveValue('하츠네 미쿠')
      expect(modelCombobox).toHaveValue('Street')
      expect(animationCombobox).toHaveValue('pose_default')

      await user.click(characterCombobox)
      expect(characterCombobox).toHaveValue('MIKU')
      expect(searchableOptions()).toHaveLength(1)
      await user.keyboard('{Escape}')
      await user.click(animationCombobox)
      expect(animationCombobox).toHaveValue('ID')
      expect(searchableOptions().map((option) => option.textContent)).toEqual([
        'idle',
      ])
    },
  )

  it('성공한 원격 교체는 새 session이 ready일 때만 기존 session을 정리하고 animation query를 초기화한다', async () => {
    const user = userEvent.setup()
    vi.spyOn(prskRemoteCatalogSource, 'load').mockResolvedValue(
      createRemoteCatalog(),
    )
    vi.spyOn(prskRemoteResourceSource, 'load')
      .mockResolvedValueOnce(createRemoteModel('sd_21miku_normal'))
      .mockResolvedValueOnce(createRemoteModel('sd_21miku_street'))
    const first = createSession(
      '3.6.53',
      'verified',
      ['pose_default', 'idle', 'walk'],
      'pose_default',
    )
    const second = createSession(
      '3.6.53',
      'verified',
      ['pose_default', 'jump'],
      'pose_default',
    )
    const pendingSecond = createDeferred<LiveSDPreviewSession>()
    vi.spyOn(liveSD36Adapter, 'inspectSkeleton').mockReturnValue({
      compatibility: 'verified',
      hash: 'remote-hash',
      version: '3.6.53',
    })
    const createSpy = vi
      .spyOn(liveSD36Adapter, 'createPreview')
      .mockResolvedValueOnce(first.session)
      .mockReturnValueOnce(pendingSecond.promise)

    render(<App />)
    const characterCombobox = await loadCustomRemoteCatalog(user)
    await loadRemoteCharacterModel(user)
    await screen.findByRole('heading', { name: 'sd_21miku_normal' })
    const modelCombobox = remoteModelCombobox()

    const animationCombobox = screen.getByRole('combobox', {
      name: '애니메이션',
    })
    await user.click(animationCombobox)
    await user.type(animationCombobox, 'ID')
    await user.keyboard('{Escape}')
    await selectRemoteModel(user, 'Street')
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2))

    expect(first.dispose).not.toHaveBeenCalled()
    expect(first.unsubscribe).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'sd_21miku_normal' })).toBeVisible()
    expect(characterCombobox).toHaveValue('하츠네 미쿠')
    await user.click(modelCombobox)
    expect(modelCombobox).toHaveValue('Street')
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'Street',
    ])
    await user.keyboard('{Escape}')
    await user.click(animationCombobox)
    expect(animationCombobox).toHaveValue('ID')
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'idle',
    ])
    await user.keyboard('{Escape}')

    await act(async () => {
      pendingSecond.resolve(second.session)
      await pendingSecond.promise
    })

    expect(
      await screen.findByRole('heading', { name: 'sd_21miku_street' }),
    ).toBeVisible()
    expect(first.unsubscribe).toHaveBeenCalledTimes(1)
    expect(first.dispose).toHaveBeenCalledTimes(1)
    expect(characterCombobox).toHaveValue('하츠네 미쿠')
    expect(modelCombobox).toHaveValue('Street')
    expect(animationCombobox).toHaveValue('pose_default')
    await user.click(characterCombobox)
    expect(characterCombobox).toHaveValue('')
    expect(searchableOptions()).toHaveLength(2)
    await user.keyboard('{Escape}')
    await user.click(animationCombobox)
    expect(animationCombobox).toHaveValue('')
    expect(searchableOptions().map((option) => option.textContent)).toEqual([
      'pose_default',
      'jump',
    ])
  })

  it('unmount에서 활성 오류 구독과 session을 정리한다', async () => {
    const fixture = createSession()
    mockPreview([createBundle('unmount-source')], [fixture.session])
    const { container, unmount } = render(<App />)
    await uploadInputs(container)
    await screen.findByRole('heading', { name: 'unmount-source' })

    unmount()

    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1)
    expect(fixture.dispose).toHaveBeenCalledTimes(1)
  })
})
