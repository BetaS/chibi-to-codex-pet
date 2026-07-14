import { expect, test, type Page, type Route } from '@playwright/test'

const CUSTOM_ASSET_BASE_URL = 'https://custom-prsk.example/area_sd'
const CUSTOM_CATALOG_URL = `${CUSTOM_ASSET_BASE_URL}/catalog.json`
const PRSK_CHIBI_VIEWER_URL = 'https://prsk-chibi-viewer.vercel.app/'
const PRSK_CHIBI_VIEWER_BUNDLE_PATH = '/static/js/main.8ca0b7b5.js'
const PRSK_CHIBI_VIEWER_BUNDLE_URL = new URL(
  PRSK_CHIBI_VIEWER_BUNDLE_PATH,
  PRSK_CHIBI_VIEWER_URL,
).toString()

const prskChibiViewerHtml = `<!doctype html><html><head><script defer src="${PRSK_CHIBI_VIEWER_BUNDLE_PATH}"></script></head><body></body></html>`
const prskChibiViewerBundle =
  'const catalog=[{"value":"base_model","label":"base_model"},{"value":"sd_mob003","label":"sd_mob003"},{"value":"sd_alpha","label":"sd_alpha"},{"value":"m_normal_walk01_f","label":"m_normal_walk01_f"}];'

const REMOTE_PROVIDER_ROUTE =
  /^https:\/\/(?:custom-prsk\.example|assets\.pjsek\.ai|prsk-chibi-viewer\.vercel\.app)(?:\/|$)/

const corsHeaders = {
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-origin': '*',
  'cache-control': 'no-store',
}

const customCharacters = [
  { id: 'sd_mob003', label: 'Mob Character' },
  { id: 'sd_17kanade_normal', label: 'Normal' },
  { id: 'sd_staff001', label: 'Staff Character' },
  { id: 'sd_13tsukasa_normal', label: 'Normal' },
  { id: 'sd_21miku_normal', label: 'Normal' },
  { id: 'sd_11akito_normal', label: 'Normal' },
  { id: 'sd_01ichika_normal', label: 'Normal' },
  { id: 'sd_21miku_street', label: 'Street' },
  { id: 'sd_05minori_normal', label: 'Normal' },
]

function fulfillJson(route: Route, value: unknown): Promise<void> {
  return route.fulfill({
    body: JSON.stringify(value),
    contentType: 'application/json; charset=utf-8',
    headers: corsHeaders,
    status: 200,
  })
}

async function routePrskChibiViewerCatalog(
  page: Page,
  catalogRequests: string[] = [],
): Promise<void> {
  await page.route(PRSK_CHIBI_VIEWER_URL, async (route) => {
    catalogRequests.push(route.request().url())
    await route.fulfill({
      body: prskChibiViewerHtml,
      contentType: 'text/html; charset=utf-8',
      headers: corsHeaders,
      status: 200,
    })
  })
  await page.route(PRSK_CHIBI_VIEWER_BUNDLE_URL, async (route) => {
    catalogRequests.push(route.request().url())
    await route.fulfill({
      body: prskChibiViewerBundle,
      contentType: 'application/javascript; charset=utf-8',
      headers: corsHeaders,
      status: 200,
    })
  })
}

interface RemoteRequestGuard {
  blockedRequests: string[]
  failedRequests: string[]
  requests: string[]
}

function isRemoteProviderRequest(url: string): boolean {
  return REMOTE_PROVIDER_ROUTE.test(url)
}

async function installRemoteRequestGuard(
  page: Page,
): Promise<RemoteRequestGuard> {
  const guard: RemoteRequestGuard = {
    blockedRequests: [],
    failedRequests: [],
    requests: [],
  }

  page.on('request', (request) => {
    if (isRemoteProviderRequest(request.url())) {
      guard.requests.push(request.url())
    }
  })
  page.on('requestfailed', (request) => {
    if (isRemoteProviderRequest(request.url())) {
      guard.failedRequests.push(
        `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown failure'}`,
      )
    }
  })

  // Register this first. Playwright gives newer, per-test fixture routes priority,
  // so every provider request not fulfilled by an exact fixture is aborted here.
  await page.route(REMOTE_PROVIDER_ROUTE, async (route) => {
    const request = route.request()
    guard.blockedRequests.push(`${request.method()} ${request.url()}`)
    await route.abort('blockedbyclient')
  })

  return guard
}

function expectOnlyRemoteRequests(
  guard: RemoteRequestGuard,
  expectedUrls: readonly string[],
): void {
  expect(guard.blockedRequests).toEqual([])
  const actionableFailures = guard.failedRequests.filter(
    (failure) =>
      !failure.endsWith('net::ERR_ABORTED') ||
      !expectedUrls.some((url) => failure.includes(url)),
  )
  expect(actionableFailures).toEqual([])
  expect([...guard.requests].sort()).toEqual([...expectedUrls].sort())
}

async function enterRemoteMode(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('radio', { name: '다른 서버' }).check()
  await expect(page.getByRole('combobox', { name: '캐릭터 검색' })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: '모델 검색' })).toBeDisabled()
}


