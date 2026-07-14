import { expect, test } from '@playwright/test'

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
