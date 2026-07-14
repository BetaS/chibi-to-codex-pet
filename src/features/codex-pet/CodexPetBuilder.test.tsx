import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { I18nProvider, LocaleSelector } from '../../i18n'
import type { LiveSDFrameSamplingInput } from '../livesd/export/types'
import { recommendCodexPetMappings } from './animationMapping'
import { CodexPetBuilder, type CodexPetBuilderServices } from './CodexPetBuilder'
import type { CodexPetManifest } from './manifest'
import {
  CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
  readCodexPetSettingsPresetCatalog,
  saveCodexPetSettingsPreset,
} from './settingsPresets'

const animations = [
  'w_happy_idle01_f',
  'w_normal_walk01_f',
  'w_cute_joy01_f',
  'w_happy_surprise01_f',
  'z_test_F_negi01',
  'w_happy_sad01_f',
  'w_happy_listen01_f',
  'w_happy_doubt01_f',
  'w_happy_doubt02_f',
] as const
const prskDefaultStateMirrorX = {
  'running-right': true,
  'running-left': false,
} as const

const source = {
  atlasBundle: {
    sourceName: 'sample_character.zip',
    atlasPath: 'nested/sekai_atlas.atlas',
    atlasText: 'atlas',
    atlasPages: new Map([['nested/page.png', new Blob(['png'])]]),
  },
  skeletonData: new Uint8Array([1, 2, 3]).buffer,
}

const manifest: CodexPetManifest = {
  id: 'test-pet',
  displayName: 'Test Pet',
  description: 'Browser package',
  spriteVersionNumber: 2,
  spritesheetPath: 'spritesheet.png',
}

