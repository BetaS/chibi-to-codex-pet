import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test'
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
  type Entry,
  type FileEntry,
} from '@zip.js/zip.js'

import {
  CODEX_PET_ATLAS_HEIGHT,
  CODEX_PET_ATLAS_WIDTH,
  CODEX_PET_CELL_HEIGHT,
  CODEX_PET_CELL_WIDTH,
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_STATES,
} from '../src/features/codex-pet/contract'
import { CODEX_PET_SETTINGS_PRESET_STORAGE_KEY } from '../src/features/codex-pet/settingsPresets'

const sharedSkeletonPath = fileURLToPath(
  new URL('../assets/prsk/base_model/sekai_skeleton.skel', import.meta.url),
)
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const
const VISIBLE_ALPHA_THRESHOLD = 2
const CELL_SAFE_MARGIN_PX = 4
const MINIMUM_STANDARD_OCCUPANCY = 0.7

interface CharacterCase {
  readonly assetDirectoryName: string
  readonly atlasPath: string
  readonly texturePath: string
  readonly displayName: string
  readonly description: string
  readonly id: string
  readonly expectedMappings: readonly (readonly [string, string])[]
  readonly mappingOverrides: readonly (readonly [string, string])[]
}

function createCharacterCase({
  assetDirectoryName,
  displayName,
  id,
  idleAnimation,
  jumpingAnimation,
  mappingOverrides = [],
}: {
  readonly assetDirectoryName: string
  readonly displayName: string
  readonly id: string
  readonly idleAnimation: string
  readonly jumpingAnimation: string
  readonly mappingOverrides?: readonly (readonly [string, string])[]
}): CharacterCase {
  const assetRoot = fileURLToPath(
    new URL(`../assets/prsk/${assetDirectoryName}/`, import.meta.url),
  )

  return {
    assetDirectoryName,
    atlasPath: assetRoot + 'sekai_atlas.atlas',
    texturePath: assetRoot + 'sekai_atlas.png',
    displayName,
    description: `Local ${assetDirectoryName} Codex Pet verification`,
    id,
    mappingOverrides,
    expectedMappings: [
      ['대기', idleAnimation],
      ['오른쪽 이동', 'w_normal_walk01_f'],
      ['왼쪽 이동', 'w_normal_walk01_f'],
      ['인사', 'w_cute_joy01_f'],
      ['마우스 오버', jumpingAnimation],
      ['실패', 'w_happy_sad01_f'],
      ['응답 대기', 'w_happy_listen01_f'],
      ['작업 중', 'w_happy_doubt01_f'],
      ['검토 중', 'w_happy_doubt02_f'],
    ],
  }
}

const CHARACTER_CASES = [
  createCharacterCase({
    assetDirectoryName: 'sd_07airi_normal',
    displayName: 'Airi LiveSD',
    id: 'airi-livesd',
    idleAnimation: 'w_happy_idle01_f',
    jumpingAnimation: 'z_test_F_negi01',
  }),
  createCharacterCase({
    assetDirectoryName: 'sd_21miku_normal',
    displayName: 'Miku LiveSD',
    id: 'miku-livesd',
    idleAnimation: 'z_test_F_negi01',
    jumpingAnimation: 'w_happy_surprise01_f',
    mappingOverrides: [
      ['대기', 'z_test_F_negi01'],
      ['마우스 오버', 'w_happy_surprise01_f'],
    ],
  }),
] as const

interface DownloadedCodexPetPackage {
  readonly entries: ReadonlyMap<string, Uint8Array>
  readonly manifest: {
    readonly description: string
    readonly displayName: string
    readonly id: string
    readonly spriteVersionNumber: number
    readonly spritesheetPath: string
  }
  readonly spritesheet: Uint8Array
}

interface LookCellPixelAudit {
  readonly column: number
  readonly hash: string
  readonly index: number
  readonly nonTransparentPixelCount: number
  readonly row: number
}

interface CellAlphaBoundsAudit {
  readonly height: number
  readonly maxX: number
  readonly maxY: number
  readonly minX: number
  readonly minY: number
  readonly width: number
}

interface UsedCellAlphaAudit {
  readonly bounds: CellAlphaBoundsAudit | null
  readonly column: number
  readonly row: number
  readonly standard: boolean
  readonly stateId?: string
}

interface AtlasAlphaQualityAudit {
  readonly cells: readonly UsedCellAlphaAudit[]
  readonly standardOccupancy: number
  readonly standardUnion: CellAlphaBoundsAudit | null
}

