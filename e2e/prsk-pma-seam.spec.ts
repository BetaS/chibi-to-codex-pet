import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from '@zip.js/zip.js'

const assetRoot = fileURLToPath(
  new URL('../assets/prsk/sd_21miku_miko/', import.meta.url),
)
const atlasPath = `${assetRoot}sekai_atlas.atlas`
const texturePath = `${assetRoot}sekai_atlas.png`
const skeletonPath = fileURLToPath(
  new URL('../assets/prsk/base_model/sekai_skeleton.skel', import.meta.url),
)
const localAssetsReady =
  existsSync(atlasPath) && existsSync(texturePath) && existsSync(skeletonPath)
const SEAM_PROBES = [
  { x: 390 / 1092, y: 342 / 1092 },
  { x: 400 / 1092, y: 349 / 1092 },
  { x: 410 / 1092, y: 355 / 1092 },
  { x: 420 / 1092, y: 359 / 1092 },
  { x: 431 / 1092, y: 362 / 1092 },
  { x: 441 / 1092, y: 364 / 1092 },
  { x: 452 / 1092, y: 365 / 1092 },
] as const

async function createCharacterZip(): Promise<Buffer> {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
  })
  await writer.add(
    'sekai_atlas.atlas',
    new Uint8ArrayReader(readFileSync(atlasPath)),
    { useWebWorkers: false },
  )
  await writer.add(
    'sekai_atlas.png',
    new Uint8ArrayReader(readFileSync(texturePath)),
    { useWebWorkers: false },
  )
  return Buffer.from(await writer.close())
}

async function analyzeScreenshot(page: Page, screenshot: Buffer) {
  return page.evaluate(async ({ dataUrl, probes }) => {
    const response = await fetch(dataUrl)
    const bitmap = await createImageBitmap(await response.blob())
    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = bitmap.width
    sampleCanvas.height = bitmap.height
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('2D screenshot sampling context is unavailable')
    }
    context.drawImage(bitmap, 0, 0)
    const seamPixels = probes.map(({ x, y }) => {
      const pixelX = Math.round(x * bitmap.width)
      const pixelY = Math.round(y * bitmap.height)
      return [...context.getImageData(pixelX, pixelY, 1, 1).data]
    })
    const rgba = context.getImageData(
      0,
      0,
      bitmap.width,
      bitmap.height,
    ).data
    let redPixelCount = 0
    let redPixelXSum = 0
    const minY = Math.round(bitmap.height * 0.1)
    const maxY = Math.round(bitmap.height * 0.55)
    for (let y = minY; y < maxY; y += 1) {
      for (let x = 0; x < bitmap.width; x += 1) {
        const offset = (y * bitmap.width + x) * 4
        const red = rgba[offset] ?? 0
        const green = rgba[offset + 1] ?? 0
        const blue = rgba[offset + 2] ?? 0
        if (red > 120 && red > green * 1.4 && red > blue * 1.25) {
          redPixelCount += 1
          redPixelXSum += x
        }
      }
    }
    bitmap.close()
    if (redPixelCount === 0) {
      throw new Error('Miku hair accessory red pixels were not found')
    }
    return {
      redCentroidX:
        redPixelXSum / redPixelCount / Math.max(sampleCanvas.width - 1, 1),
      seamPixels,
    }
  }, {
    dataUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
    probes: SEAM_PROBES,
  })
}

test.use({
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  viewport: { width: 390, height: 844 },
})

test('Codex Pet 상태 바로가기는 mobile toolbar 안의 3×3 grid로 배치된다', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  const shortcutGroup = page.getByRole('group', {
    name: 'Codex Pet 상태 바로가기',
  })
  const shortcutButtons = shortcutGroup.getByRole('button')
  await expect(shortcutGroup).toBeVisible()
  await expect(shortcutButtons).toHaveCount(9)

  const layout = await page.evaluate(() => {
    const getElement = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) {
        throw new Error(`Expected ${selector} to exist`)
      }
      return element
    }
    const toBox = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      return {
        bottom: rect.bottom,
        clientWidth: element.clientWidth,
        left: rect.left,
        right: rect.right,
        scrollWidth: element.scrollWidth,
        top: rect.top,
        width: rect.width,
      }
    }

    const panel = getElement('.preview-panel')
    const toolbar = getElement('.preview-toolbar')
    const group = getElement('.codex-pet-state-shortcuts__buttons')
    const buttons = [...group.querySelectorAll<HTMLButtonElement>('button')]

    return {
      buttons: buttons.map(toBox),
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
      group: toBox(group),
      panel: toBox(panel),
      toolbar: toBox(toolbar),
    }
  })

  expect(layout.document.scrollWidth).toBe(layout.document.clientWidth)
  expect(layout.panel.scrollWidth).toBeLessThanOrEqual(
    layout.panel.clientWidth,
  )
  expect(layout.toolbar.scrollWidth).toBeLessThanOrEqual(
    layout.toolbar.clientWidth,
  )
  expect(layout.group.scrollWidth).toBeLessThanOrEqual(
    layout.group.clientWidth,
  )
  expect(layout.group.left).toBeGreaterThanOrEqual(layout.toolbar.left)
  expect(layout.group.right).toBeLessThanOrEqual(layout.toolbar.right)
  expect(layout.buttons.every((button) =>
    button.left >= layout.group.left && button.right <= layout.group.right
  )).toBe(true)

  const rowCounts = [...new Set(
    layout.buttons.map((button) => Math.round(button.top)),
  )].map((rowTop) => layout.buttons.filter(
    (button) => Math.round(button.top) === rowTop,
  ).length)
  const columnCounts = [...new Set(
    layout.buttons.map((button) => Math.round(button.left)),
  )].map((columnLeft) => layout.buttons.filter(
    (button) => Math.round(button.left) === columnLeft,
  ).length)
  expect(rowCounts).toEqual([3, 3, 3])
  expect(columnCounts).toEqual([3, 3, 3])

  const screenshot = await page.locator('.preview-panel').screenshot({
    path: testInfo.outputPath('mobile-state-shortcuts.png'),
  })
  await testInfo.attach('mobile-state-shortcuts', {
    body: screenshot,
    contentType: 'image/png',
  })
})

