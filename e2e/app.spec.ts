import { expect, test } from '@playwright/test'

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
  await expect(
    page.getByRole('tab', { name: /레뷰 스타라이트.*준비중/ }),
  ).toBeDisabled()
  await expect(
    page.getByRole('tab', { name: /BanG Dream!.*준비중/ }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: '불러오기' }),
  ).toBeVisible()
  await expect(page.locator('.status-card')).toBeVisible()
  await expect(page.getByLabel('LiveSD WebGL 미리보기')).toBeVisible()
  expect(providerRequests).toEqual([])

  const [controlBox, previewBox, builderBox] = await Promise.all([
    page.locator('.control-panel').boundingBox(),
    page.locator('.preview-panel').boundingBox(),
    page.locator('.codex-pet-builder').boundingBox(),
  ])
  expect(controlBox).not.toBeNull()
  expect(previewBox).not.toBeNull()
  expect(builderBox).not.toBeNull()
  expect(previewBox!.height).toBeLessThanOrEqual(480)
  expect(previewBox!.x).toBe(builderBox!.x)
  expect(controlBox!.x).toBeLessThan(previewBox!.x)
  expect(builderBox!.y).toBeGreaterThan(previewBox!.y)

  await page
    .getByRole('tab', { name: /레뷰 스타라이트.*준비중/ })
    .evaluate((element) =>
      element.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    )
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
  await page.getByRole('radio', { name: '리소스 업로드' }).check()
  const action = page.locator('button.primary-action')
  await expect(action).toBeEnabled()

  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name: 'broken.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not-a-zip'),
  })
  await action.click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('ARCHIVE_CORRUPT')
  await expect(alert).toContainText('ZIP을 읽거나 압축 해제할 수 없습니다')
})
