import { createHash, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { access, lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { constants as fsConstants, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

import {
  decodeCodexPetRecipe,
  parseCodexPetRecipe,
  type CodexPetRecipe,
  CodexPetRecipeError,
} from '../../../src/features/codex-pet/recipe'
import {
  CODEX_PET_SPRITE_VERSION,
  CODEX_PET_SPRITESHEET_FILENAME,
  isSafeCodexPetId,
} from '../../../src/features/codex-pet/manifest'

function readCliVersion(): string {
  const metadata: unknown = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  )
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    !('version' in metadata) ||
    typeof metadata.version !== 'string' ||
    metadata.version.length === 0
  ) {
    throw new Error('CLI package metadata version is invalid.')
  }
  return metadata.version
}

const CLI_VERSION = readCliVersion()
const PACKAGE_NAME = 'chibi-to-codex-pet'
const BIN_NAME = 'chibi-to-codex-pet'
const RECIPE_URL_MAX_BYTES = 64 * 1024
const RECIPE_URL_TIMEOUT_MS = 20_000
const RENDER_TIMEOUT_MS = 180_000

type ExitCode = 0 | 2 | 3 | 4 | 5

interface InstallOptions {
  readonly codexHome?: string
  readonly dryRun: boolean
  readonly force: boolean
  readonly recipe: string
}

interface RenderResult {
  readonly filename: string
  readonly manifestId: string
  readonly petJson: string
  readonly spritesheetBase64: string
}

interface PetPayload {
  readonly id: string
  readonly petJson: Buffer
  readonly spritesheet: Buffer
}

class CliError extends Error {
  readonly code: string
  readonly exitCode: ExitCode

  constructor(code: string, exitCode: ExitCode, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'CliError'
    this.code = code
    this.exitCode = exitCode
  }
}

function cliError(
  code: string,
  exitCode: ExitCode,
  message: string,
  cause?: unknown,
): never {
  throw new CliError(code, exitCode, message, cause)
}

function usage(): string {
  return [
    `${BIN_NAME} ${CLI_VERSION}`,
    '',
    'Usage:',
    `  npx -y ${PACKAGE_NAME} install --recipe <recipe> [--codex-home <absolute-path>] [--dry-run] [--force]`,
    `  npx -y ${PACKAGE_NAME} --help`,
    `  npx -y ${PACKAGE_NAME} --version`,
    '',
    'Recipe:',
    '  base64url JSON, raw JSON, or HTTPS URL returning recipe JSON.',
    '',
    'Browser:',
    '  Set CHIBI_TO_CODEX_PET_CHROMIUM to a Chromium/Chrome executable when auto-discovery fails.',
  ].join('\n')
}

function parseArgs(argv: readonly string[]): InstallOptions | 'help' | 'version' {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return 'help'
  }
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v')) {
    return 'version'
  }
  if (argv[0] !== 'install') {
    cliError('CLI_USAGE_INVALID', 2, '지원하지 않는 명령입니다. install --recipe를 사용하세요.')
  }

  let codexHome: string | undefined
  let dryRun = false
  let force = false
  let recipe: string | undefined

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg === '--force') {
      force = true
      continue
    }
    if (arg === '--codex-home') {
      const value = argv[index + 1]
      if (!value) {
        cliError('CLI_USAGE_INVALID', 2, '--codex-home에는 absolute path가 필요합니다.')
      }
      codexHome = value
      index += 1
      continue
    }
    if (arg === '--recipe') {
      const value = argv[index + 1]
      if (!value) {
        cliError('CLI_USAGE_INVALID', 2, '--recipe 값이 필요합니다.')
      }
      if (recipe !== undefined) {
        cliError('CLI_USAGE_INVALID', 2, '--recipe는 한 번만 지정할 수 있습니다.')
      }
      recipe = value
      index += 1
      continue
    }
    cliError('CLI_USAGE_INVALID', 2, `알 수 없는 옵션입니다: ${arg}`)
  }

  if (!recipe) {
    cliError('CLI_USAGE_INVALID', 2, 'install에는 --recipe가 필요합니다.')
  }
  return { codexHome, dryRun, force, recipe }
}

function isHttpsRecipeUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