test('Miku miko PMA atlas는 mobile DPR에서 앞머리 seam 없이 렌더링된다', async ({
  page,
}, testInfo) => {
  test.skip(!localAssetsReady, 'gitignore된 Miku miko PRSK 자산이 없습니다.')

  await page.goto('/')
  await page.getByRole('radio', { name: '리소스 업로드' }).check()
  const fileInputs = page.locator('input[type="file"]')
  await fileInputs.nth(0).setInputFiles({
    name: 'sekai_skeleton.skel',
    mimeType: 'application/octet-stream',
    buffer: readFileSync(skeletonPath),
  })
  await fileInputs.nth(1).setInputFiles({
    name: 'sd_21miku_miko.zip',
    mimeType: 'application/zip',
    buffer: await createCharacterZip(),
  })
  await page.getByRole('button', { name: '가져와서 미리보기' }).click()
  await expect(page.locator('.status-card')).toContainText(
    'sd_21miku_miko.zip 미리보기를 재생 중입니다.',
    { timeout: 20_000 },
  )

  const canvas = page.getByLabel('LiveSD WebGL 미리보기')
  await expect(canvas).toBeVisible()
  await page.addStyleTag({
    content: `
      .preview-toolbar { display: none !important; }
      .preview-stage {
        height: 364px !important;
        min-height: 364px !important;
        padding: 0 !important;
      }
      .livesd-preview-border-box,
      .livesd-preview-border-box canvas {
        width: 364px !important;
        height: 364px !important;
        min-height: 364px !important;
        aspect-ratio: auto !important;
      }
    `,
  })
  await canvas.evaluate(
    () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }),
  )
  expect(
    await canvas.evaluate((element) => {
      const gl = (element as HTMLCanvasElement).getContext('webgl')
      return gl?.getContextAttributes()?.premultipliedAlpha
    }),
  ).toBe(true)

  const screenshot = await canvas.screenshot({
    path: testInfo.outputPath('miku-miko-mobile-pma.png'),
  })
  const originalAnalysis = await analyzeScreenshot(page, screenshot)
  const { seamPixels } = originalAnalysis
  const seamGreenMean = seamPixels.reduce(
    (sum, pixel) => sum + (pixel[1] ?? 0),
    0,
  ) / seamPixels.length
  expect(seamGreenMean).toBeGreaterThan(190)
  expect(originalAnalysis.redCentroidX).toBeGreaterThan(0.6)

  await page.getByRole('checkbox', {
    name: '전체 캐릭터 수평 반전',
  }).check()
  await canvas.evaluate(
    () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }),
  )
  const mirroredScreenshot = await canvas.screenshot({
    path: testInfo.outputPath('miku-miko-mobile-pma-mirrored.png'),
  })
  const mirroredAnalysis = await analyzeScreenshot(page, mirroredScreenshot)
  expect(mirroredAnalysis.redCentroidX).toBeLessThan(0.4)
  expect(
    originalAnalysis.redCentroidX + mirroredAnalysis.redCentroidX,
  ).toBeCloseTo(1, 2)
  await testInfo.attach('miku-miko-mobile-pma', {
    body: screenshot,
    contentType: 'image/png',
  })
  await testInfo.attach('miku-miko-mobile-pma-seam-pixels', {
    body: Buffer.from(JSON.stringify({
      mirroredRedCentroidX: mirroredAnalysis.redCentroidX,
      originalRedCentroidX: originalAnalysis.redCentroidX,
      seamGreenMean,
      seamPixels,
    }, null, 2)),
    contentType: 'application/json',
  })
  await testInfo.attach('miku-miko-mobile-pma-mirrored', {
    body: mirroredScreenshot,
    contentType: 'image/png',
  })
})
