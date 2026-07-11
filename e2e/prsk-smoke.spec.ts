import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from '@zip.js/zip.js'

const assetRoot = fileURLToPath(
  new URL('../assets/prsk/sd_mob003/', import.meta.url),
)
const atlasPath = `${assetRoot}sekai_atlas.atlas`
const texturePath = `${assetRoot}sekai_atlas.png`
const skeletonPath = fileURLToPath(
  new URL('../assets/prsk/base_model/sekai_skeleton.skel', import.meta.url),
)
const localAssetsReady =
  existsSync(atlasPath) && existsSync(texturePath) && existsSync(skeletonPath)

async function createCharacterZip(): Promise<Buffer> {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
  })
  await writer.add(
    'nested/sekai_atlas.atlas',
    new Uint8ArrayReader(readFileSync(atlasPath)),
    { useWebWorkers: false },
  )
  await writer.add(
    'nested/sekai_atlas.png',
    new Uint8ArrayReader(readFileSync(texturePath)),
    { useWebWorkers: false },
  )
  return Buffer.from(await writer.close())
}

test('로컬 PRSK 3.6.53D4를 렌더링하고 재가져오기 자원을 정리한다', async ({
  page,
}, testInfo) => {
  test.skip(!localAssetsReady, 'gitignore된 로컬 PRSK 자산이 없습니다.')

  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
      externalRequests.push(request.url())
    }
  })
  await page.addInitScript(() => {
    const originalRevoke = URL.revokeObjectURL.bind(URL)
    Reflect.set(window, '__livesdRevokeCount', 0)
    URL.revokeObjectURL = (url: string) => {
      const count = Number(Reflect.get(window, '__livesdRevokeCount'))
      Reflect.set(window, '__livesdRevokeCount', count + 1)
      originalRevoke(url)
    }
  })

  await page.goto('/')
  await page.getByRole('radio', { name: '리소스 업로드' }).check()
  const previewCanvas = page.getByLabel('LiveSD WebGL 미리보기')
  const skeletonInput = page.locator('input[type="file"]').nth(0)
  const archiveInput = page.locator('input[type="file"]').nth(1)
  const zipBuffer = await createCharacterZip()
  const upload = {
    name: 'sd_mob003.zip',
    mimeType: 'application/zip',
    buffer: zipBuffer,
  }
  await skeletonInput.setInputFiles({
    name: 'sekai_skeleton.skel',
    mimeType: 'application/octet-stream',
    buffer: readFileSync(skeletonPath),
  })
  await archiveInput.setInputFiles(upload)
  await page.getByRole('button', { name: '가져와서 미리보기' }).click()
  await expect(page.locator('.status-card')).toContainText(
    'sd_mob003.zip 미리보기를 재생 중입니다.',
    { timeout: 20_000 },
  )
  await expect(
    page.getByRole('heading', { name: 'sd_mob003.zip' }),
  ).toBeVisible()
  const defaultCanvas = await previewCanvas.screenshot()
  const outputBorder = page.getByTestId('livesd-preview-border-box')
  await expect(outputBorder).toContainText('192 × 208')
  const outputBorderBox = await outputBorder.boundingBox()
  expect(outputBorderBox).not.toBeNull()
  expect(outputBorderBox!.width / outputBorderBox!.height).toBeCloseTo(
    192 / 208,
    2,
  )
  const framingScale = page.getByRole('slider', {
    name: 'Pet 크기 슬라이더',
  })
  const framingOffsetX = page.getByRole('slider', {
    name: '가로 cell 위치',
  })
  const framingOffsetY = page.getByRole('slider', {
    name: '세로 cell 위치',
  })
  await expect(framingScale).toHaveAttribute('max', '150')
  await framingScale.press('End')
  await framingOffsetX.press('ArrowRight')
  await framingOffsetY.press('ArrowDown')
  await expect(framingScale).toHaveValue('150')
  await expect(framingOffsetX).toHaveValue('1')
  await expect(framingOffsetY).toHaveValue('-1')
  await page.getByRole('button', { name: '프레이밍 초기화' }).click()
  await expect(framingScale).toHaveValue('100')
  await expect(framingOffsetX).toHaveValue('0')
  await expect(framingOffsetY).toHaveValue('0')

  const contextState = await previewCanvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext('webgl')
    if (!gl) {
      throw new Error('LiveSD preview WebGL context is unavailable')
    }
    const attributes = gl.getContextAttributes()
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.SCISSOR_TEST)
    gl.enable(gl.STENCIL_TEST)
    gl.enable(gl.POLYGON_OFFSET_FILL)
    return {
      depth: attributes?.depth,
      stencil: attributes?.stencil,
      contaminated: [
        gl.DEPTH_TEST,
        gl.CULL_FACE,
        gl.SCISSOR_TEST,
        gl.STENCIL_TEST,
        gl.POLYGON_OFFSET_FILL,
      ].every((capability) => gl.isEnabled(capability)),
    }
  })
  expect(contextState).toEqual({
    contaminated: true,
    depth: false,
    stencil: false,
  })
  await expect
    .poll(() =>
      previewCanvas.evaluate((element) => {
        const gl = (element as HTMLCanvasElement).getContext('webgl')
        if (!gl) {
          throw new Error('LiveSD preview WebGL context is unavailable')
        }
        return [
          gl.DEPTH_TEST,
          gl.CULL_FACE,
          gl.SCISSOR_TEST,
          gl.STENCIL_TEST,
          gl.POLYGON_OFFSET_FILL,
        ].every((capability) => !gl.isEnabled(capability))
      }),
    )
    .toBe(true)
  await testInfo.attach('livesd-2d-state-recovered', {
    body: await previewCanvas.screenshot(),
    contentType: 'image/png',
  })

  const animationPicker = page.getByRole('combobox', {
    name: '애니메이션',
    exact: true,
  })
  await expect(animationPicker).toBeEnabled()
  await expect(page.getByText('LiveSD 3.6.53')).toBeVisible()

  await animationPicker.click()
  await animationPicker.fill('m_normal_idle01_f')
  await page
    .locator('.animation-picker')
    .getByRole('option', { name: 'm_normal_idle01_f', exact: true })
    .click()
  await expect(animationPicker).toHaveValue('m_normal_idle01_f')
  await expect(
    page.locator('.preview-meta').getByText('m_normal_idle01_f', { exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () => !(await previewCanvas.screenshot()).equals(defaultCanvas))
    .toBe(true)

  const shortcutGroup = page.getByRole('group', {
    name: 'Codex Pet 상태 바로가기',
  })
  const idleShortcut = shortcutGroup.getByRole('button', {
    name: /^대기 미리보기:/,
  })
  const wavingShortcut = shortcutGroup.getByRole('button', {
    name: /^인사 미리보기:/,
  })
  const idleMapping = await page
    .getByRole('combobox', { name: '대기 애니메이션', exact: true })
    .inputValue()
  const wavingMapping = await page
    .getByRole('combobox', { name: '인사 애니메이션', exact: true })
    .inputValue()
  const requestsBeforeShortcuts = externalRequests.length
  const revokesBeforeShortcuts = await page.evaluate(() =>
    Number(Reflect.get(window, '__livesdRevokeCount')),
  )

  await idleShortcut.click()
  await expect(idleShortcut).toHaveAttribute('aria-pressed', 'true')
  await expect(animationPicker).toHaveValue(idleMapping)
  await expect(
    page.locator('.preview-meta').getByText(idleMapping, { exact: true }),
  ).toBeVisible()

  await wavingShortcut.click()
  await expect(wavingShortcut).toHaveAttribute('aria-pressed', 'true')
  await expect(idleShortcut).toHaveAttribute('aria-pressed', 'false')
  await expect(animationPicker).toHaveValue(wavingMapping)
  await expect(
    page.locator('.preview-meta').getByText(wavingMapping, { exact: true }),
  ).toBeVisible()
  expect(externalRequests).toHaveLength(requestsBeforeShortcuts)
  expect(
    await page.evaluate(() =>
      Number(Reflect.get(window, '__livesdRevokeCount')),
    ),
  ).toBe(revokesBeforeShortcuts)

  await previewCanvas.evaluate((element) => {
    Reflect.set(window, '__livesdCanvasBeforeLocaleSwitch', element)
  })
  const requestsBeforeLocaleSwitch = externalRequests.length
  const revokesBeforeLocaleSwitch = await page.evaluate(() =>
    Number(Reflect.get(window, '__livesdRevokeCount')),
  )
  const frameBeforeLocaleSwitch = await previewCanvas.screenshot()

  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.status-card')).toContainText(
    'Playing the sd_mob003.zip preview.',
  )
  const englishCanvas = page.getByLabel('LiveSD WebGL preview')
  await expect(englishCanvas).toBeVisible()
  expect(
    await englishCanvas.evaluate(
      (element) =>
        Reflect.get(window, '__livesdCanvasBeforeLocaleSwitch') === element,
    ),
  ).toBe(true)
  await expect(
    page.getByRole('combobox', { name: 'Animation', exact: true }),
  ).toHaveValue(wavingMapping)
  await expect(page.getByRole('button', {
    name: /^Preview Wave:/,
  })).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => !(await englishCanvas.screenshot()).equals(frameBeforeLocaleSwitch))
    .toBe(true)
  expect(externalRequests).toHaveLength(requestsBeforeLocaleSwitch)
  expect(
    await page.evaluate(() =>
      Number(Reflect.get(window, '__livesdRevokeCount')),
    ),
  ).toBe(revokesBeforeLocaleSwitch)

  await page.getByRole('button', { name: '한국어' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  await expect(animationPicker).toHaveValue(wavingMapping)
  await expect(wavingShortcut).toHaveAttribute('aria-pressed', 'true')
  expect(externalRequests).toHaveLength(requestsBeforeLocaleSwitch)
  expect(
    await page.evaluate(() =>
      Number(Reflect.get(window, '__livesdRevokeCount')),
    ),
  ).toBe(revokesBeforeLocaleSwitch)

  await animationPicker.click()
  await animationPicker.fill('m_normal_idle01_f')
  await page
    .locator('.animation-picker')
    .getByRole('option', { name: 'm_normal_idle01_f', exact: true })
    .click()
  await expect(animationPicker).toHaveValue('m_normal_idle01_f')
  await expect(wavingShortcut).toHaveAttribute('aria-pressed', 'false')
  await expect(idleShortcut).toHaveAttribute('aria-pressed', 'false')
  expect(externalRequests).toHaveLength(requestsBeforeLocaleSwitch)
  expect(
    await page.evaluate(() =>
      Number(Reflect.get(window, '__livesdRevokeCount')),
    ),
  ).toBe(revokesBeforeLocaleSwitch)

  const revokeCount = await page.evaluate(() =>
    Number(Reflect.get(window, '__livesdRevokeCount')),
  )
  await archiveInput.setInputFiles(upload)
  await page.getByRole('button', { name: '가져와서 미리보기' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => Number(Reflect.get(window, '__livesdRevokeCount'))),
    )
    .toBeGreaterThan(revokeCount)
  await expect(page.locator('.status-card')).toContainText(
    'sd_mob003.zip 미리보기를 재생 중입니다.',
  )
  expect(externalRequests).toEqual([])
})