async function readLimitedRecipeResponse(response: Response): Promise<string> {
  const body = response.body
  if (!body) {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > RECIPE_URL_MAX_BYTES) {
      cliError('RECIPE_URL_TOO_LARGE', 2, 'recipe URL 응답이 너무 큽니다.')
    }
    return text
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    total += value.byteLength
    if (total > RECIPE_URL_MAX_BYTES) {
      await reader.cancel().catch(() => undefined)
      cliError('RECIPE_URL_TOO_LARGE', 2, 'recipe URL 응답이 너무 큽니다.')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

async function loadRecipe(recipeArgument: string): Promise<CodexPetRecipe> {
  if (!isHttpsRecipeUrl(recipeArgument)) {
    try {
      return decodeCodexPetRecipe(recipeArgument)
    } catch (error) {
      if (error instanceof CodexPetRecipeError) {
        cliError(error.code, 2, error.message, error)
      }
      throw error
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RECIPE_URL_TIMEOUT_MS)
  try {
    const response = await fetch(recipeArgument, {
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) {
      cliError('RECIPE_URL_HTTP', 2, `recipe URL 요청이 HTTP ${response.status}로 실패했습니다.`)
    }
    const text = await readLimitedRecipeResponse(response)
    try {
      return parseCodexPetRecipe(JSON.parse(text))
    } catch (error) {
      if (error instanceof CodexPetRecipeError) {
        cliError(error.code, 2, error.message, error)
      }
      cliError('RECIPE_INVALID', 2, 'recipe URL이 올바른 JSON을 반환하지 않았습니다.', error)
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error
    }
    cliError('RECIPE_URL_FETCH_FAILED', 2, 'recipe URL을 불러오지 못했습니다.', error)
  } finally {
    clearTimeout(timeout)
  }
}

function rendererRoot(): string {
  return fileURLToPath(new URL('../renderer/', import.meta.url))
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8'
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.md':
      return 'text/markdown; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

function safeStaticFile(root: string, request: IncomingMessage): string | null {
  if (!request.url) {
    return null
  }
  let pathname: string
  try {
    pathname = new URL(request.url, 'http://127.0.0.1').pathname
  } catch {
    return null
  }
  if (pathname.endsWith('/')) {
    pathname += 'index.html'
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const candidate = resolve(root, `.${normalize(decoded)}`)
  const outside = relative(root, candidate)
  if (outside.startsWith('..') || outside === '..' || outside.includes(`..${sep}`) || isAbsolute(outside)) {
    return null
  }
  return candidate
}

function sendResponse(response: ServerResponse, statusCode: number, body: string): void {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(body)
}

async function createRendererServer(): Promise<{
  readonly close: () => Promise<void>
  readonly url: string
}> {
  const root = rendererRoot()
  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendResponse(response, 405, 'Method not allowed')
      return
    }
    const filePath = safeStaticFile(root, request)
    if (!filePath) {
      sendResponse(response, 404, 'Not found')
      return
    }
    void readFile(filePath)
      .then((body) => {
        response.statusCode = 200
        response.setHeader('Content-Type', contentType(filePath))
        response.setHeader('Cache-Control', 'no-store')
        response.end(request.method === 'HEAD' ? undefined : body)
      })
      .catch(() => sendResponse(response, 404, 'Not found'))
  })

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen)
      resolveListen()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    cliError('RENDER_SERVER_FAILED', 5, 'renderer 서버를 시작하지 못했습니다.')
  }

  return {
    url: `http://127.0.0.1:${address.port}/index.html`,
    close: () =>
      new Promise((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      }),
  }
}

async function existsExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function discoverChromium(env: NodeJS.ProcessEnv): Promise<string> {
  const candidates = [
    env.CHIBI_TO_CODEX_PET_CHROMIUM,
    chromium.executablePath(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (await existsExecutable(candidate)) {
      return candidate
    }
  }
  cliError(
    'RENDER_BROWSER_MISSING',
    3,
    '사용 가능한 Chromium/Chrome을 찾지 못했습니다. CHIBI_TO_CODEX_PET_CHROMIUM에 실행 파일 경로를 지정하세요.',
  )
}

function validateRenderResult(value: unknown): RenderResult {
  if (!value || typeof value !== 'object') {
    cliError('PET_RENDER_INVALID', 3, 'renderer가 올바른 결과를 반환하지 않았습니다.')
  }
  const record = value as Partial<RenderResult>
  if (
    typeof record.filename !== 'string' ||
    typeof record.manifestId !== 'string' ||
    typeof record.petJson !== 'string' ||
    typeof record.spritesheetBase64 !== 'string'
  ) {
    cliError('PET_RENDER_INVALID', 3, 'renderer 결과 형식이 올바르지 않습니다.')
  }
  return record as RenderResult
}

async function renderRecipe(recipe: CodexPetRecipe, env: NodeJS.ProcessEnv): Promise<RenderResult> {
  const executablePath = await discoverChromium(env)
  const server = await createRendererServer()
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(RENDER_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(RENDER_TIMEOUT_MS)
    await page.goto(server.url, { waitUntil: 'load' })
    const result = await page.evaluate(async (input) => {
      const rendererWindow = window as Window & {
        renderCodexPetRecipe?: (recipe: CodexPetRecipe) => Promise<RenderResult>
      }
      if (!rendererWindow.renderCodexPetRecipe) {
        throw new Error('Recipe renderer is not available.')
      }
      return rendererWindow.renderCodexPetRecipe(input)
    }, recipe)
    return validateRenderResult(result)
  } catch (error) {
    cliError('PET_RENDER_FAILED', 3, 'recipe로 Codex Pet을 렌더링하지 못했습니다.', error)
  } finally {
    await browser.close().catch(() => undefined)
    await server.close().catch(() => undefined)
  }
}

function parseManifestId(petJson: Buffer, rendererId: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(petJson.toString('utf8'))
  } catch (error) {
    cliError('PET_RENDER_INVALID', 3, 'renderer가 올바른 pet.json을 반환하지 않았습니다.', error)
  }
  if (!parsed || typeof parsed !== 'object') {
    cliError('PET_RENDER_INVALID', 3, 'pet.json은 object여야 합니다.')
  }
  const manifest = parsed as Record<string, unknown>
  if (
    manifest.id !== rendererId ||
    !isSafeCodexPetId(rendererId) ||
    manifest.spriteVersionNumber !== CODEX_PET_SPRITE_VERSION ||
    manifest.spritesheetPath !== CODEX_PET_SPRITESHEET_FILENAME
  ) {
    cliError('PET_RENDER_INVALID', 3, 'renderer payload의 manifest가 Codex Pet v2 계약과 맞지 않습니다.')
  }
  return rendererId
}

function renderResultToPayload(result: RenderResult): PetPayload {
  const petJson = Buffer.from(result.petJson, 'utf8')
  let spritesheet: Buffer
  try {
    spritesheet = Buffer.from(result.spritesheetBase64, 'base64')
  } catch (error) {
    cliError('PET_RENDER_INVALID', 3, 'renderer spritesheet bytes를 해석하지 못했습니다.', error)
  }
  if (spritesheet.byteLength === 0) {
    cliError('PET_RENDER_INVALID', 3, 'renderer spritesheet가 비어 있습니다.')
  }
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!spritesheet.subarray(0, pngSignature.length).equals(pngSignature)) {
    cliError('PET_RENDER_INVALID', 3, 'renderer spritesheet가 PNG가 아닙니다.')
  }
  const id = parseManifestId(petJson, result.manifestId)
  return { id, petJson, spritesheet }
}

