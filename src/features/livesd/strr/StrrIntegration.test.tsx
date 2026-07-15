import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { recommendCodexPetMappings } from '../../codex-pet/animationMapping'
import { saveCodexPetSettingsPreset } from '../../codex-pet/settingsPresets'
import type {
  LiveSD36AdapterContract,
  LiveSDPreviewSession,
} from '../adapter'
import { StrrIntegration } from './StrrIntegration'
import { parseStrrCatalog } from './staticProvider'

const catalog = parseStrrCatalog({
  version: 1,
  gameId: 'strr',
  characters: [
    {
      id: '101',
      labels: { en: 'Karen Aijo', ko: '아이조 카렌' },
      editions: [
        {
          id: '1010001',
          labels: { en: 'Seisho Music Academy', ko: '세이쇼 음악학교' },
          metadataSource: 'karth',
          side: 'right',
        },
      ],
    },
    {
      id: '201',
      labels: { en: 'Tamao Tomoe', ko: '토모에 타마오' },
      editions: [{
        id: '2010001',
        labels: { en: 'Rinmeikan Girls School', ko: '린메이칸 여학교' },
        metadataSource: 'karth',
        side: 'right',
      }],
    },
    {
      id: '301',
      labels: { en: 'Aruru Otsuki', ko: '오츠키 아루루' },
      editions: [{
        id: '3010001',
        labels: { en: 'Frontier School of Arts', ko: '프론티어 예술학교' },
        metadataSource: 'karth',
        side: 'right',
      }],
    },
    {
      id: '401',
      labels: { en: 'Akira Yukishiro', ko: '유키시로 아키라' },
      editions: [{
        id: '4010001',
        labels: { en: 'Siegfeld Institute of Music', ko: '시크펠트 음악학원' },
        metadataSource: 'karth',
        side: 'right',
      }],
    },
    {
      id: '501',
      labels: { en: 'Koharu Yanagi', ko: '야나기 코하루' },
      editions: [{
        id: '5010001',
        labels: { en: 'Seiran General Arts Institute', ko: '세이란 종합예술원' },
        metadataSource: 'karth',
        side: 'right',
      }],
    },
    {
      id: '901',
      labels: { en: 'Sakura Shinguji', ko: '신구지 사쿠라' },
      editions: [{
        id: '9010001',
        labels: { en: 'Collaboration', ko: '컬래버레이션' },
        metadataSource: 'karth',
        side: 'right',
      }],
    },
  ],
})

function createSession(): LiveSDPreviewSession {
  return {
    animations: ['applause1', 'wait1', 'walk1', 'surprized1'],
    compatibility: 'experimental',
    currentAnimation: 'applause1',
    framingOffset: { x: 0, y: 0 },
    framingScale: 1,
    version: '3.6.52',
    dispose: vi.fn(),
    onError: vi.fn(() => () => undefined),
    play: vi.fn(),
    resize: vi.fn(),
    setAnimationMappings: vi.fn(),
    setFramingOffset: vi.fn(),
    setFramingScale: vi.fn(),
    setLookTarget: vi.fn(),
    setMirrorX: vi.fn(),
  }
}

