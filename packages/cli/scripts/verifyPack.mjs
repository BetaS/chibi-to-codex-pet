import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
)

for (const scriptName of ['preinstall', 'install', 'postinstall']) {
  if (packageJson.scripts?.[scriptName]) {
    throw new Error(`install lifecycle script is not allowed: ${scriptName}`)
  }
}

const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: packageRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    npm_config_cache: join(tmpdir(), 'chibi-to-codex-pet-npm-cache'),
  },
})

if (pack.status !== 0) {
  process.stderr.write(pack.stderr)
  throw new Error('npm pack dry-run failed')
}

const parsedSummary = JSON.parse(pack.stdout)
const summary = Array.isArray(parsedSummary)
  ? parsedSummary[0]
  : parsedSummary[packageJson.name] ?? Object.values(parsedSummary)[0]
if (!summary || !Array.isArray(summary.files)) {
  throw new Error('npm pack dry-run returned an unsupported JSON summary')
}
const files = summary.files.map((file) => file.path).sort()
const required = [
  'dist/cli.js',
  'package.json',
  'renderer/index.html',
]

for (const path of required) {
  if (!files.includes(path)) {
    throw new Error(`required package file is missing: ${path}`)
  }
}

const forbiddenPatterns = [
  /^src\//u,
  /^renderer-src\//u,
  /^scripts\//u,
  /(?:^|\/)assets\/prsk(?:\/|$)/u,
  /\.atlas$/u,
  /\.skel$/u,
  /\.codex-pet\.zip$/u,
  /(?:^|\/)spritesheet\.png$/u,
  /(?:^|\/)pet\.json$/u,
  /(?:^|\/).*\.test\.[jt]sx?$/u,
  /^vite\..*\.ts$/u,
  /^vitest\.config\.ts$/u,
  /^tsconfig\.json$/u,
]

for (const path of files) {
  const forbidden = forbiddenPatterns.find((pattern) => pattern.test(path))
  if (forbidden) {
    throw new Error(`forbidden package file included: ${path}`)
  }
}

console.log(`Verified ${files.length} package files for ${packageJson.name}.`)