test('custom catalog를 캐릭터와 모델 순서로 검색하며 commit 전 요청을 막는다', async ({
  page,
}) => {
  let releaseCatalog = () => undefined
  const catalogGate = new Promise<void>((resolve) => {
    releaseCatalog = resolve
  })
  const remoteGuard = await installRemoteRequestGuard(page)
  await page.route(CUSTOM_CATALOG_URL, async (route) => {
    await catalogGate
    await fulfillJson(route, { version: 1, characters: customCharacters })
  })
  const remoteRequests = remoteGuard.requests

  await enterRemoteMode(page)
  const characterPicker = page.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  const characterStatus = page.locator('.character-combobox [role="status"]')
  await expect(characterStatus).toHaveText('목록을 먼저 불러오세요.')

  await page.getByLabel('캐릭터 서버 URL').fill(CUSTOM_ASSET_BASE_URL)
  await page.getByRole('button', { name: '불러오기', exact: true }).click()
  await expect(characterPicker).toBeDisabled()
  await expect(characterPicker).toHaveAttribute('aria-busy', 'true')
  await expect(characterStatus).toHaveText('캐릭터를 불러오는 중입니다…')

  releaseCatalog()
  await expect(characterPicker).toBeEnabled()
  await expect(page.locator('.status-card')).toContainText(
    '캐릭터 8명이 준비됐습니다.',
  )
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])

  await characterPicker.click()
  await expect(characterPicker).toHaveAttribute('aria-expanded', 'true')
  const characterListbox = page.getByRole('listbox', {
    name: '캐릭터 검색',
  })
  await expect(
    characterListbox.locator('.searchable-combobox__group-heading'),
  ).toHaveText([
    'Leo/need',
    'MORE MORE JUMP!',
    'Vivid BAD SQUAD',
    '원더랜즈×쇼타임',
    '25시, 나이트 코드에서.',
    '버추얼 싱어',
    '기타',
  ])
  await expect(characterListbox.getByRole('option')).toHaveText([
    '호시노 이치카',
    '하나사토 미노리',
    '시노노메 아키토',
    '텐마 츠카사',
    '요이사키 카나데',
    '하츠네 미쿠',
    'Mob',
    'Staff',
  ])
  const initialActiveOption = await characterPicker.getAttribute(
    'aria-activedescendant',
  )
  expect(initialActiveOption).toBeTruthy()
  await characterPicker.press('ArrowDown')
  await expect(characterPicker).not.toHaveAttribute(
    'aria-activedescendant',
    initialActiveOption ?? '',
  )

  await characterPicker.fill('VBS')
  await expect(
    characterListbox.locator('.searchable-combobox__group-heading'),
  ).toHaveText(['Vivid BAD SQUAD'])
  await expect(characterListbox.getByRole('option')).toHaveText([
    '시노노메 아키토',
  ])
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])

  await characterPicker.fill('mIkU')
  await expect(
    page.getByRole('option', { name: '하츠네 미쿠', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('option', { name: 'Mob', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('option', { name: 'Staff', exact: true }),
  ).toHaveCount(0)

  await characterPicker.fill('MOB')
  await expect(
    page.getByRole('option', { name: 'Mob', exact: true }),
  ).toBeVisible()
  await characterPicker.fill('does-not-exist')
  await expect(characterStatus).toHaveText('검색 결과 없음')
  await characterPicker.press('Enter')
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])

  await characterPicker.fill('')
  await expect(
    characterListbox.getByRole('option'),
  ).toHaveText([
    '호시노 이치카',
    '하나사토 미노리',
    '시노노메 아키토',
    '텐마 츠카사',
    '요이사키 카나데',
    '하츠네 미쿠',
    'Mob',
    'Staff',
  ])
  await characterPicker.fill('MIKU')
  await characterPicker.press('Enter')
  await expect(characterPicker).toHaveValue('하츠네 미쿠')
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])

  const modelPicker = page.getByRole('combobox', { name: '모델 검색' })
  await expect(modelPicker).toBeEnabled()
  await modelPicker.click()
  await expect(
    page
      .getByRole('listbox', { name: '모델 검색' })
      .getByRole('option'),
  ).toHaveText(['Normal', 'Street'])
  await expect(
    page
      .getByRole('listbox', { name: '모델 검색' })
      .locator('.searchable-combobox__group-heading'),
  ).toHaveCount(0)
  await modelPicker.fill('STREET')
  await expect(
    page.getByRole('option', { name: 'Street', exact: true }),
  ).toBeVisible()
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])
  await modelPicker.fill('does-not-exist')
  await expect(page.locator('.model-combobox [role="status"]')).toHaveText(
    '검색 결과 없음',
  )
  await modelPicker.press('Enter')
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])
  expectOnlyRemoteRequests(remoteGuard, [CUSTOM_CATALOG_URL])
})

