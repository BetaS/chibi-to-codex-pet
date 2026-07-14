import { expect, test } from '@playwright/test'

test.use({ locale: 'fr-FR' })

test('미지원 browser locale은 영어로 시작하고 네 국기 selector로 즉시 전환한다', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByText(
      'Choose a favorite character and create an installable Codex Pet.',
    ),
  ).toBeVisible()

  const korean = page.getByRole('button', { name: '한국어' })
  const english = page.getByRole('button', { name: 'English' })
  const japanese = page.getByRole('button', { name: '日本語' })
  const chinese = page.getByRole('button', { name: '简体中文' })

  await expect(korean).toBeVisible()
  await expect(english).toHaveAttribute('aria-pressed', 'true')
  await expect(japanese).toBeVisible()
  await expect(chinese).toBeVisible()

  await japanese.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  await expect(page.getByRole('tab', { name: 'プロセカ' })).toBeVisible()

  await chinese.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('tab', { name: '世界计划' })).toBeVisible()

  await korean.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  await expect(page.getByRole('tab', { name: '프로세카' })).toBeVisible()

  await english.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('tab', { name: 'Project SEKAI' })).toBeVisible()
})
