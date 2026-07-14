import { createHash } from 'node:crypto'
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
  'renderer/manifests/garupa/bangdream-live2d.v1.json',
  'renderer/vendor/esotericsoftware-spine-4.0.31/LICENSE',
  'renderer/vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
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
  /\.atlas(?:\.txt)?$/u,
  /\.skel$/u,
  /\.png$/u,
  /\.zip$/u,
  /\.asset$/u,
  /\.bundle$/u,
  /\.unity3d$/u,
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
  if (
    path.startsWith('renderer/vendor/esotericsoftware-spine-4.0.31/') &&
    ![
      'renderer/vendor/esotericsoftware-spine-4.0.31/LICENSE',
      'renderer/vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
    ].includes(path)
  ) {
    throw new Error(
      `unapproved standalone Spine 4.0 runtime file included: ${path}`,
    )
  }
}

const garupaManifestPath = join(
  packageRoot,
  'renderer/manifests/garupa/bangdream-live2d.v1.json',
)
const garupaManifestBytes = readFileSync(garupaManifestPath)
const garupaManifestSha256 = createHash('sha256')
  .update(garupaManifestBytes)
  .digest('hex')
if (
  garupaManifestBytes.byteLength > 8192 ||
  garupaManifestSha256 !==
    '94e4a5f9d546e3a3b503441dbbf7d1f35ad88bc087eab625893cb45ab5b6954c'
) {
  throw new Error('CLI renderer contains an unapproved Garupa provider manifest.')
}

const spine40LicenseBytes = readFileSync(
  join(
    packageRoot,
    'renderer/vendor/esotericsoftware-spine-4.0.31/LICENSE',
  ),
)
if (
  createHash('sha256').update(spine40LicenseBytes).digest('hex') !==
  '8f9c3dbc5bbb98eb042bfe6f9e8e4c0fab32eb256b2767bd4fc7f87d27f60619'
) {
  throw new Error('CLI renderer Spine 4.0 license notice changed.')
}
const spine40Notice = readFileSync(
  join(
    packageRoot,
    'renderer/vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
  ),
  'utf8',
)
if (
  !spine40Notice.includes('@esotericsoftware/spine-webgl@4.0.31') ||
  !spine40Notice.includes(
    'Public preview and production artifact inclusion are approved',
  ) ||
  !spine40Notice.includes('Release and push remain blocked')
) {
  throw new Error('CLI renderer Spine 4.0 notice is incomplete.')
}

const forbiddenContentHashes = new Set([
  'bda0e41031f0b95c37ebd5d051da88b04f895f80771ce2259bc9cd90ff83adaa',
  '1b4de69f9f2ddcfb1ba7b3a000fbbaaa42b685e86fda4b3f248011ee84ca385f',
  'b4a5f30486dc55ee43e8704cb3b801075e2bb566af53099af1583be13cfdcb6b',
  'ccb1a04d1b51b920d0e12193716160cfd50f79aad0bca9610ea082cebbbe9cd4',
  '9ceb0a645f0132133ffeb770f939f8e62da3908b99d4f43b40073c03051e2364',
  'e2eb5f329e89b751808bb897e2261e33f93d9d5c6e583c32b2521d289a9e2eb8',
])
const leakedPackageFiles = []
for (const path of files) {
  const fileBytes = readFileSync(join(packageRoot, path))
  const isPng =
    fileBytes.length >= 8 &&
    fileBytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isZip =
    fileBytes.length >= 4 &&
    fileBytes[0] === 0x50 &&
    fileBytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(fileBytes[2]) &&
    [0x04, 0x06, 0x08].includes(fileBytes[3])
  const digest = createHash('sha256').update(fileBytes).digest('hex')
  if (isPng || isZip || forbiddenContentHashes.has(digest)) {
    leakedPackageFiles.push(path)
  }
}
if (leakedPackageFiles.length > 0) {
  throw new Error(
    `CLI package contains forbidden binary/model bytes: ${leakedPackageFiles.join(', ')}`,
  )
}

console.log(`Verified ${files.length} package files for ${packageJson.name}.`)
