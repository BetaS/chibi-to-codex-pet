import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page, type Route } from '@playwright/test'

const CUSTOM_ASSET_BASE_URL = 'https://custom-prsk.example/area_sd'
const CUSTOM_CATALOG_URL = `${CUSTOM_ASSET_BASE_URL}/catalog.json`
const PJSEK_ASSET_BASE_URL =
  'https://assets.pjsek.ai/file/pjsekai-assets/startapp/area_sd'
const PRSK_CHIBI_VIEWER_URL = 'https://prsk-chibi-viewer.vercel.app/'
const PRSK_CHIBI_VIEWER_BUNDLE_PATH = '/static/js/main.8ca0b7b5.js'
const PRSK_CHIBI_VIEWER_BUNDLE_URL = new URL(
  PRSK_CHIBI_VIEWER_BUNDLE_PATH,
  PRSK_CHIBI_VIEWER_URL,
).toString()
const CHARACTER_ID = 'sd_mob003'

const prskChibiViewerHtml = `<!doctype html><html><head><script defer src="${PRSK_CHIBI_VIEWER_BUNDLE_PATH}"></script></head><body></body></html>`
const prskChibiViewerBundle =
  'const catalog=[{"value":"base_model","label":"base_model"},{"value":"sd_mob003","label":"sd_mob003"},{"value":"sd_alpha","label":"sd_alpha"},{"value":"m_normal_walk01_f","label":"m_normal_walk01_f"}];'

function modelAssetUrls(assetBaseUrl: string): string[] {
  return [
    `${assetBaseUrl}/base_model/sekai_skeleton.skel`,
    `${assetBaseUrl}/${CHARACTER_ID}/sekai_atlas.atlas`,
    `${assetBaseUrl}/${CHARACTER_ID}/sekai_atlas.png`,
  ]
}

const CUSTOM_MODEL_URLS = modelAssetUrls(CUSTOM_ASSET_BASE_URL)
const PJSEK_MODEL_URLS = modelAssetUrls(PJSEK_ASSET_BASE_URL)
const REMOTE_PROVIDER_ROUTE =
  /^https:\/\/(?:custom-prsk\.example|assets\.pjsek\.ai|prsk-chibi-viewer\.vercel\.app)(?:\/|$)/

const skeletonPath = fileURLToPath(
  new URL('../assets/prsk/base_model/sekai_skeleton.skel', import.meta.url),
)
const atlasPath = fileURLToPath(
  new URL('../assets/prsk/sd_mob003/sekai_atlas.atlas', import.meta.url),
)
const texturePath = fileURLToPath(
  new URL('../assets/prsk/sd_mob003/sekai_atlas.png', import.meta.url),
)
const localAssetsReady =
  existsSync(skeletonPath) && existsSync(atlasPath) && existsSync(texturePath)

const corsHeaders = {
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-origin': '*',
  'cache-control': 'no-store',
}

const customCharacters = [
  { id: 'sd_mob003', label: 'Mob Character' },
  { id: 'sd_21miku_normal', label: 'Night Miku' },
  { id: 'sd_21miku_street', label: 'Street Miku' },
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
  await page.getByRole('radio', { name: 'Custom provider' }).check()
  await expect(page.getByRole('combobox', { name: '캐릭터 검색' })).toBeDisabled()
}

async function loadCustomCatalog(page: Page): Promise<void> {
  await page.getByLabel('원격 asset base URL').fill(CUSTOM_ASSET_BASE_URL)
  await page.getByRole('button', { name: '불러오기' }).click()
  await expect(page.getByRole('combobox', { name: '캐릭터 검색' })).toBeEnabled()
}

async function routeLocalModelAssets(
  page: Page,
  assetBaseUrl: string,
): Promise<void> {
  if (!localAssetsReady) {
    return
  }

  const responses = [
    {
      body: readFileSync(skeletonPath),
      contentType: 'application/octet-stream',
      url: `${assetBaseUrl}/base_model/sekai_skeleton.skel`,
    },
    {
      body: readFileSync(atlasPath),
      contentType: 'text/plain; charset=utf-8',
      url: `${assetBaseUrl}/${CHARACTER_ID}/sekai_atlas.atlas`,
    },
    {
      body: readFileSync(texturePath),
      contentType: 'image/png',
      url: `${assetBaseUrl}/${CHARACTER_ID}/sekai_atlas.png`,
    },
  ]

  for (const response of responses) {
    await page.route(response.url, (route) =>
      route.fulfill({
        body: response.body,
        contentType: response.contentType,
        headers: corsHeaders,
        status: 200,
      }),
    )
  }
}