async function createCharacterZip(character: CharacterCase): Promise<Buffer> {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
  })
  await writer.add(
    'nested/sekai_atlas.atlas',
    new Uint8ArrayReader(readFileSync(character.atlasPath)),
    { useWebWorkers: false },
  )
  await writer.add(
    'nested/sekai_atlas.png',
    new Uint8ArrayReader(readFileSync(character.texturePath)),
    { useWebWorkers: false },
  )
  return Buffer.from(await writer.close())
}

function isFileEntry(entry: Entry): entry is FileEntry {
  return !entry.directory
}

function assertSafePetEntryPath(filename: string, petId: string): void {
  expect(filename).not.toContain('\0')
  expect(filename).not.toContain('\\')
  expect(filename).not.toMatch(/^\//)
  expect(filename).not.toMatch(/^[a-zA-Z]:/)

  const segments = filename.split('/')
  expect(segments).toHaveLength(2)
  expect(segments[0]).toBe(petId)
  expect(segments.every((segment) => segment !== '.' && segment !== '..')).toBe(
    true,
  )
}

async function inspectDownloadedPackage(
  archiveBytes: Uint8Array,
  character: CharacterCase,
): Promise<DownloadedCodexPetPackage> {
  const reader = new ZipReader(new Uint8ArrayReader(archiveBytes), {
    useWebWorkers: false,
  })

  try {
    const entries = await reader.getEntries()
    expect(entries.every(isFileEntry)).toBe(true)
    const fileEntries = entries.filter(isFileEntry)
    expect(fileEntries.map((entry) => entry.filename).sort()).toEqual([
      character.id + '/pet.json',
      character.id + '/spritesheet.png',
    ])

    const contents = new Map<string, Uint8Array>()
    for (const entry of fileEntries) {
      assertSafePetEntryPath(entry.filename, character.id)
      expect(entry.encrypted).toBe(false)
      const bytes = await entry.getData(new Uint8ArrayWriter(), {
        useWebWorkers: false,
      })
      contents.set(entry.filename, bytes)
    }

    const manifestBytes = contents.get(character.id + '/pet.json')
    const spritesheet = contents.get(character.id + '/spritesheet.png')
    expect(manifestBytes, 'pet.json ZIP entry').toBeDefined()
    expect(spritesheet, 'spritesheet.png ZIP entry').toBeDefined()

    const manifest = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes),
    ) as DownloadedCodexPetPackage['manifest']
    expect(manifest).toEqual({
      description: character.description,
      displayName: character.displayName,
      id: character.id,
      spriteVersionNumber: 2,
      spritesheetPath: 'spritesheet.png',
    })

    const png = Buffer.from(spritesheet!)
    expect([...png.subarray(0, PNG_SIGNATURE.length)]).toEqual(PNG_SIGNATURE)
    expect(png.readUInt32BE(16)).toBe(CODEX_PET_ATLAS_WIDTH)
    expect(png.readUInt32BE(20)).toBe(CODEX_PET_ATLAS_HEIGHT)

    return {
      entries: contents,
      manifest,
      spritesheet: spritesheet!,
    }
  } finally {
    await reader.close()
  }
}

async function generateAndDownloadPackage(
  page: Page,
  character: CharacterCase,
): Promise<DownloadedCodexPetPackage> {
  await page.getByRole('button', { name: 'Codex Pet 생성' }).click()

  const downloadLink = page.getByRole('link', {
    name: 'Codex Pet ZIP 다운로드',
  })
  await expect(downloadLink).toBeVisible({ timeout: 120_000 })
  const downloadPromise = page.waitForEvent('download')
  await downloadLink.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(
    character.id + '.codex-pet.zip',
  )
  expect(await download.failure()).toBeNull()
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()

  return inspectDownloadedPackage(readFileSync(downloadedPath!), character)
}

function installValidatedPackage(
  packageContents: DownloadedCodexPetPackage,
  petsRoot: string,
  petId: string,
): string {
  const resolvedRoot = resolve(petsRoot)
  const plannedWrites = [...packageContents.entries].map(
    ([filename, contents]) => {
      assertSafePetEntryPath(filename, petId)
      const destination = resolve(resolvedRoot, filename)
      const relativeDestination = relative(resolvedRoot, destination)
      expect(relativeDestination).not.toBe('')
      expect(relativeDestination).not.toBe('..')
      expect(relativeDestination.startsWith('..' + sep)).toBe(false)
      expect(resolve(destination).startsWith(resolvedRoot + sep)).toBe(true)
      return { contents, destination }
    },
  )

  mkdirSync(resolvedRoot, { recursive: true })
  for (const { contents, destination } of plannedWrites) {
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, contents)
  }

  return resolve(resolvedRoot, petId)
}