describe('StrrIntegration', () => {
  it('캐릭터 selector를 공식 학교 section으로 나누고 alias로 검색한다', async () => {
    const user = userEvent.setup()
    const session = createSession()
    const adapter: LiveSD36AdapterContract = {
      inspectSkeleton: vi.fn(() => ({
        compatibility: 'experimental' as const,
        hash: 'fixture',
        version: '3.6.52',
      })),
      createPreview: vi.fn(async () => session),
    }
    const catalogLoader = vi.fn(async () => catalog)
    const modelLoader = vi.fn()

    render(
      <StrrIntegration
        adapter={adapter}
        catalogLoader={catalogLoader}
        modelLoader={modelLoader}
      />,
    )

    await user.click(screen.getByRole('button', {
      name: '캐릭터 목록 불러오기',
    }))
    const character = screen.getByRole('combobox', { name: '캐릭터 검색' })
    await waitFor(() => expect(character).toBeEnabled())
    await user.click(character)

    const listbox = screen.getByRole('listbox', { name: '캐릭터 검색' })
    expect(
      within(listbox).getAllByRole('group').map(
        (group) => group.querySelector(
          '.searchable-combobox__group-heading',
        )?.textContent,
      ),
    ).toEqual([
      '세이쇼 음악학교',
      '린메이칸 여학교',
      '프론티어 예술학교',
      '시크펠트 음악학원',
      '세이란 종합예술원',
      '기타',
    ])
    expect(
      within(listbox).getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      '아이조 카렌',
      '토모에 타마오',
      '오츠키 아루루',
      '유키시로 아키라',
      '야나기 코하루',
      '신구지 사쿠라',
    ])

    await user.type(character, 'seisho')
    expect(within(listbox).getAllByRole('group')).toHaveLength(1)
    expect(within(listbox).getByRole('option')).toHaveTextContent('아이조 카렌')
    expect(modelLoader).not.toHaveBeenCalled()
  })

  it('저장된 STRR source는 프리셋 불러오기 뒤에만 복원한다', async () => {
    const user = userEvent.setup()
    saveCodexPetSettingsPreset({
      description: 'STRR preset',
      displayName: 'Karen Preset',
      framingOffset: { x: 0, y: 0 },
      framingScale: 1,
      globalMirrorX: true,
      lookMovementScale: 1,
      mappings: recommendCodexPetMappings([
        'applause1',
        'wait1',
        'walk1',
        'surprized1',
      ]),
      source: {
        provider: 'strr-res-pak',
        characterId: '101',
        editionId: '1010001',
      },
    }, localStorage, 1, 'strr')
    const session = createSession()
    const adapter: LiveSD36AdapterContract = {
      inspectSkeleton: vi.fn(() => ({
        compatibility: 'experimental' as const,
        hash: 'fixture',
        version: '3.6.52',
      })),
      createPreview: vi.fn(async () => session),
    }
    const catalogLoader = vi.fn(async () => catalog)
    const modelLoader = vi.fn(async () => ({
      atlasBundle: {
        atlasPages: new Map([
          ['model_right.png', new Blob(['png'], { type: 'image/png' })],
        ]),
        atlasPath: 'model_right.atlas',
        atlasText: 'model_right.png\nsize: 1,1\n',
        sourceName: '101:1010001',
      },
      characterId: '101',
      editionId: '1010001',
      skeletonData: new Uint8Array([1, 2, 3]).buffer,
    }))

    render(
      <StrrIntegration
        adapter={adapter}
        catalogLoader={catalogLoader}
        modelLoader={modelLoader}
      />,
    )

    expect(screen.getByTestId('strr-resource-preset-selector')).toHaveValue(
      'Karen Preset',
    )
    expect(catalogLoader).not.toHaveBeenCalled()
    expect(modelLoader).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '새로 만들기' })).toBeEnabled()
    expect(screen.queryByRole('button', {
      name: '캐릭터 목록 불러오기',
    })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', {
      name: '프리셋 불러오기',
    }))

    await waitFor(() => {
      expect(screen.getByTestId('strr-render-evidence')).toHaveTextContent(
        '애니메이션 4개를 사용할 수 있습니다.',
      )
    })
    expect(catalogLoader).toHaveBeenCalledOnce()
    expect(modelLoader).toHaveBeenCalledWith(expect.objectContaining({
      characterId: '101',
      editionId: '1010001',
    }))
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      'Karen Preset',
    )
  })

  it('캐릭터→에디션 선택 뒤 render evidence를 표시한다', async () => {
    const user = userEvent.setup()
    const session = createSession()
    const adapter: LiveSD36AdapterContract = {
      inspectSkeleton: vi.fn(() => ({
        compatibility: 'experimental' as const,
        hash: 'fixture',
        version: '3.6.52',
      })),
      createPreview: vi.fn(async () => session),
    }
    const catalogLoader = vi.fn(async () => catalog)
    const modelLoader = vi.fn(async () => ({
      atlasBundle: {
        atlasPages: new Map([
          ['model_right.png', new Blob(['png'], { type: 'image/png' })],
        ]),
        atlasPath: 'model_right.atlas',
        atlasText: 'model_right.png\nsize: 1,1\n',
        sourceName: '101:1010001',
      },
      characterId: '101',
      editionId: '1010001',
      skeletonData: new Uint8Array([1, 2, 3]).buffer,
    }))

    render(
      <StrrIntegration
        adapter={adapter}
        catalogLoader={catalogLoader}
        modelLoader={modelLoader}
      />,
    )

    expect(screen.queryByText('STRR · 고정된 res-pak 미러')).not.toBeInTheDocument()
    expect(screen.queryByText(/표시 이름은 날짜가 고정된 Karth API 백업/)).not.toBeInTheDocument()
    expect(screen.queryByText(/실행 중 Karth/)).not.toBeInTheDocument()
    expect(screen.queryByText(/raw\.githubusercontent\.com/)).not.toBeInTheDocument()
    expect(
      screen.getByText('보관된 캐릭터 목록을 불러와 캐릭터와 에디션을 선택해주세요.'),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Codex Pet 만들기' }),
    ).toBeVisible()
    expect(screen.getByRole('button', {
      name: '프리셋 불러오기',
    })).toBeDisabled()
    expect(screen.getByRole('button', {
      name: '캐릭터 목록 불러오기',
    })).toBeEnabled()
    const framingScaleSlider = screen.getByRole('slider', {
      name: 'Pet 크기 슬라이더',
    })
    expect(framingScaleSlider).toBeDisabled()

    await user.click(screen.getByRole('button', {
      name: '캐릭터 목록 불러오기',
    }))
    const character = screen.getByRole('combobox', { name: '캐릭터 검색' })
    await user.click(character)
    await user.click(screen.getByRole('option', { name: '아이조 카렌' }))
    const edition = screen.getByRole('combobox', { name: '에디션 검색' })
    await user.click(edition)
    await user.click(screen.getByRole('option', {
      name: '세이쇼 음악학교 · 1010001',
    }))

    await waitFor(() => {
      expect(screen.getByTestId('strr-render-evidence')).toHaveTextContent(
        '애니메이션 4개를 사용할 수 있습니다.',
      )
    })
    expect(modelLoader).toHaveBeenCalledWith(expect.objectContaining({
      characterId: '101',
      editionId: '1010001',
    }))
    expect(adapter.createPreview).toHaveBeenCalledWith(
      expect.objectContaining({ lookRigFallback: 'static' }),
    )
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      '세이쇼 음악학교 - 아이조 카렌',
    )
    await waitFor(() => {
      expect(framingScaleSlider).toBeEnabled()
      expect(session.setAnimationMappings).toHaveBeenCalled()
      expect(session.setMirrorX).toHaveBeenLastCalledWith(true)
    })
    expect(session.setAnimationMappings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        idle: expect.objectContaining({ animationName: 'wait1' }),
        jumping: expect.objectContaining({ animationName: 'surprized1' }),
        running: expect.objectContaining({ animationName: 'walk1' }),
      }),
    )
    expect(
      screen.getByRole('checkbox', { name: '전체 캐릭터 수평 반전' }),
    ).toBeChecked()
    fireEvent.change(framingScaleSlider, { target: { value: '110' } })
    expect(session.setFramingScale).toHaveBeenCalledWith(1.1)

    const animation = screen.getByRole('combobox', { name: '애니메이션' })
    await user.click(animation)
    await user.click(screen.getByRole('option', { name: 'walk1' }))
    expect(session.play).toHaveBeenCalledWith('walk1')
    expect(session.setMirrorX).toHaveBeenLastCalledWith(true)
  })
})