async function expectRemotePreviewReady(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: CHARACTER_ID, exact: true }),
  ).toBeVisible()
  await expect(page.getByText('미리보기 준비 완료')).toBeVisible()
  await expect(page.getByText('LiveSD 3.6.53')).toBeVisible()
  await expect(page.getByLabel('LiveSD WebGL 미리보기')).toBeVisible()
}

test('custom catalog 상태와 searchable character combobox를 ARIA keyboard로 탐색한다', async ({
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

  await page.getByLabel('원격 asset base URL').fill(CUSTOM_ASSET_BASE_URL)
  await page.getByRole('button', { name: '불러오기' }).click()
  await expect(characterPicker).toBeDisabled()
  await expect(characterPicker).toHaveAttribute('aria-busy', 'true')
  await expect(characterStatus).toHaveText('원격 asset 목록을 불러오는 중입니다.')

  releaseCatalog()
  await expect(characterPicker).toBeEnabled()
  await expect(page.locator('.status-card')).toContainText(
    '3개 캐릭터를 찾았습니다.',
  )
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])

  await characterPicker.click()
  await expect(characterPicker).toHaveAttribute('aria-expanded', 'true')
  const initialActiveOption = await characterPicker.getAttribute(
    'aria-activedescendant',
  )
  expect(initialActiveOption).toBeTruthy()
  await characterPicker.press('ArrowDown')
  await expect(characterPicker).not.toHaveAttribute(
    'aria-activedescendant',
    initialActiveOption ?? '',
  )

  await characterPicker.fill('mIkU')
  await expect(
    page.getByRole('option', { name: 'Night Miku', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('option', { name: 'Street Miku', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('option', { name: 'Mob Character', exact: true }),
  ).toHaveCount(0)

  await characterPicker.fill('MOB003')
  await expect(
    page.getByRole('option', { name: 'Mob Character', exact: true }),
  ).toBeVisible()
  await characterPicker.fill('does-not-exist')
  await expect(characterStatus).toHaveText('검색 결과 없음')
  await characterPicker.press('Enter')
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])

  await characterPicker.fill('')
  await expect(page.getByRole('option')).toHaveText([
    'Mob Character',
    'Night Miku',
    'Street Miku',
  ])
  expect(remoteRequests).toEqual([CUSTOM_CATALOG_URL])
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
  await page.getByLabel('원격 asset base URL').fill(CUSTOM_ASSET_BASE_URL)
  await page.getByRole('button', { name: '불러오기' }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('REMOTE_CATALOG_EMPTY')
  await expect(alert).toContainText('사용할 수 있는 캐릭터가 없습니다')
  const characterPicker = page.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  await expect(characterPicker).toBeDisabled()
  await expect(characterPicker).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.character-combobox [role="status"]')).toContainText(
    '사용할 수 있는 캐릭터가 없습니다',
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
    page.getByRole('radio', { name: '기본 제공 리소스' }),
  ).toBeChecked()
  expect(remoteRequests).toEqual([])

  await page.getByRole('button', { name: '불러오기' }).click()
  const characterPicker = page.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  await expect(characterPicker).toBeEnabled()
  expect(catalogRequests).toEqual([
    PRSK_CHIBI_VIEWER_URL,
    PRSK_CHIBI_VIEWER_BUNDLE_URL,
  ])

  await characterPicker.click()
  await expect(page.getByRole('option')).toHaveText([
    'sd_alpha',
    'sd_mob003',
  ])
  await characterPicker.fill('MOB003')
  await expect(
    page.getByRole('option', { name: CHARACTER_ID, exact: true }),
  ).toBeVisible()
  expect(remoteRequests).toHaveLength(2)
  expectOnlyRemoteRequests(remoteGuard, [
    PRSK_CHIBI_VIEWER_URL,
    PRSK_CHIBI_VIEWER_BUNDLE_URL,
  ])
})

test('custom catalog option commit으로 intercepted 모델을 렌더링하고 animation을 로컬 검색한다', async ({
  page,
}) => {
  test.skip(!localAssetsReady, 'gitignore된 로컬 PRSK 렌더 자산이 없습니다.')

  const remoteGuard = await installRemoteRequestGuard(page)
  await page.route(CUSTOM_CATALOG_URL, (route) =>
    fulfillJson(route, { version: 1, characters: customCharacters }),
  )
  await routeLocalModelAssets(page, CUSTOM_ASSET_BASE_URL)
  const remoteRequests = remoteGuard.requests

  await enterRemoteMode(page)
  await loadCustomCatalog(page)
  const characterPicker = page.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  await characterPicker.click()
  await characterPicker.fill('MOB003')
  expect(remoteRequests).toHaveLength(1)
  await characterPicker.press('Enter')

  await expectRemotePreviewReady(page)
  await expect(characterPicker).toHaveValue('Mob Character')
  await expect(characterPicker).toHaveAttribute('aria-expanded', 'false')
  expect(remoteRequests).toHaveLength(4)

  const animationPicker = page.getByRole('combobox', {
    name: '애니메이션',
    exact: true,
  })
  await expect(animationPicker).toBeEnabled()
  await expect(animationPicker).toHaveValue('pose_default')
  await expect(
    page.locator('.preview-meta').getByText('pose_default', {
      exact: true,
    }),
  ).toBeVisible()

  await animationPicker.click()
  await expect(animationPicker).toHaveAttribute('aria-expanded', 'true')
  await animationPicker.fill('NORMAL_WALK01_F')
  await expect(
    page
      .locator('.animation-picker')
      .getByRole('option', { name: 'm_normal_walk01_f', exact: true }),
  ).toBeVisible()
  expect(remoteRequests).toHaveLength(4)
  await animationPicker.press('Enter')
  await expect(animationPicker).toHaveValue('m_normal_walk01_f')
  await expect(
    page.locator('.preview-meta').getByText('m_normal_walk01_f', {
      exact: true,
    }),
  ).toBeVisible()
  expect(remoteRequests).toHaveLength(4)

  await animationPicker.click()
  await animationPicker.fill('not-an-animation')
  await expect(
    page.locator('.animation-picker [role="status"]'),
  ).toHaveText('검색 결과 없음')
  await animationPicker.press('Enter')
  await expect(
    page.locator('.preview-meta').getByText('m_normal_walk01_f', {
      exact: true,
    }),
  ).toBeVisible()
  expect(remoteRequests).toHaveLength(4)

  await animationPicker.fill('')
  await expect(
    page
      .locator('.animation-picker')
      .getByRole('option', { name: 'pose_default', exact: true }),
  ).toBeVisible()
  await expect(
    page.locator('.animation-picker').getByRole('option', { selected: true }),
  ).toContainText('m_normal_walk01_f')
  const activeOption = await animationPicker.getAttribute(
    'aria-activedescendant',
  )
  expect(activeOption).toBeTruthy()
  await animationPicker.press('ArrowDown')
  await expect(animationPicker).not.toHaveAttribute(
    'aria-activedescendant',
    activeOption ?? '',
  )
  expect(remoteRequests).toHaveLength(4)
  expectOnlyRemoteRequests(remoteGuard, [
    CUSTOM_CATALOG_URL,
    ...CUSTOM_MODEL_URLS,
  ])
})

test('prsk-chibi-viewer catalog option commit은 mocked viewer와 asset origin만 사용해 미리보기를 만든다', async ({
  page,
}) => {
  test.skip(!localAssetsReady, 'gitignore된 로컬 PRSK 렌더 자산이 없습니다.')

  const remoteGuard = await installRemoteRequestGuard(page)
  await routePrskChibiViewerCatalog(page)
  await routeLocalModelAssets(page, PJSEK_ASSET_BASE_URL)
  const remoteRequests = remoteGuard.requests

  await page.goto('/')
  expect(remoteRequests).toEqual([])
  await page.getByRole('button', { name: '불러오기' }).click()

  const characterPicker = page.getByRole('combobox', {
    name: '캐릭터 검색',
  })
  await expect(characterPicker).toBeEnabled()
  await characterPicker.click()
  await characterPicker.fill('MOB003')
  await page
    .getByRole('option', { name: CHARACTER_ID, exact: true })
    .click()

  await expectRemotePreviewReady(page)
  await expect(characterPicker).toHaveValue(CHARACTER_ID)
  expect(remoteRequests).toHaveLength(5)
  expect(
    remoteRequests.filter((url) =>
      url.startsWith('https://prsk-chibi-viewer.vercel.app/'),
    ),
  ).toHaveLength(2)
  expect(
    remoteRequests.filter((url) => url.startsWith(`${PJSEK_ASSET_BASE_URL}/`)),
  ).toHaveLength(3)
  expectOnlyRemoteRequests(remoteGuard, [
    PRSK_CHIBI_VIEWER_URL,
    PRSK_CHIBI_VIEWER_BUNDLE_URL,
    ...PJSEK_MODEL_URLS,
  ])
})