async function loadLocalCharacter(
  page: Page,
  character: CharacterCase,
): Promise<void> {
  await page.goto('/')
  await page.getByRole('radio', { name: '리소스 업로드' }).check()

  await page.locator('input[type="file"]').nth(0).setInputFiles({
    name: 'sekai_skeleton.skel',
    mimeType: 'application/octet-stream',
    buffer: readFileSync(sharedSkeletonPath),
  })
  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name: character.assetDirectoryName + '.zip',
    mimeType: 'application/zip',
    buffer: await createCharacterZip(character),
  })
  await page.getByRole('button', { name: '가져와서 미리보기' }).click()

  await expect(
    page.getByRole('heading', {
      name: character.assetDirectoryName + '.zip',
      exact: true,
    }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole('heading', { name: 'Codex Pet 패키징' }),
  ).toBeVisible()
}

async function hashRenderedSpritesheet(sprite: Locator): Promise<{
  readonly hash: string
  readonly height: number
  readonly width: number
}> {
  return sprite.evaluate(async (element) => {
    const backgroundImage = getComputedStyle(element).backgroundImage
    const match = /^url\(["']?(.*?)["']?\)$/.exec(backgroundImage)
    if (!match?.[1]) {
      throw new Error('installed preview background image URL is missing')
    }

    const response = await fetch(match[1])
    if (!response.ok) {
      throw new Error('installed preview spritesheet could not be fetched')
    }
    const bytes = await response.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: 'image/png' }),
    )
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return { ...dimensions, hash }
  })
}