test('viewport 하단의 공용 dropdown은 body portal에서 위로 열리고 scroll 시 재배치된다', async ({
  page,
}) => {
  const remoteGuard = await installRemoteRequestGuard(page)
  await page.route(CUSTOM_CATALOG_URL, (route) =>
    fulfillJson(route, { version: 1, characters: customCharacters }),
  )

  await enterRemoteMode(page)
  await page.getByLabel('캐릭터 서버 URL').fill(CUSTOM_ASSET_BASE_URL)
  await page.getByRole('button', { name: '불러오기', exact: true }).click()

  const characterPicker = page.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  await expect(characterPicker).toBeEnabled()
  await page.evaluate(() => {
    const spacer = document.createElement('div')
    spacer.dataset.dropdownScrollSpacer = 'true'
    spacer.style.height = '1000px'
    document.body.append(spacer)
  })
  await characterPicker.evaluate((input) => {
    const rect = input.getBoundingClientRect()
    window.scrollBy(0, rect.bottom - (window.innerHeight - 8))
  })
  await characterPicker.click()

  const listbox = page.getByRole('listbox', { name: '캐릭터 검색' })
  await expect(listbox).toHaveAttribute('data-placement', 'above')
  expect(
    await listbox.evaluate((element) => element.parentElement === document.body),
  ).toBe(true)
  const bottomLayout = await listbox.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      top: rect.top,
      viewportHeight: window.innerHeight,
    }
  })
  expect(bottomLayout.top).toBeGreaterThanOrEqual(0)
  expect(bottomLayout.bottom).toBeLessThanOrEqual(bottomLayout.viewportHeight)

  await characterPicker.evaluate((input) => {
    const rect = input.getBoundingClientRect()
    window.scrollBy(0, rect.top - 100)
  })
  await expect(listbox).toHaveAttribute('data-placement', 'below')
  await expect(characterPicker).toHaveAttribute('aria-expanded', 'true')
  const scrolledLayout = await listbox.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      top: rect.top,
      viewportHeight: window.innerHeight,
    }
  })
  expect(scrolledLayout.top).toBeGreaterThanOrEqual(0)
  expect(scrolledLayout.bottom).toBeLessThanOrEqual(
    scrolledLayout.viewportHeight,
  )
  expectOnlyRemoteRequests(remoteGuard, [CUSTOM_CATALOG_URL])
})

test('빈 custom catalog를 stable error와 combobox 안내로 표시한다', async ({
  page,
}) => {
  const remoteGuard = await installRemoteRequestGuard(page)
  await page.route(CUSTOM_CATALOG_URL, (route) =>
    fulfillJson(route, { version: 1, characters: [] }),
  )

  await enterRemoteMode(page)
  await page.getByLabel('캐릭터 서버 URL').fill(CUSTOM_ASSET_BASE_URL)
  await page.getByRole('button', { name: '불러오기', exact: true }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('REMOTE_CATALOG_EMPTY')
  await expect(alert).toContainText('캐릭터 목록을 불러오지 못했습니다')
  const characterPicker = page.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  const modelPicker = page.getByRole('combobox', { name: '모델 검색' })
  await expect(characterPicker).toBeDisabled()
  await expect(modelPicker).toBeDisabled()
  await expect(characterPicker).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.character-combobox [role="status"]')).toContainText(
    '캐릭터 목록을 불러오지 못했습니다',
  )
  expectOnlyRemoteRequests(remoteGuard, [CUSTOM_CATALOG_URL])
})

test('기본 prsk-chibi-viewer resource는 불러오기 뒤 intercepted HTML과 bundle만 dropdown으로 만든다', async ({
  page,
}) => {
  const catalogRequests: string[] = []
  const remoteGuard = await installRemoteRequestGuard(page)
  await routePrskChibiViewerCatalog(page, catalogRequests)
  const remoteRequests = remoteGuard.requests

  await page.goto('/')
  await expect(
    page.getByRole('radio', { name: '기본 캐릭터' }),
  ).toBeChecked()
  expect(remoteRequests).toEqual([])

  await page.getByRole('button', { name: '불러오기', exact: true }).click()
  const characterPicker = page.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  await expect(characterPicker).toBeEnabled()
  expect(catalogRequests).toEqual([
    PRSK_CHIBI_VIEWER_URL,
    PRSK_CHIBI_VIEWER_BUNDLE_URL,
  ])

  await characterPicker.click()
  await expect(
    page
      .getByRole('listbox', { name: '캐릭터 검색' })
      .getByRole('option'),
  ).toHaveText(['Mob', 'Alpha'])
  await characterPicker.fill('MOB')
  await expect(
    page.getByRole('option', { name: 'Mob', exact: true }),
  ).toBeVisible()
  await characterPicker.press('Enter')
  const modelPicker = page.getByRole('combobox', { name: '모델 검색' })
  await expect(modelPicker).toBeEnabled()
  await modelPicker.click()
  await expect(
    page.getByRole('option', { name: '003', exact: true }),
  ).toBeVisible()
  expect(remoteRequests).toHaveLength(2)
  expectOnlyRemoteRequests(remoteGuard, [
    PRSK_CHIBI_VIEWER_URL,
    PRSK_CHIBI_VIEWER_BUNDLE_URL,
  ])
})
