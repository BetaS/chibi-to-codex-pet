import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')

function gitFiles(...args) {
  return execFileSync('git', ['ls-files', '-z', ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
}

const trackedFiles = gitFiles().filter((path) =>
  existsSync(resolve(repositoryRoot, path)),
)
const violations = []

function report(path, reason) {
  violations.push(`${path}: ${reason}`)
}

const forbiddenTrackedPaths = [
  /^\.debug-fixtures(?:\/|$)/u,
  /^\.provider-local(?:\/|$)/u,
  /^assets(?:\/|$)/u,
  /^public\/assets(?:\/|$)/u,
  /^e2e\/.*\.local\.spec\.ts$/u,
  /^scripts\/.*\.local\.(?:mjs|py)$/u,
  /^src\/features\/livesd\/[^/]+\/development(?:\.local)?(?:\/|$)/u,
  /^qa\/.*\.local\.[^/]+$/u,
]

const retiredLocalPaths = new Set([
  'e2e/codex-pet-export.spec.ts',
  'e2e/prsk-smoke.spec.ts',
  'qa/garupa/ACTIVATION_GATE.md',
  'qa/garupa/compatibility/spine40-15b3e023.json',
  'scripts/backupGarupaDebugSnapshot.mjs',
  'scripts/backupKarthApi.mjs',
  'scripts/installKarthStaticSnapshot.mjs',
  'scripts/prepareStrrLocalBackup.py',
  'scripts/verifyGarupaModelFamiliesLocal.mjs',
  'scripts/verifyGarupaSpine40Local.mjs',
  'scripts/verifyLocalNpx.mjs',
])

const forbiddenProviderPayloadExtension =
  /\.(?:asset|atlas(?:\.txt)?|bin|bundle|har|pak|png|pvr|skel|unity3d|zip)$/iu
const forbiddenResponseSnapshotPath =
  /(?:^|\/)(?:api[-_]?responses?|asset[-_]?index|catalog|character[-_]?list|provider[-_]?snapshot)(?:[-_.][A-Za-z0-9]+)*\.json$/iu

for (const path of trackedFiles) {
  if (forbiddenTrackedPaths.some((pattern) => pattern.test(path))) {
    report(path, 'provider-local paths must stay ignored and untracked')
  }
  if (retiredLocalPaths.has(path)) {
    report(path, 'provider acquisition or real-asset smoke code is local-only')
  }
  if (forbiddenProviderPayloadExtension.test(path)) {
    report(path, 'provider/model payload files are forbidden in the repository')
  }
  if (forbiddenResponseSnapshotPath.test(path)) {
    report(path, 'captured provider/API response snapshots are forbidden')
  }
}

const forbiddenE2eSourcePatterns = [
  [/from ['"]node:fs['"]/u, 'tracked E2E may not read local filesystem fixtures'],
  [/from ['"]node:url['"]/u, 'tracked E2E may not resolve local asset fixtures'],
  [/\.\.\/assets\//u, 'tracked E2E may not reference provider asset directories'],
  [/CHIBI_PRIVATE_FIXTURE_ROOT/u, 'private fixture roots are local-only'],
  [/test\.skip\(!localAssetsReady/u, 'real-asset smoke tests must use *.local.spec.ts'],
]

for (const path of trackedFiles.filter((candidate) =>
  /^e2e\/.*\.spec\.ts$/u.test(candidate),
)) {
  const source = readFileSync(resolve(repositoryRoot, path), 'utf8')
  for (const [pattern, reason] of forbiddenE2eSourcePatterns) {
    if (pattern.test(source)) report(path, reason)
  }
}

for (const path of trackedFiles.filter((candidate) =>
  /^src\/features\/.*\.(?:ts|tsx|json)$/u.test(candidate),
)) {
  const source = readFileSync(resolve(repositoryRoot, path), 'utf8')
  if (/\/(?:assets\/(?:prsk|strr|garupa)|\.debug-fixtures)(?:\/|['"])/u.test(source)) {
    report(path, 'production source may not bind to repository-local provider assets')
  }
  if (/data:(?:image\/png|application\/(?:zip|octet-stream));base64,/iu.test(source)) {
    report(path, 'production source may not embed provider binary payloads')
  }
}

const packageJsonPath = resolve(repositoryRoot, 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
  if (
    /^backup:/u.test(name) ||
    /scripts\/.*\.local\.(?:mjs|py)/u.test(command) ||
    /scripts\/(?:backup|capture|installKarth|prepareStrr|verifyGarupa.*Local|verifyLocalNpx)/u.test(command)
  ) {
    report(`package.json#scripts.${name}`, 'provider-local tools must not be package scripts')
  }
}

for (const path of trackedFiles.filter((candidate) =>
  /^\.github\/workflows\/.*\.ya?ml$/u.test(candidate),
)) {
  const source = readFileSync(resolve(repositoryRoot, path), 'utf8')
  if (/test:e2e:local|\.local\.spec\.ts|scripts\/.*\.local\.(?:mjs|py)/u.test(source)) {
    report(path, 'CI workflows may not invoke provider-local tools or smoke tests')
  }
}

const playwrightConfig = readFileSync(
  resolve(repositoryRoot, 'playwright.config.ts'),
  'utf8',
)
if (!/testIgnore:\s*['"]\*\*\/\*\.local\.spec\.ts['"]/u.test(playwrightConfig)) {
  report(
    'playwright.config.ts',
    'the CI-safe Playwright config must ignore *.local.spec.ts',
  )
}

if (violations.length > 0) {
  throw new Error(
    `Repository/provider boundary violations:\n- ${violations.join('\n- ')}`,
  )
}

console.log(
  `Repository/provider boundary verified (${trackedFiles.length} tracked files).`,
)