function createServices(
  sampleImplementation?: (
    input: LiveSDFrameSamplingInput,
  ) => ReturnType<CodexPetBuilderServices['sample']>,
) {
  const packageBlob = new Blob(['zip'], { type: 'application/zip' })
  const spritesheet = new Blob(['png'], { type: 'image/png' })
  const sample = vi.fn(
    sampleImplementation ??
      (async (input: LiveSDFrameSamplingInput) => {
        input.onProgress?.({
          phase: 'rendering',
          completedSteps: 120,
          totalSteps: 131,
          fraction: 120 / 131,
          lookDirectionIndex: 4,
        })
        return {
          atlasPng: spritesheet,
          width: 1536,
          height: 2288,
          frameCount: 73,
        }
      }),
  )
  const exportPackage = vi.fn(async () => ({
    blob: packageBlob,
    filename: 'test-pet.codex-pet.zip',
    manifest,
  }))
  const validatePackage = vi.fn(async () => ({
    id: manifest.id,
    manifest,
    spritesheet,
    spritesheetBytes: new Uint8Array([1, 2, 3]),
  }))
  const createObjectUrl = vi
    .fn<(blob: Blob) => string>()
    .mockReturnValueOnce('blob:test-package')
    .mockReturnValueOnce('blob:test-spritesheet')
  const revokeObjectUrl = vi.fn()
  const trackDownload = vi.fn()
  const copyText = vi.fn(async () => undefined)

  return {
    packageBlob,
    services: {
      copyText,
      sample,
      exportPackage,
      validatePackage,
      createObjectUrl,
      revokeObjectUrl,
      trackDownload,
    } satisfies CodexPetBuilderServices,
  }
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

describe('CodexPetBuilder', () => {
  it('source별 기본 animation이 실제 목록에 있을 때만 초기 mapping을 덮어쓴다', async () => {
    const onMappingsChange = vi.fn()
    render(
      <CodexPetBuilder
        animations={['fallback-idle', 'Wait1', 'walk1', 'surprized1']}
        defaultStateAnimationNames={{
          idle: 'wait1',
          jumping: 'surprized1',
          review: 'missing-animation',
          running: 'walk1',
        }}
        framingScale={1}
        onMappingsChange={onMappingsChange}
        source={source}
      />,
    )

    await waitFor(() =>
      expect(onMappingsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          idle: expect.objectContaining({ animationName: 'Wait1' }),
          jumping: expect.objectContaining({ animationName: 'surprized1' }),
          review: expect.not.objectContaining({
            animationName: 'missing-animation',
          }),
          running: expect.objectContaining({ animationName: 'walk1' }),
        }),
      ),
    )
  })

  it('source 기본 이름을 표시하고 static look fallback을 sampler에 전달한다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    render(
      <CodexPetBuilder
        animations={animations}
        framingScale={1}
        services={services}
        source={{
          ...source,
          defaultDisplayName: '태양 나라의 기사 - 다이바 나나',
          lookRigFallback: 'static',
        }}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      '태양 나라의 기사 - 다이바 나나',
    )
    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))
    await screen.findByRole('link', { name: 'Codex Pet ZIP 다운로드' })
    expect(services.sample).toHaveBeenCalledWith(
      expect.objectContaining({ lookRigFallback: 'static' }),
    )
  })

  it('완성된 package에서 locale을 바꿔도 mapping, metadata, slider와 object URL을 보존한다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    render(
      <I18nProvider initialLocale="ko" storage={null}>
        <LocaleSelector />
        <CodexPetBuilder
          animations={animations}
          defaultStateMirrorX={prskDefaultStateMirrorX}
          framingScale={1}
          services={services}
          source={source}
        />
      </I18nProvider>,
    )

    await chooseSearchableOption(
      user,
      '인사 애니메이션',
      'w_happy_idle01_f',
    )
    fireEvent.change(screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    }), { target: { value: '125' } })
    const nameInput = screen.getByRole('textbox', { name: 'Pet 이름' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Locale Pet')
    await user.type(
      screen.getByRole('textbox', { name: 'Pet 설명' }),
      'User-authored metadata',
    )
    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))
    const koreanDownload = await screen.findByRole('link', {
      name: 'Codex Pet ZIP 다운로드',
    })
    const packageUrl = koreanDownload.getAttribute('href')

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByRole('heading', {
      name: 'Create a Codex Pet',
    })).toBeVisible()
    expect(screen.getByRole('combobox', {
      name: 'Wave animation',
    })).toHaveValue('w_happy_idle01_f')
    expect(screen.getByRole('slider', {
      name: 'Eye movement slider',
    })).toHaveValue('125')
    expect(screen.getByRole('textbox', { name: 'Pet name' })).toHaveValue(
      'Locale Pet',
    )
    expect(screen.getByRole('textbox', {
      name: 'Pet description',
    })).toHaveValue('User-authored metadata')
    expect(screen.getByRole('link', {
      name: 'Download Codex Pet ZIP',
    })).toHaveAttribute('href', packageUrl)
    expect(screen.getByRole('combobox', {
      name: 'Installed preview state',
    })).toBeVisible()
    expect(services.sample).toHaveBeenCalledTimes(1)
    expect(services.revokeObjectUrl).not.toHaveBeenCalled()
  })

  it('상태 combobox focus·변경과 눈 이동량을 Spine preview callback에 전달한다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    const onPreviewAnimationChange = vi.fn()
    const onPreviewLookMovementScaleChange = vi.fn()
    const onMappingsChange = vi.fn()
    const onGlobalMirrorXChange = vi.fn()
    render(
      <CodexPetBuilder
        animations={animations}
        defaultStateMirrorX={prskDefaultStateMirrorX}
        framingScale={1}
        onGlobalMirrorXChange={onGlobalMirrorXChange}
        onMappingsChange={onMappingsChange}
        onPreviewAnimationChange={onPreviewAnimationChange}
        onPreviewLookMovementScaleChange={
          onPreviewLookMovementScaleChange
        }
        services={services}
        source={source}
      />,
    )

    await waitFor(() =>
      expect(onPreviewLookMovementScaleChange).toHaveBeenCalledWith(1),
    )
    await waitFor(() =>
      expect(onGlobalMirrorXChange).toHaveBeenLastCalledWith(false),
    )
    await waitFor(() =>
      expect(onMappingsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          idle: expect.objectContaining({
            animationName: 'w_happy_idle01_f',
          }),
        }),
      ),
    )
    const idleMapping = screen.getByRole('combobox', {
      name: '대기 애니메이션',
    })
    fireEvent.focus(idleMapping)
    expect(onPreviewAnimationChange).toHaveBeenLastCalledWith(
      'w_happy_idle01_f',
      'idle',
      false,
    )

    await user.clear(idleMapping)
    await user.type(idleMapping, 'w_normal_walk01_f')
    await user.click(screen.getByRole('option', {
      name: 'w_normal_walk01_f',
    }))
    expect(onPreviewAnimationChange).toHaveBeenLastCalledWith(
      'w_normal_walk01_f',
      'idle',
      false,
    )

    await user.click(screen.getByRole('checkbox', {
      name: '오른쪽 이동 수평 반전',
    }))
    expect(onPreviewAnimationChange).toHaveBeenLastCalledWith(
      'w_normal_walk01_f',
      'running-right',
      false,
    )

    await user.click(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    }))
    await waitFor(() =>
      expect(onGlobalMirrorXChange).toHaveBeenLastCalledWith(true),
    )
    await waitFor(() =>
      expect(onMappingsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          idle: expect.objectContaining({
            animationName: 'w_normal_walk01_f',
          }),
        }),
      ),
    )

    fireEvent.change(screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    }), { target: { value: '135' } })
    expect(onPreviewLookMovementScaleChange).toHaveBeenLastCalledWith(1.35)
  })

  it('상태 animation을 대소문자 없이 검색하고 확정 전에는 mapping을 변경하지 않는다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    const onMappingsChange = vi.fn()
    const onPreviewAnimationChange = vi.fn()
    render(
      <CodexPetBuilder
        animations={animations}
        defaultStateMirrorX={prskDefaultStateMirrorX}
        framingScale={1}
        onMappingsChange={onMappingsChange}
        onPreviewAnimationChange={onPreviewAnimationChange}
        services={services}
        source={source}
      />,
    )

    await waitFor(() => expect(onMappingsChange).toHaveBeenCalled())
    const mappingCallsBeforeSearch = onMappingsChange.mock.calls.length
    const idleCombobox = screen.getByRole('combobox', {
      name: '대기 애니메이션',
    })
    await user.click(idleCombobox)
    await user.type(idleCombobox, 'NORMAL_WALK')

    expect(
      within(screen.getByRole('listbox')).getAllByRole('option'),
    ).toHaveLength(1)
    expect(screen.getByRole('option', {
      name: 'w_normal_walk01_f',
    })).toBeVisible()
    expect(onMappingsChange).toHaveBeenCalledTimes(mappingCallsBeforeSearch)
    expect(onPreviewAnimationChange).toHaveBeenLastCalledWith(
      'w_happy_idle01_f',
      'idle',
      false,
    )

    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(onMappingsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          idle: {
            animationName: 'w_normal_walk01_f',
            mirrorX: false,
          },
        }),
      ),
    )
    expect(idleCombobox).toHaveValue('w_normal_walk01_f')
    expect(onPreviewAnimationChange).toHaveBeenLastCalledWith(
      'w_normal_walk01_f',
      'idle',
      false,
    )
  })

  it('검증된 build 설정을 이름 preset으로 저장하고 다음 source-ready session에 복원한다', async () => {
    const user = userEvent.setup()
    const firstServices = createServices().services
    const firstRender = render(
      <CodexPetBuilder
        animations={animations}
        defaultStateMirrorX={prskDefaultStateMirrorX}
        framingOffset={{ x: 9, y: -4 }}
        framingScale={1.25}
        recipeSource={{
          provider: 'prsk-chibi-viewer',
          characterId: 'sd_21miku_normal',
        }}
        services={firstServices}
        source={source}
      />,
    )

    await user.click(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    }))
    fireEvent.change(screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    }), { target: { value: '125' } })
    await chooseSearchableOption(
      user,
      '인사 애니메이션',
      'w_happy_idle01_f',
    )
    const nameInput = screen.getByRole('textbox', { name: 'Pet 이름' })
    await user.clear(nameInput)
    await user.type(nameInput, '  Miku Preset  ')
    await user.type(
      screen.getByRole('textbox', { name: 'Pet 설명' }),
      'Saved locally',
    )
    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))
    await screen.findByRole('link', { name: 'Codex Pet ZIP 다운로드' })

    const installCommand = screen.getByRole('textbox', {
      name: 'npx 설치 명령',
    })
    expect((installCommand as HTMLTextAreaElement).value).toMatch(
      /^npx -y chibi-to-codex-pet install --recipe /,
    )
    await user.click(screen.getByRole('button', {
      name: 'CLI 바로가기 복사',
    }))
    expect(firstServices.copyText).toHaveBeenCalledWith(
      (installCommand as HTMLTextAreaElement).value,
    )
    expect(screen.getByText('CLI 바로가기를 복사했습니다.')).toBeVisible()

    expect(screen.getByRole('combobox', { name: '저장 프리셋' })).toHaveValue(
      'Miku Preset',
    )
    const stored = localStorage.getItem(
      CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
    )
    expect(stored).not.toContain('sample_character.zip')
    expect(stored).not.toContain('blob:test-package')
    expect(
      readCodexPetSettingsPresetCatalog(localStorage)
        .presets['Miku Preset']?.source,
    ).toEqual({
      provider: 'prsk-chibi-viewer',
      characterId: 'sd_21miku_normal',
    })
    firstRender.unmount()

    const onFramingChange = vi.fn()
    const onPreviewAnimationChange = vi.fn()
    const secondServices = createServices().services
    const secondRender = render(
      <CodexPetBuilder
        animations={[]}
        defaultStateMirrorX={prskDefaultStateMirrorX}
        framingScale={1}
        onFramingChange={onFramingChange}
        onPreviewAnimationChange={onPreviewAnimationChange}
        services={secondServices}
        source={null}
      />,
    )

    expect(screen.getByRole('combobox', { name: '저장 프리셋' })).toHaveValue(
      'Miku Preset',
    )
    expect(secondServices.sample).not.toHaveBeenCalled()
    secondRender.rerender(
      <CodexPetBuilder
        animations={animations}
        defaultStateMirrorX={prskDefaultStateMirrorX}
        framingScale={1}
        onFramingChange={onFramingChange}
        onPreviewAnimationChange={onPreviewAnimationChange}
        services={secondServices}
        source={source}
      />,
    )

    expect(await screen.findByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      'Miku Preset',
    )
    expect(screen.getByRole('textbox', { name: 'Pet 설명' })).toHaveValue(
      'Saved locally',
    )
    expect(screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    })).toHaveValue('125')
    expect(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    })).toBeChecked()
    expect(screen.getByRole('combobox', {
      name: '인사 애니메이션',
    })).toHaveValue('w_happy_idle01_f')
    await waitFor(() =>
      expect(onFramingChange).toHaveBeenCalledWith(1.25, { x: 9, y: -4 }),
    )
    expect(secondServices.sample).not.toHaveBeenCalled()
  })

  it('CLI 바로가기 복사 실패 시 명령과 ZIP을 유지하고 수동 복사를 안내한다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    services.copyText.mockRejectedValueOnce(new DOMException('denied'))
    render(
      <CodexPetBuilder
        animations={animations}
        framingScale={1}
        recipeSource={{
          provider: 'prsk-chibi-viewer',
          characterId: 'sd_21miku_normal',
        }}
        services={services}
        source={source}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))
    await screen.findByRole('link', { name: 'Codex Pet ZIP 다운로드' })
    await user.click(screen.getByRole('button', {
      name: 'CLI 바로가기 복사',
    }))

    expect(screen.getByRole('textbox', { name: 'npx 설치 명령' })).toBeVisible()
    expect(screen.getByRole('link', {
      name: 'Codex Pet ZIP 다운로드',
    })).toBeVisible()
    expect(screen.getByText(
      'CLI 바로가기를 복사하지 못했습니다. 명령을 직접 복사하세요.',
    )).toBeVisible()
  })

  it('Garupa pinned 식별자는 preset에 저장하되 지원하지 않는 CLI 명령은 만들지 않는다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    render(
      <CodexPetBuilder
        animations={animations}
        framingScale={1}
        presetRuntime="garupa"
        presetSource={{
          provider: 'garupa-pinned',
          sdAssetBundleName: '00001_2023',
        }}
        services={services}
        source={source}
      />,
    )

    const displayName = screen.getByRole('textbox', { name: 'Pet 이름' })
    await user.clear(displayName)
    await user.type(displayName, '토야마 카스미')
    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))
    await screen.findByRole('link', { name: 'Codex Pet ZIP 다운로드' })

    expect(
      readCodexPetSettingsPresetCatalog(localStorage, 'garupa')
        .presets['토야마 카스미']?.source,
    ).toEqual({
      provider: 'garupa-pinned',
      sdAssetBundleName: '00001_2023',
    })
    expect(screen.queryByRole('textbox', {
      name: 'npx 설치 명령',
    })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {
      name: 'CLI 바로가기 복사',
    })).not.toBeInTheDocument()
  })

  it('preset dropdown으로 설정을 전환하고 새 세션에서 catalog를 보존한 채 reset한다', async () => {
    const mikuMappings = recommendCodexPetMappings(animations)
    mikuMappings.waving = {
      animationName: 'w_happy_idle01_f',
      mirrorX: false,
    }
    saveCodexPetSettingsPreset({
      description: 'Miku settings',
      displayName: 'Miku',
      framingOffset: { x: 8, y: 3 },
      framingScale: 1.2,
      globalMirrorX: true,
      lookMovementScale: 1.4,
      mappings: mikuMappings,
    }, localStorage, 1)
    saveCodexPetSettingsPreset({
      description: 'Airi settings',
      displayName: 'Airi',
      framingOffset: { x: -2, y: 5 },
      framingScale: 0.9,
      globalMirrorX: false,
      lookMovementScale: 0.8,
      mappings: recommendCodexPetMappings(animations),
    }, localStorage, 2)
    const user = userEvent.setup()
    const onFramingChange = vi.fn()
    render(
      <CodexPetBuilder
        animations={animations}
        defaultStateMirrorX={prskDefaultStateMirrorX}
        framingScale={1}
        onFramingChange={onFramingChange}
        source={source}
      />,
    )

    const presetSelector = screen.getByRole('combobox', {
      name: '저장 프리셋',
    })
    expect(presetSelector).toHaveValue('Airi')
    await user.selectOptions(presetSelector, 'Miku')
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      'Miku',
    )
    expect(screen.getByRole('combobox', {
      name: '인사 애니메이션',
    })).toHaveValue('w_happy_idle01_f')

    const wavingCombobox = screen.getByRole('combobox', {
      name: '인사 애니메이션',
    })
    await user.click(wavingCombobox)
    await user.type(wavingCombobox, 'normal')
    expect(wavingCombobox).toHaveValue('normal')

    await user.selectOptions(presetSelector, '')
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Pet 설명' })).toHaveValue('')
    expect(screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    })).toHaveValue('100')
    expect(screen.getByRole('checkbox', {
      name: '전체 캐릭터 수평 반전',
    })).not.toBeChecked()
    expect(wavingCombobox).toHaveValue('w_cute_joy01_f')
    expect(screen.getByRole('option', { name: 'Miku' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Airi' })).toBeInTheDocument()
    expect(readCodexPetSettingsPresetCatalog(localStorage).activePresetName)
      .toBeNull()
    expect(onFramingChange).toHaveBeenLastCalledWith(1, { x: 0, y: 0 })
  })

  it('ready source의 9개 추천을 표시하고 override와 source 교체를 반영한다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    const onMappingsChange = vi.fn()
    const { rerender } = render(
      <CodexPetBuilder
        animations={animations}
        defaultStateMirrorX={prskDefaultStateMirrorX}
        framingScale={1}
        onMappingsChange={onMappingsChange}
        services={services}
        source={source}
      />,
    )

    expect(screen.queryByText('v2 · 73 frames · 1536×2288')).not.toBeInTheDocument()
    expect(
      screen.getByText('애니메이션을 설정하고 설치할 Codex Pet을 만들어보세요.'),
    ).toBeVisible()

    const lookMovementSlider = screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    })
    expect(lookMovementSlider).toHaveValue('100')
    expect(lookMovementSlider).toHaveAttribute('aria-valuetext', '100%')
    fireEvent.change(lookMovementSlider, { target: { value: '150' } })
    expect(lookMovementSlider).toHaveValue('150')
    await user.click(screen.getByRole('button', { name: '100%로 초기화' }))
    expect(lookMovementSlider).toHaveValue('100')

    expect(
      screen.getByRole('combobox', { name: '대기 애니메이션' }),
    ).toHaveValue('w_happy_idle01_f')
    expect(
      screen.getByRole('combobox', { name: '왼쪽 이동 애니메이션' }),
    ).toHaveValue('w_normal_walk01_f')
    expect(
      screen.getByRole('checkbox', { name: '전체 캐릭터 수평 반전' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: '오른쪽 이동 수평 반전' }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: '왼쪽 이동 수평 반전' }),
    ).not.toBeChecked()

    await user.click(
      screen.getByRole('checkbox', { name: '오른쪽 이동 수평 반전' }),
    )
    await user.click(
      screen.getByRole('checkbox', { name: '전체 캐릭터 수평 반전' }),
    )
    expect(
      screen.getByRole('checkbox', { name: '전체 캐릭터 수평 반전' }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: '오른쪽 이동 수평 반전' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: '왼쪽 이동 수평 반전' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('combobox', { name: '마우스 오버 애니메이션' }),
    ).toHaveValue('z_test_F_negi01')

    await chooseSearchableOption(
      user,
      '인사 애니메이션',
      'w_happy_idle01_f',
    )
    expect(
      screen.getByRole('combobox', { name: '인사 애니메이션' }),
    ).toHaveValue('w_happy_idle01_f')

    rerender(
      <CodexPetBuilder
        animations={['pose_default', 'walk']}
        defaultStateMirrorX={prskDefaultStateMirrorX}
        framingScale={1}
        onMappingsChange={onMappingsChange}
        services={services}
        source={{
          ...source,
          atlasBundle: {
            ...source.atlasBundle,
            sourceName: 'replacement.zip',
          },
        }}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
        'replacement',
      ),
    )
    await waitFor(() =>
      expect(onMappingsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          idle: expect.objectContaining({ animationName: 'pose_default' }),
        }),
      ),
    )
    expect(onMappingsChange).toHaveBeenCalledWith(null)
    expect(
      screen.getByRole('combobox', { name: '인사 애니메이션' }),
    ).toHaveValue('pose_default')
    expect(
      screen.getByRole('checkbox', { name: '전체 캐릭터 수평 반전' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: '오른쪽 이동 수평 반전' }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: '왼쪽 이동 수평 반전' }),
    ).not.toBeChecked()
  })

  it('override된 mapping을 샘플링하고 재검증한 ZIP과 installed preview를 제공한다', async () => {
    const user = userEvent.setup()
    const { packageBlob, services } = createServices()
    render(
      <CodexPetBuilder
        animations={animations}
        defaultGlobalMirrorX
        framingOffset={{ x: 12, y: 8 }}
        framingScale={0.86}
        services={services}
        source={source}
      />,
    )

    await chooseSearchableOption(
      user,
      '인사 애니메이션',
      'w_happy_idle01_f',
    )
    await user.clear(screen.getByRole('textbox', { name: 'Pet 이름' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Pet 이름' }),
      'Test Pet',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Pet 설명' }),
      'Browser package',
    )
    const lookMovementSlider = screen.getByRole('slider', {
      name: '눈 이동량 슬라이더',
    })
    fireEvent.change(lookMovementSlider, { target: { value: '130' } })
    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))

    const download = await screen.findByRole('link', {
      name: 'Codex Pet ZIP 다운로드',
    })
    expect(download).toHaveAttribute('href', 'blob:test-package')
    expect(download).toHaveAttribute('download', 'test-pet.codex-pet.zip')
    expect(services.trackDownload).not.toHaveBeenCalled()
    download.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(download)
    expect(services.trackDownload).toHaveBeenCalledTimes(1)
    const starPrompt = screen.getByRole('dialog', {
      name: '만든 Pet이 마음에 드셨나요?',
    })
    expect(starPrompt).toHaveAttribute('aria-modal', 'true')
    const repositoryLink = within(starPrompt).getByRole('link', {
      name: 'GitHub에서 Star',
    })
    expect(repositoryLink).toHaveAttribute(
      'href',
      'https://github.com/BetaS/chibi-to-codex-pet',
    )
    expect(repositoryLink).toHaveAttribute('target', '_blank')
    expect(repositoryLink).toHaveAttribute('rel', 'noreferrer')
    expect(repositoryLink).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(download).toHaveFocus()

    fireEvent.click(download)
    expect(services.trackDownload).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(services.validatePackage).toHaveBeenCalledWith(packageBlob, {
      allowEdgeClipping: true,
    })
    expect(services.sample).toHaveBeenCalledWith(
      expect.objectContaining({
        atlasBundle: source.atlasBundle,
        framingOffset: { x: 12, y: 8 },
        framingScale: 0.86,
        globalMirrorX: true,
        lookMovementScale: 1.3,
        skeletonData: source.skeletonData,
        mappings: expect.objectContaining({
          waving: {
            animationName: 'w_happy_idle01_f',
            mirrorX: false,
          },
        }),
        signal: expect.any(AbortSignal),
        onProgress: expect.any(Function),
      }),
    )
    expect(
      screen.getByRole('img', { name: /Test Pet Codex Pet/ }),
    ).toHaveStyle({ backgroundImage: 'url(blob:test-spritesheet)' })
    expect(
      screen.getByRole('img', { name: /Test Pet Codex Pet/ }),
    ).toHaveAttribute('data-sprite-version', '2')
    expect(
      screen.getByRole('combobox', { name: '설치 미리보기 상태' }),
    ).toBeInTheDocument()

    fireEvent.change(lookMovementSlider, { target: { value: '150' } })
    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'Codex Pet ZIP 다운로드' }),
      ).not.toBeInTheDocument(),
    )
    expect(services.revokeObjectUrl).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('textbox', { name: 'Pet 이름' })).toHaveValue(
      'Test Pet',
    )
    expect(lookMovementSlider).toHaveAttribute('aria-valuetext', '150%')
  })

  it('완료된 package를 X/Y offset 변경 시 폐기하고 편집 입력은 보존한다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    const { rerender } = render(
      <CodexPetBuilder
        animations={animations}
        framingOffset={{ x: 0, y: 0 }}
        framingScale={1}
        services={services}
        source={source}
      />,
    )

    const nameInput = screen.getByRole('textbox', { name: 'Pet 이름' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Scaled Pet')
    await user.type(
      screen.getByRole('textbox', { name: 'Pet 설명' }),
      'Keep this description',
    )
    await chooseSearchableOption(
      user,
      '인사 애니메이션',
      'w_happy_idle01_f',
    )
    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))
    await screen.findByRole('link', { name: 'Codex Pet ZIP 다운로드' })

    rerender(
      <CodexPetBuilder
        animations={animations}
        framingOffset={{ x: 12, y: 8 }}
        framingScale={1}
        services={services}
        source={source}
      />,
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'Codex Pet ZIP 다운로드' }),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('img', { name: /Scaled Pet Codex Pet/ }),
    ).not.toBeInTheDocument()
    expect(services.revokeObjectUrl).toHaveBeenCalledTimes(2)
    expect(services.revokeObjectUrl).toHaveBeenCalledWith('blob:test-package')
    expect(services.revokeObjectUrl).toHaveBeenCalledWith(
      'blob:test-spritesheet',
    )
    expect(nameInput).toHaveValue('Scaled Pet')
    expect(screen.getByRole('textbox', { name: 'Pet 설명' })).toHaveValue(
      'Keep this description',
    )
    expect(
      screen.getByRole('combobox', { name: '인사 애니메이션' }),
    ).toHaveValue('w_happy_idle01_f')
    expect(
      screen.getByText('애니메이션과 Pet 정보를 확인해주세요.'),
    ).toBeInTheDocument()
  })

  it('진행 중 framing 변경을 abort하고 늦은 결과를 무시하면서 입력을 보존한다', async () => {
    const user = userEvent.setup()
    let pendingInput: LiveSDFrameSamplingInput | undefined
    let finishSampling: (() => void) | undefined
    const { services } = createServices(
      (input) =>
        new Promise((resolve) => {
          pendingInput = input
          finishSampling = () => {
            resolve({
              atlasPng: new Blob(['png'], { type: 'image/png' }),
              width: 1536,
              height: 2288,
              frameCount: 73,
            })
          }
        }),
    )
    const { rerender } = render(
      <CodexPetBuilder
        animations={animations}
        framingOffset={{ x: 0, y: 0 }}
        framingScale={1}
        services={services}
        source={source}
      />,
    )

    const nameInput = screen.getByRole('textbox', { name: 'Pet 이름' })
    await user.clear(nameInput)
    await user.type(nameInput, 'In-flight Pet')
    await user.type(
      screen.getByRole('textbox', { name: 'Pet 설명' }),
      'Preserved while aborting',
    )
    await chooseSearchableOption(
      user,
      '인사 애니메이션',
      'w_happy_idle01_f',
    )
    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))
    expect(pendingInput?.framingScale).toBe(1)
    expect(pendingInput?.framingOffset).toEqual({ x: 0, y: 0 })
    expect(pendingInput?.signal?.aborted).toBe(false)

    rerender(
      <CodexPetBuilder
        animations={animations}
        framingOffset={{ x: -12, y: 8 }}
        framingScale={1}
        services={services}
        source={source}
      />,
    )

    await waitFor(() => expect(pendingInput?.signal?.aborted).toBe(true))
    expect(nameInput).toHaveValue('In-flight Pet')
    expect(screen.getByRole('textbox', { name: 'Pet 설명' })).toHaveValue(
      'Preserved while aborting',
    )
    expect(
      screen.getByRole('combobox', { name: '인사 애니메이션' }),
    ).toHaveValue('w_happy_idle01_f')
    expect(
      screen.getByText('애니메이션과 Pet 정보를 확인해주세요.'),
    ).toBeInTheDocument()

    await act(async () => {
      finishSampling?.()
      await Promise.resolve()
    })
    expect(services.exportPackage).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('link', { name: 'Codex Pet ZIP 다운로드' }),
    ).not.toBeInTheDocument()
  })

  it('73-frame v2 sampling 진행률과 look direction을 표시한다', async () => {
    const user = userEvent.setup()
    let finishSampling: (() => void) | undefined
    const { services } = createServices(
      (input) =>
        new Promise((resolve) => {
          input.onProgress?.({
            phase: 'rendering',
            completedSteps: 120,
            totalSteps: 131,
            fraction: 120 / 131,
            lookDirectionIndex: 4,
          })
          finishSampling = () => {
            resolve({
              atlasPng: new Blob(['png'], { type: 'image/png' }),
              width: 1536,
              height: 2288,
              frameCount: 73,
            })
          }
        }),
    )
    render(
      <CodexPetBuilder
        animations={animations}
        framingScale={1}
        services={services}
        source={source}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))

    expect(
      await screen.findByText('Pet 애니메이션을 만드는 중입니다…'),
    ).toBeInTheDocument()
    expect(screen.getByText('120/131 · look 5/16')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'value',
      String(120 / 131),
    )

    finishSampling?.()
    expect(
      await screen.findByRole('link', { name: 'Codex Pet ZIP 다운로드' }),
    ).toBeInTheDocument()
  })

  it('진행 중 생성을 취소하고 source 교체 시 작업과 object URL을 정리한다', async () => {
    const user = userEvent.setup()
    let rejectSample: ((reason: Error) => void) | undefined
    const { services } = createServices(
      (input) =>
        new Promise((_, reject) => {
          rejectSample = reject
          input.signal?.addEventListener(
            'abort',
            () => {
              const error = Object.assign(new Error('cancelled'), {
                code: 'ABORTED',
              })
              reject(error)
            },
            { once: true },
          )
        }),
    )
    const { rerender } = render(
      <CodexPetBuilder
        animations={animations}
        framingScale={1}
        services={services}
        source={source}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))
    await user.click(screen.getByRole('button', { name: '생성 취소' }))
    expect(screen.getByText('생성을 취소했습니다.')).toBeInTheDocument()
    expect(rejectSample).toBeDefined()

    rerender(
      <CodexPetBuilder
        animations={animations}
        framingScale={1}
        services={services}
        source={{ ...source, skeletonData: new Uint8Array([9]).buffer }}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('애니메이션과 Pet 정보를 확인해주세요.')).toBeInTheDocument(),
    )
    expect(services.createObjectUrl).not.toHaveBeenCalled()
  })

  it('package 재검증 오류를 stable code와 접근 가능한 alert로 표시한다', async () => {
    const user = userEvent.setup()
    const { services } = createServices()
    services.validatePackage.mockRejectedValueOnce(
      Object.assign(new Error('사용 frame이 비어 있습니다.'), {
        code: 'PNG_CELL_EMPTY',
      }),
    )
    render(
      <CodexPetBuilder
        animations={animations}
        framingScale={1}
        services={services}
        source={source}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Codex Pet 생성' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('PNG_CELL_EMPTY')
    expect(alert).toHaveTextContent('Pet 이미지를 만들지 못했습니다.')
    expect(
      screen.queryByRole('link', { name: 'Codex Pet ZIP 다운로드' }),
    ).not.toBeInTheDocument()
    expect(
      localStorage.getItem(CODEX_PET_SETTINGS_PRESET_STORAGE_KEY),
    ).toBeNull()
  })
})