function resolveCodexHome(option: string | undefined, env: NodeJS.ProcessEnv): string {
  const raw = option ?? (env.CODEX_HOME?.trim() ? env.CODEX_HOME : undefined) ?? join(homedir(), '.codex')
  if (raw.includes('\0') || !isAbsolute(raw)) {
    cliError('CODEX_HOME_INVALID', 2, 'Codex home은 absolute path여야 합니다.')
  }
  return resolve(raw)
}

function destinationFor(home: string, id: string): string {
  if (!isSafeCodexPetId(id)) {
    cliError('PET_RENDER_INVALID', 3, 'Pet ID가 안전하지 않습니다.')
  }
  const destination = resolve(home, 'pets', id)
  const expectedParent = resolve(home, 'pets')
  if (dirname(destination) !== expectedParent || basename(destination) !== id) {
    cliError('CODEX_HOME_INVALID', 2, '설치 대상 경로를 안전하게 구성할 수 없습니다.')
  }
  return destination
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function samePayload(destination: string, payload: PetPayload): Promise<boolean | 'missing'> {
  let stat
  try {
    stat = await lstat(destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'missing'
    }
    throw error
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    cliError('PET_INSTALL_IO', 5, '기존 설치 대상이 directory가 아니거나 symlink입니다.')
  }
  const entries = await readdir(destination)
  if (entries.slice().sort().join('\0') !== 'pet.json\0spritesheet.png') {
    return false
  }
  const existingPetJson = await readFile(join(destination, 'pet.json'))
  const existingSpritesheet = await readFile(join(destination, 'spritesheet.png'))
  return existingPetJson.equals(payload.petJson) && existingSpritesheet.equals(payload.spritesheet)
}

async function writeStage(stage: string, payload: PetPayload): Promise<void> {
  await mkdir(stage, { recursive: false })
  await writeFile(join(stage, 'pet.json'), payload.petJson)
  await writeFile(join(stage, 'spritesheet.png'), payload.spritesheet)
  const stagedSame = await samePayload(stage, payload)
  if (stagedSame !== true) {
    cliError('PET_INSTALL_IO', 5, 'stage 검증에 실패했습니다.')
  }
}

async function installPayload(
  payload: PetPayload,
  options: InstallOptions,
  env: NodeJS.ProcessEnv,
): Promise<{ readonly code: string; readonly destination: string }> {
  const home = resolveCodexHome(options.codexHome, env)
  const petsRoot = resolve(home, 'pets')
  const destination = destinationFor(home, payload.id)
  const inspected = await samePayload(destination, payload)
  if (inspected === true) {
    return { code: 'PET_ALREADY_CURRENT', destination }
  }
  if (inspected === false && !options.force) {
    cliError('PET_ALREADY_INSTALLED', 4, '같은 ID의 다른 Pet이 이미 설치되어 있습니다. 교체하려면 --force를 사용하세요.')
  }
  if (options.dryRun) {
    return { code: 'PET_INSTALL_DRY_RUN', destination }
  }

  await mkdir(petsRoot, { recursive: true })
  const lockPath = join(petsRoot, `.${payload.id}.install.lock`)
  let stage: string | null = null
  let backup: string | null = null
  try {
    await mkdir(lockPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      cliError('PET_INSTALL_BUSY', 4, '같은 Pet ID 설치가 이미 진행 중입니다.')
    }
    throw error
  }

  try {
    stage = await mkdtemp(join(petsRoot, `.${payload.id}.stage-`))
    await rm(stage, { recursive: true, force: true })
    await writeStage(stage, payload)

    const destinationExists = await pathExists(destination)
    if (!destinationExists) {
      await rename(stage, destination)
      stage = null
      return { code: 'PET_INSTALLED', destination }
    }

    if (!options.force) {
      cliError('PET_ALREADY_INSTALLED', 4, '같은 ID의 다른 Pet이 이미 설치되어 있습니다. 교체하려면 --force를 사용하세요.')
    }
    const current = await lstat(destination)
    if (current.isSymbolicLink() || !current.isDirectory()) {
      cliError('PET_INSTALL_IO', 5, '기존 설치 대상이 directory가 아니거나 symlink입니다.')
    }
    backup = join(petsRoot, `.${payload.id}.backup-${process.pid}-${randomBytes(6).toString('hex')}`)
    await rename(destination, backup)
    try {
      await rename(stage, destination)
      stage = null
    } catch (error) {
      await rename(backup, destination).catch(() => undefined)
      backup = null
      throw error
    }
    await rm(backup, { recursive: true, force: true })
    backup = null
    return { code: 'PET_INSTALLED', destination }
  } catch (error) {
    if (error instanceof CliError) {
      throw error
    }
    cliError('PET_INSTALL_IO', 5, 'Pet 설치 중 filesystem 오류가 발생했습니다.', error)
  } finally {
    if (stage) {
      await rm(stage, { recursive: true, force: true }).catch(() => undefined)
    }
    if (backup) {
      await rm(backup, { recursive: true, force: true }).catch(() => undefined)
    }
    await rm(lockPath, { recursive: true, force: true }).catch(() => undefined)
  }
  cliError('PET_INSTALL_IO', 5, 'Pet 설치 상태를 결정하지 못했습니다.')
}

async function runInstall(options: InstallOptions, env: NodeJS.ProcessEnv): Promise<void> {
  const recipe = await loadRecipe(options.recipe)
  const result = await renderRecipe(recipe, env)
  const payload = renderResultToPayload(result)
  const installResult = await installPayload(payload, options, env)
  const petHash = sha256(payload.spritesheet)
  console.log(`${installResult.code}`)
  console.log(`cli=${CLI_VERSION}`)
  console.log(`pet=${payload.id}`)
  console.log(`spritesheetSha256=${petHash}`)
  console.log(`destination=${installResult.destination}`)
  console.log('Codex에서 custom pet 목록을 새로 고치거나 앱을 다시 연 뒤 Pet을 선택하세요.')
}

async function main(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<ExitCode> {
  try {
    const parsed = parseArgs(argv)
    if (parsed === 'help') {
      console.log(usage())
      return 0
    }
    if (parsed === 'version') {
      console.log(CLI_VERSION)
      return 0
    }
    await runInstall(parsed, env)
    return 0
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`${error.code}: ${error.message}`)
      return error.exitCode
    }
    console.error('PET_INSTALL_IO: 알 수 없는 오류가 발생했습니다.')
    return 5
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main(process.argv.slice(2), process.env).then((exitCode) => {
    process.exitCode = exitCode
  })
}

export {
  main,
  parseArgs,
  resolveCodexHome,
  renderResultToPayload,
}