async function auditLookCells(
  sprite: Locator,
): Promise<readonly LookCellPixelAudit[]> {
  return sprite.evaluate(
    async (element, auditPlan) => {
      const backgroundImage = getComputedStyle(element).backgroundImage
      const match = /^url\(["']?(.*?)["']?\)$/.exec(backgroundImage)
      if (!match?.[1]) {
        throw new Error('installed preview background image URL is missing')
      }

      const response = await fetch(match[1])
      if (!response.ok) {
        throw new Error('installed preview spritesheet could not be fetched')
      }

      const bitmap = await createImageBitmap(
        new Blob([await response.arrayBuffer()], { type: 'image/png' }),
      )
      const canvas = document.createElement('canvas')
      canvas.width = auditPlan.cellWidth
      canvas.height = auditPlan.cellHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        bitmap.close()
        throw new Error('look-cell audit canvas is unavailable')
      }

      try {
        const results = []
        for (const direction of auditPlan.directions) {
          context.clearRect(0, 0, auditPlan.cellWidth, auditPlan.cellHeight)
          context.drawImage(
            bitmap,
            direction.column * auditPlan.cellWidth,
            direction.row * auditPlan.cellHeight,
            auditPlan.cellWidth,
            auditPlan.cellHeight,
            0,
            0,
            auditPlan.cellWidth,
            auditPlan.cellHeight,
          )

          const imageData = context.getImageData(
            0,
            0,
            auditPlan.cellWidth,
            auditPlan.cellHeight,
          )
          let nonTransparentPixelCount = 0
          for (let offset = 3; offset < imageData.data.length; offset += 4) {
            if (imageData.data[offset] !== 0) {
              nonTransparentPixelCount += 1
            }
          }

          const rgbaBytes = Uint8Array.from(imageData.data)
          const digest = await crypto.subtle.digest('SHA-256', rgbaBytes)
          results.push({
            column: direction.column,
            hash: [...new Uint8Array(digest)]
              .map((value) => value.toString(16).padStart(2, '0'))
              .join(''),
            index: direction.index,
            nonTransparentPixelCount,
            row: direction.row,
          })
        }
        return results
      } finally {
        bitmap.close()
      }
    },
    {
      cellHeight: CODEX_PET_CELL_HEIGHT,
      cellWidth: CODEX_PET_CELL_WIDTH,
      directions: CODEX_PET_LOOK_DIRECTIONS.map(
        ({ column, index, row }) => ({ column, index, row }),
      ),
    },
  )
}

async function auditUsedCellAlphaQuality(
  sprite: Locator,
): Promise<AtlasAlphaQualityAudit> {
  return sprite.evaluate(
    async (element, auditPlan) => {
      const backgroundImage = getComputedStyle(element).backgroundImage
      const match = /^url\(["']?(.*?)["']?\)$/.exec(backgroundImage)
      if (!match?.[1]) {
        throw new Error('installed preview background image URL is missing')
      }

      const response = await fetch(match[1])
      if (!response.ok) {
        throw new Error('installed preview spritesheet could not be fetched')
      }

      const bitmap = await createImageBitmap(
        new Blob([await response.arrayBuffer()], { type: 'image/png' }),
      )
      const canvas = document.createElement('canvas')
      canvas.width = auditPlan.cellWidth
      canvas.height = auditPlan.cellHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        bitmap.close()
        throw new Error('alpha-quality audit canvas is unavailable')
      }

      try {
        const cells = []
        let standardUnion: {
          minX: number
          minY: number
          maxX: number
          maxY: number
        } | null = null

        for (const cell of auditPlan.cells) {
          context.clearRect(0, 0, auditPlan.cellWidth, auditPlan.cellHeight)
          context.drawImage(
            bitmap,
            cell.column * auditPlan.cellWidth,
            cell.row * auditPlan.cellHeight,
            auditPlan.cellWidth,
            auditPlan.cellHeight,
            0,
            0,
            auditPlan.cellWidth,
            auditPlan.cellHeight,
          )
          const rgba = context.getImageData(
            0,
            0,
            auditPlan.cellWidth,
            auditPlan.cellHeight,
          ).data
          let minX = auditPlan.cellWidth
          let minY = auditPlan.cellHeight
          let maxX = -1
          let maxY = -1
          for (let y = 0; y < auditPlan.cellHeight; y += 1) {
            for (let x = 0; x < auditPlan.cellWidth; x += 1) {
              const alpha = rgba[(y * auditPlan.cellWidth + x) * 4 + 3]
              if (alpha === undefined || alpha < auditPlan.alphaThreshold) {
                continue
              }
              minX = Math.min(minX, x)
              minY = Math.min(minY, y)
              maxX = Math.max(maxX, x)
              maxY = Math.max(maxY, y)
            }
          }

          const bounds =
            maxX < 0
              ? null
              : {
                  minX,
                  minY,
                  maxX,
                  maxY,
                  width: maxX - minX + 1,
                  height: maxY - minY + 1,
                }
          if (cell.standard && bounds) {
            standardUnion = standardUnion
              ? {
                  minX: Math.min(standardUnion.minX, bounds.minX),
                  minY: Math.min(standardUnion.minY, bounds.minY),
                  maxX: Math.max(standardUnion.maxX, bounds.maxX),
                  maxY: Math.max(standardUnion.maxY, bounds.maxY),
                }
              : {
                  minX: bounds.minX,
                  minY: bounds.minY,
                  maxX: bounds.maxX,
                  maxY: bounds.maxY,
                }
          }
          cells.push({ ...cell, bounds })
        }

        const measuredStandardUnion = standardUnion
          ? {
              ...standardUnion,
              width: standardUnion.maxX - standardUnion.minX + 1,
              height: standardUnion.maxY - standardUnion.minY + 1,
            }
          : null
        return {
          cells,
          standardUnion: measuredStandardUnion,
          standardOccupancy: measuredStandardUnion
            ? Math.max(
                measuredStandardUnion.width / auditPlan.cellWidth,
                measuredStandardUnion.height / auditPlan.cellHeight,
              )
            : 0,
        }
      } finally {
        bitmap.close()
      }
    },
    {
      alphaThreshold: VISIBLE_ALPHA_THRESHOLD,
      cellHeight: CODEX_PET_CELL_HEIGHT,
      cellWidth: CODEX_PET_CELL_WIDTH,
      cells: [
        ...CODEX_PET_STATES.flatMap((state) =>
          Array.from({ length: state.frameCount }, (_, column) => ({
            column,
            row: state.row,
            standard: true,
            stateId: state.id,
          })),
        ),
        ...CODEX_PET_LOOK_DIRECTIONS.map(({ column, row }) => ({
          column,
          row,
          standard: false,
        })),
      ],
    },
  )
}

async function verifyAllLookDirections(
  page: Page,
  stage: Locator,
  sprite: Locator,
  statePicker: Locator,
  testInfo: TestInfo,
  character: CharacterCase,
): Promise<void> {
  await statePicker.selectOption('review')
  await statePicker.hover()
  await expect(sprite).toHaveAttribute('data-pet-state', 'review')
  await expect(sprite).toHaveAttribute('data-atlas-row', '8')

  const spriteBox = await sprite.boundingBox()
  expect(spriteBox, 'installed preview sprite bounds').not.toBeNull()
  const centerX = spriteBox!.x + spriteBox!.width / 2
  const centerY = spriteBox!.y + spriteBox!.height / 2
  const pointerRadius = Math.min(spriteBox!.width, spriteBox!.height) * 0.25

  for (const direction of CODEX_PET_LOOK_DIRECTIONS) {
    const angleRadians = (direction.angleDegrees * Math.PI) / 180
    await page.mouse.move(
      centerX + Math.sin(angleRadians) * pointerRadius,
      centerY - Math.cos(angleRadians) * pointerRadius,
    )
    await expect(sprite).toHaveAttribute(
      'data-look-direction-index',
      String(direction.index),
    )
    await expect(sprite).toHaveAttribute(
      'data-atlas-row',
      String(direction.row),
    )
    await expect(sprite).toHaveAttribute(
      'data-atlas-column',
      String(direction.column),
    )

    await testInfo.attach(
      `installed-${character.id}-look-${String(direction.index).padStart(2, '0')}`,
      {
        body: await sprite.screenshot(),
        contentType: 'image/png',
      },
    )
  }

  // The stage owns look selection, so dispatching its exact sprite centre
  // exercises the one-pixel dead zone without changing the real hover target.
  await stage.dispatchEvent('pointermove', {
    clientX: centerX,
    clientY: centerY,
    pointerType: 'mouse',
  })
  await expect(sprite).not.toHaveAttribute('data-look-direction-index')
  await expect(sprite).toHaveAttribute('data-pet-state', 'jumping')
  await expect(sprite).toHaveAttribute('data-atlas-row', '4')

  await statePicker.hover()
  await expect(sprite).not.toHaveAttribute('data-look-direction-index')
  await expect(sprite).toHaveAttribute('data-pet-state', 'review')
  await expect(sprite).toHaveAttribute('data-atlas-row', '8')

  // A direct dead-zone event while the pointer is outside the sprite must also
  // preserve the selected standard state rather than selecting a look cell.
  await stage.dispatchEvent('pointermove', {
    clientX: centerX,
    clientY: centerY,
    pointerType: 'mouse',
  })
  await expect(sprite).not.toHaveAttribute('data-look-direction-index')
  await expect(sprite).toHaveAttribute('data-pet-state', 'review')
  await expect(sprite).toHaveAttribute('data-atlas-row', '8')
  await statePicker.hover()
}

async function captureVisibleSprite(
  sprite: Locator,
  stateId: string,
  testInfo: TestInfo,
  character: CharacterCase,
): Promise<Buffer> {
  const rendered = await sprite.screenshot()
  const inlineBackground = await sprite.evaluate(
    (element) => (element as HTMLElement).style.backgroundImage,
  )
  let withoutSpritesheet: Buffer
  try {
    await sprite.evaluate((element) => {
      ;(element as HTMLElement).style.backgroundImage = 'none'
    })
    withoutSpritesheet = await sprite.screenshot()
  } finally {
    await sprite.evaluate((element, backgroundImage) => {
      ;(element as HTMLElement).style.backgroundImage = backgroundImage
    }, inlineBackground)
  }

  expect(
    rendered.equals(withoutSpritesheet),
    `${stateId} row must paint non-transparent ${character.displayName} pixels`,
  ).toBe(false)
  await testInfo.attach(`installed-${character.id}-${stateId}`, {
    body: rendered,
    contentType: 'image/png',
  })
  return rendered
}

async function verifyLiveSpineMappingAndPointerPreview(
  page: Page,
  character: CharacterCase,
  testInfo: TestInfo,
): Promise<void> {
  const previewCanvas = page.getByLabel('LiveSD WebGL 미리보기')
  const previewMeta = page.locator('.preview-meta')

  for (const [label, animation] of character.expectedMappings) {
    await page
      .getByRole('combobox', {
        name: label + ' 애니메이션',
        exact: true,
      })
      .focus()
    await expect(
      previewMeta.getByText(animation, { exact: true }),
    ).toBeVisible()
  }

  const animationPicker = page.getByRole('combobox', {
    name: '애니메이션',
    exact: true,
  })
  await animationPicker.click()
  await animationPicker.fill('pose_default')
  await page
    .locator('.animation-picker')
    .getByRole('option', { name: 'pose_default', exact: true })
    .click()
  await expect(
    previewMeta.getByText('pose_default', { exact: true }),
  ).toBeVisible()

  const lookMovementSlider = page.getByRole('slider', {
    name: '눈 이동량 슬라이더',
  })
  await lookMovementSlider.press('End')
  const canvasBox = await previewCanvas.boundingBox()
  if (!canvasBox) {
    throw new Error('Live Spine preview canvas has no layout box')
  }

  await previewCanvas.hover({
    position: { x: canvasBox.width * 0.15, y: canvasBox.height / 2 },
  })
  const lookingLeft = await previewCanvas.screenshot()
  let lookingRight: Buffer | null = null
  await previewCanvas.hover({
    position: { x: canvasBox.width * 0.85, y: canvasBox.height / 2 },
  })
  await expect
    .poll(async () => {
      const screenshot = await previewCanvas.screenshot()
      if (screenshot.equals(lookingLeft)) {
        return false
      }
      lookingRight = screenshot
      return true
    })
    .toBe(true)

  await testInfo.attach(`${character.id}-spine-look-left`, {
    body: lookingLeft,
    contentType: 'image/png',
  })
  await testInfo.attach(`${character.id}-spine-look-right`, {
    body: lookingRight ?? await previewCanvas.screenshot(),
    contentType: 'image/png',
  })
  await page.mouse.move(0, 0)
  await page
    .getByRole('button', { name: '100%로 초기화', exact: true })
    .click()
}

for (const character of CHARACTER_CASES) {
  test(
    `${character.assetDirectoryName}을 실제 v2 Codex Pet ZIP으로 다운로드·설치하고 상태·시선을 렌더링한다`,
    async ({ page }, testInfo) => {
      test.setTimeout(240_000)
      const localAssetsReady =
        existsSync(character.atlasPath) &&
        existsSync(character.texturePath) &&
        existsSync(sharedSkeletonPath)
      test.skip(
        !localAssetsReady,
        `gitignore된 로컬 ${character.assetDirectoryName} 자산이 없습니다.`,
      )

      const externalRequests: string[] = []
      page.on('request', (request) => {
        const url = new URL(request.url())
        if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
          externalRequests.push(request.url())
        }
      })

      await loadLocalCharacter(page, character)

      for (const [label, animation] of character.mappingOverrides) {
        const mappingCombobox = page.getByRole('combobox', {
          name: label + ' 애니메이션',
          exact: true,
        })
        await mappingCombobox.click()
        await mappingCombobox.fill(animation)
        await page
          .getByRole('option', { name: animation, exact: true })
          .click()
      }

      const actualMappings = Object.fromEntries(
        await Promise.all(
          character.expectedMappings.map(async ([label]) => [
            label,
            await page
              .getByRole('combobox', {
                name: label + ' 애니메이션',
                exact: true,
              })
              .inputValue(),
          ]),
        ),
      )
      expect(actualMappings).toEqual(
        Object.fromEntries(character.expectedMappings),
      )
      await verifyLiveSpineMappingAndPointerPreview(
        page,
        character,
        testInfo,
      )
      await expect(
        page.getByRole('checkbox', { name: '전체 캐릭터 수평 반전' }),
      ).not.toBeChecked()
      await expect(
        page.getByRole('checkbox', { name: '오른쪽 이동 수평 반전' }),
      ).toBeChecked()
      await expect(
        page.getByRole('checkbox', { name: '왼쪽 이동 수평 반전' }),
      ).not.toBeChecked()

      await page
        .getByRole('textbox', { name: 'Pet 이름' })
        .fill(character.displayName)
      await page
        .getByRole('textbox', { name: 'Pet 설명' })
        .fill(character.description)
      const framingScaleSlider = page.getByRole('slider', {
        name: 'Pet 크기 슬라이더',
      })
      await expect(framingScaleSlider).toHaveValue('100')
      await expect(framingScaleSlider).toHaveAttribute('max', '150')
      await expect(framingScaleSlider).toHaveAttribute(
        'aria-valuetext',
        '100%',
      )
      const framingOffsetX = page.getByRole('slider', {
        name: '가로 cell 위치',
      })
      const framingOffsetY = page.getByRole('slider', {
        name: '세로 cell 위치',
      })
      await expect(framingOffsetX).toHaveValue('0')
      await expect(framingOffsetY).toHaveValue('0')
      await framingOffsetX.press('ArrowRight')
      await framingOffsetY.press('ArrowDown')
      await expect(framingOffsetX).toHaveValue('1')
      await expect(framingOffsetY).toHaveValue('-1')
      await page.getByRole('button', { name: '프레이밍 초기화' }).click()
      await expect(framingOffsetX).toHaveValue('0')
      await expect(framingOffsetY).toHaveValue('0')
      await expect(page.getByTestId('livesd-preview-border-box')).toBeVisible()
      const lookMovementSlider = page.getByRole('slider', {
        name: '눈 이동량 슬라이더',
      })
      await expect(lookMovementSlider).toHaveValue('100')
      await expect(lookMovementSlider).toHaveAttribute(
        'aria-valuetext',
        '100%',
      )
      await lookMovementSlider.press('End')
      await expect(lookMovementSlider).toHaveValue('150')
      await page
        .getByRole('button', { name: '100%로 초기화', exact: true })
        .click()
      await expect(lookMovementSlider).toHaveValue('100')

      let automaticAlphaQuality: AtlasAlphaQualityAudit | null = null
      let automaticSpritesheetHash: string | null = null
      const downloadLink = page.getByRole('link', {
        name: 'Codex Pet ZIP 다운로드',
      })
      const generatedSprite = page.locator('.codex-pet-sprite')
      if (character.id === 'airi-livesd') {
        const automaticPackage = await generateAndDownloadPackage(
          page,
          character,
        )
        automaticSpritesheetHash = createHash('sha256')
          .update(automaticPackage.spritesheet)
          .digest('hex')
        await expect(generatedSprite).toBeVisible()
        automaticAlphaQuality = await auditUsedCellAlphaQuality(
          generatedSprite,
        )
        expect(automaticAlphaQuality.standardOccupancy).toBeGreaterThanOrEqual(
          MINIMUM_STANDARD_OCCUPANCY,
        )
        expect(automaticAlphaQuality.standardUnion).not.toBeNull()

        await framingScaleSlider.press('Home')
        await expect(framingScaleSlider).toHaveValue('80')
        await expect(framingScaleSlider).toHaveAttribute(
          'aria-valuetext',
          '80%',
        )
        await expect(downloadLink).toHaveCount(0)
        await expect(generatedSprite).toHaveCount(0)
        await expect(
          page.getByRole('textbox', { name: 'Pet 이름' }),
        ).toHaveValue(character.displayName)
        await expect(
          page.getByRole('combobox', {
            name: '마우스 오버 애니메이션',
            exact: true,
          }),
        ).toHaveValue('z_test_F_negi01')
      }

      const packageContents = await generateAndDownloadPackage(page, character)
      await expect(
        page.getByRole('combobox', { name: '저장 프리셋' }),
      ).toHaveValue(character.displayName)
      const storedCatalog = await page.evaluate((storageKey) => {
        const stored = window.localStorage.getItem(storageKey)
        return stored ? JSON.parse(stored) : null
      }, CODEX_PET_SETTINGS_PRESET_STORAGE_KEY) as {
        readonly activePresetName: string | null
        readonly presets: Readonly<Record<string, Record<string, unknown>>>
      } | null
      expect(storedCatalog?.activePresetName).toBe(character.displayName)
      expect(
        Object.keys(storedCatalog?.presets[character.displayName] ?? {}).sort(),
      ).toEqual([
        'description',
        'displayName',
        'framingOffset',
        'framingScale',
        'globalMirrorX',
        'lookMovementScale',
        'mappings',
        'source',
        'updatedAt',
      ])
      expect(
        storedCatalog?.presets[character.displayName]?.source,
      ).toBeNull()

      const explicitInstallRoot = process.env.CODEX_PET_INSTALL_ROOT?.trim()
      const isolatedPetsRoot =
        explicitInstallRoot || testInfo.outputPath('codex-home', 'pets')
      const installedDirectory = installValidatedPackage(
        packageContents,
        isolatedPetsRoot,
        character.id,
      )
      const installedManifest = readFileSync(
        resolve(installedDirectory, 'pet.json'),
        'utf-8',
      )
      const installedSpritesheet = readFileSync(
        resolve(installedDirectory, 'spritesheet.png'),
      )
      expect(JSON.parse(installedManifest)).toEqual(packageContents.manifest)
      expect(
        installedSpritesheet.equals(Buffer.from(packageContents.spritesheet)),
      ).toBe(true)

      const statePicker = page.getByRole('combobox', {
        name: '설치 미리보기 상태',
      })
      const sprite = page.locator('.codex-pet-sprite')
      await expect(statePicker).toBeVisible()
      await expect(sprite).toBeVisible()
      await expect(page.getByTestId('codex-pet-border-box')).toBeVisible()
      await expect(sprite).toHaveAttribute('data-sprite-version', '2')
      const spriteBox = await sprite.boundingBox()
      expect(spriteBox?.width).toBeGreaterThan(0)
      expect(spriteBox?.height).toBeGreaterThan(0)

      const renderedSpritesheet = await hashRenderedSpritesheet(sprite)
      expect(renderedSpritesheet).toEqual({
        width: CODEX_PET_ATLAS_WIDTH,
        height: CODEX_PET_ATLAS_HEIGHT,
        hash: createHash('sha256').update(installedSpritesheet).digest('hex'),
      })

      const alphaQuality = await auditUsedCellAlphaQuality(sprite)
      const expectedUsedCellCount =
        CODEX_PET_STATES.reduce(
          (total, state) => total + state.frameCount,
          0,
        ) + CODEX_PET_LOOK_DIRECTIONS.length
      expect(alphaQuality.cells).toHaveLength(expectedUsedCellCount)
      for (const cell of alphaQuality.cells) {
        expect(
          cell.bounds,
          `row ${cell.row}, column ${cell.column} must have alpha >= ${VISIBLE_ALPHA_THRESHOLD}`,
        ).not.toBeNull()
        const bounds = cell.bounds!
        expect(
          bounds.minX,
          `row ${cell.row}, column ${cell.column} left safety margin`,
        ).toBeGreaterThanOrEqual(CELL_SAFE_MARGIN_PX)
        expect(
          bounds.minY,
          `row ${cell.row}, column ${cell.column} top safety margin`,
        ).toBeGreaterThanOrEqual(CELL_SAFE_MARGIN_PX)
        expect(
          bounds.maxX,
          `row ${cell.row}, column ${cell.column} right safety margin`,
        ).toBeLessThan(CODEX_PET_CELL_WIDTH - CELL_SAFE_MARGIN_PX)
        expect(
          bounds.maxY,
          `row ${cell.row}, column ${cell.column} bottom safety margin`,
        ).toBeLessThan(CODEX_PET_CELL_HEIGHT - CELL_SAFE_MARGIN_PX)
      }
      expect(alphaQuality.standardUnion).not.toBeNull()
      expect(alphaQuality.standardOccupancy).toBeGreaterThanOrEqual(
        MINIMUM_STANDARD_OCCUPANCY,
      )
      if (automaticAlphaQuality) {
        const automaticUnion = automaticAlphaQuality.standardUnion
        const scaledUnion = alphaQuality.standardUnion
        if (!automaticUnion || !scaledUnion || !automaticSpritesheetHash) {
          throw new Error('Airi framing-scale comparison bounds are missing')
        }

        const widthRatio = scaledUnion.width / automaticUnion.width
        const heightRatio = scaledUnion.height / automaticUnion.height
        const occupancyRatio =
          alphaQuality.standardOccupancy /
          automaticAlphaQuality.standardOccupancy
        expect(widthRatio).toBeGreaterThanOrEqual(0.77)
        expect(widthRatio).toBeLessThanOrEqual(0.83)
        expect(heightRatio).toBeGreaterThanOrEqual(0.77)
        expect(heightRatio).toBeLessThanOrEqual(0.83)
        expect(occupancyRatio).toBeGreaterThanOrEqual(0.77)
        expect(occupancyRatio).toBeLessThanOrEqual(0.83)
        expect(Math.abs(scaledUnion.maxY - automaticUnion.maxY)).toBeLessThanOrEqual(
          2,
        )
        expect(
          createHash('sha256')
            .update(packageContents.spritesheet)
            .digest('hex'),
        ).not.toBe(automaticSpritesheetHash)
        await testInfo.attach('airi-framing-scale-comparison', {
          body: Buffer.from(
            JSON.stringify(
              {
                automatic: automaticAlphaQuality,
                scaled: alphaQuality,
                ratios: { heightRatio, occupancyRatio, widthRatio },
              },
              null,
              2,
            ),
          ),
          contentType: 'application/json',
        })
      }
      await testInfo.attach(`installed-${character.id}-alpha-quality`, {
        body: Buffer.from(JSON.stringify(alphaQuality, null, 2)),
        contentType: 'application/json',
      })

      const lookCellAudit = await auditLookCells(sprite)
      expect(lookCellAudit).toHaveLength(CODEX_PET_LOOK_DIRECTIONS.length)
      for (const cell of lookCellAudit) {
        expect(
          cell.nonTransparentPixelCount,
          `look ${cell.index} at row ${cell.row}, column ${cell.column} must contain rendered pixels`,
        ).toBeGreaterThan(0)
      }
      expect(
        new Set(lookCellAudit.map((cell) => cell.hash)).size,
      ).toBeGreaterThanOrEqual(12)
      expect(
        new Set([0, 4, 8, 12].map((index) => lookCellAudit[index]?.hash)).size,
      ).toBe(4)

      await statePicker.selectOption('idle')
      await sprite.hover()
      await expect(sprite).toHaveAttribute('data-pet-state', 'jumping')
      await expect(statePicker).toHaveValue('idle')
      await statePicker.hover()
      await expect(sprite).toHaveAttribute('data-pet-state', 'idle')

      const stage = page.getByTestId('codex-pet-preview-stage')
      await expect(stage).toBeVisible()
      await verifyAllLookDirections(
        page,
        stage,
        sprite,
        statePicker,
        testInfo,
        character,
      )

      for (const state of CODEX_PET_STATES) {
        await statePicker.selectOption(state.id)
        await expect(sprite).toHaveAttribute('data-pet-state', state.id)
        const initialFrame = await sprite.getAttribute('data-frame-index')
        const initialScreenshot = await captureVisibleSprite(
          sprite,
          state.id,
          testInfo,
          character,
        )
        let changedScreenshot: Buffer | undefined
        await expect
          .poll(
            async () => {
              const nextFrame = await sprite.getAttribute('data-frame-index')
              if (nextFrame === initialFrame) {
                return false
              }
              const screenshot = await sprite.screenshot()
              if (screenshot.equals(initialScreenshot)) {
                return false
              }
              changedScreenshot = screenshot
              return true
            },
            {
              message: `${state.id} renderer should advance to a visibly different frame`,
              timeout: 8_000,
            },
          )
          .toBe(true)
        expect(changedScreenshot).toBeDefined()
      }
      expect(externalRequests).toEqual([])
    },
  )
}
