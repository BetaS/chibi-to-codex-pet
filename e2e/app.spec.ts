import { expect, test } from '@playwright/test'

import { CODEX_PET_SETTINGS_PRESET_STORAGE_KEY } from '../src/features/codex-pet/settingsPresets'

const PRESET_MAPPINGS = Object.fromEntries(
  [
    'idle',
    'running-right',
    'running-left',
    'waving',
    'jumping',
    'failed',
    'waiting',
    'running',
    'review',
  ].map((stateId) => [
    stateId,
    { animationName: 'pose_default', mirrorX: stateId === 'running-right' },
  ]),
)

function storedPreset(displayName: string, updatedAt: number) {
  return {
    description: `${displayName} settings`,
    displayName,
    framingOffset: { x: 0, y: 0 },
    framingScale: 1,
    globalMirrorX: false,
    lookMovementScale: 1,
    mappings: PRESET_MAPPINGS,
    source: null,
    updatedAt,
  }
}

test('desktop Chromium에서 초기 앱 shell을 표시한다', async ({ page }) => {
  const providerRequests: string[] = []
  page.on('request', (request) => {
    if (/prsk-chibi-viewer|assets\.pjsek|custom-prsk/u.test(request.url())) {
      providerRequests.push(request.url())
    }
  })
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'LiveSD Pet Builder',
    }),
  ).toBeVisible()
  await expect(page.getByRole('tab', { name: '프로세카' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const strrTab = page.getByRole('tab', { name: '레뷰 스타라이트' })
  const garupaTab = page.getByRole('tab', { name: 'BanG Dream!' })
  await expect(strrTab).toBeEnabled()
  await expect(garupaTab).toBeEnabled()
  await expect(
    page.getByRole('button', { name: '불러오기', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.status-card')).toBeVisible()
  await expect(page.getByLabel('LiveSD WebGL 미리보기')).not.toBeVisible()
  await expect(page.getByText('아직 표시할 캐릭터가 없습니다.')).toBeVisible()
  expect(providerRequests).toEqual([])

  const [
    controlBox,
    previewBox,
    previewStageBox,
    builderBox,
  ] = await Promise.all([
    page.locator('.control-panel').boundingBox(),
    page.locator('.preview-panel').boundingBox(),
    page.locator('.preview-stage').boundingBox(),
    page.locator('.codex-pet-builder').boundingBox(),
  ])
  expect(controlBox).not.toBeNull()
  expect(previewBox).not.toBeNull()
  expect(previewStageBox).not.toBeNull()
  expect(builderBox).not.toBeNull()
  expect(previewBox!.width).toBeLessThanOrEqual(768)
  expect(previewBox!.height).toBeGreaterThanOrEqual(528)
  expect(previewBox!.height).toBeLessThanOrEqual(576)
  expect(previewBox!.x + previewBox!.width / 2).toBeCloseTo(
    builderBox!.x + builderBox!.width / 2,
    0,
  )
  await expect(page.getByTestId('livesd-preview-border-box')).not.toBeVisible()
  expect(controlBox!.x).toBeLessThan(previewBox!.x)
  expect(builderBox!.y).toBeGreaterThan(previewBox!.y)

  await strrTab.click()
  await expect(strrTab).toHaveAttribute('aria-selected', 'true')
  expect(providerRequests).toEqual([])

  await garupaTab.click()
  await expect(garupaTab).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: '프로세카' }).click()
  await expect(page.getByRole('tab', { name: '프로세카' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(providerRequests).toEqual([])
})

test('손상된 사용자 ZIP을 stable code와 한국어 message로 표시한다', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('radio', { name: '파일에서 불러오기' }).check()
  const action = page.getByRole('button', {
    name: '캐릭터 미리보기',
    exact: true,
  })
  await expect(action).toBeDisabled()

  await page.locator('input[type="file"]').nth(0).setInputFiles({
    name: 'test.skel',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not-used-before-archive-validation'),
  })

  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name: 'broken.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not-a-zip'),
  })
  await expect(action).toBeEnabled()
  await action.click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('ARCHIVE_CORRUPT')
  await expect(alert).toContainText(
    '캐릭터 ZIP을 읽지 못했습니다. 파일 내용을 확인한 뒤 다시 시도해주세요.',
  )
})

test('mobile 빈 상태는 LiveSD frame을 숨기고 가로 overflow를 만들지 않는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByText('아직 표시할 캐릭터가 없습니다.')).toBeVisible()
  await expect(page.getByTestId('livesd-preview-border-box')).not.toBeVisible()
  expect(
    await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    })),
  ).toEqual({ clientWidth: 390, scrollWidth: 390 })
})

test('source 없는 저장 preset을 resource control보다 먼저 확정하고 요청 없이 유지한다', async ({
  page,
}) => {
  const providerRequests: string[] = []
  page.on('request', (request) => {
    if (/prsk-chibi-viewer|assets\.pjsek|custom-prsk/u.test(request.url())) {
      providerRequests.push(request.url())
    }
  })
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value)
  }, {
    key: CODEX_PET_SETTINGS_PRESET_STORAGE_KEY,
    value: JSON.stringify({
      version: 1,
      activePresetName: 'Airi First',
      presets: {
        'Airi First': storedPreset('Airi First', 2),
        'Miku First': storedPreset('Miku First', 1),
      },
    }),
  })

  await page.goto('/')
  const presetSelector = page.getByRole('combobox', {
    name: '저장 프리셋',
  })
  const sourceSelector = page.getByRole('radio', {
    name: '기본 캐릭터',
  })
  await expect(presetSelector).toHaveCount(1)
  await expect(presetSelector).toHaveValue('Airi First')
  const [presetBox, sourceBox] = await Promise.all([
    presetSelector.boundingBox(),
    sourceSelector.boundingBox(),
  ])
  expect(presetBox).not.toBeNull()
  expect(sourceBox).not.toBeNull()
  expect(presetBox!.y).toBeLessThan(sourceBox!.y)

  await presetSelector.selectOption('Miku First')
  await expect(presetSelector).toHaveValue('Miku First')
  expect(
    await page.evaluate((key) => {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored).activePresetName : null
    }, CODEX_PET_SETTINGS_PRESET_STORAGE_KEY),
  ).toBe('Airi First')
  await page.getByRole('button', { name: '프리셋 불러오기' }).click()
  expect(
    await page.evaluate((key) => {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored).activePresetName : null
    }, CODEX_PET_SETTINGS_PRESET_STORAGE_KEY),
  ).toBe('Miku First')
  expect(providerRequests).toEqual([])
})
