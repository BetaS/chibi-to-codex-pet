import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const expectedFiles = new Map([
  [
    'third_party/estertion-spine-3.6/spine-webgl.js',
    '28dd3ecde3325395fb77d3f87e869308f9e710f16e3d5a79e549ae404c478eb4',
  ],
  [
    'third_party/estertion-spine-3.6/spine-webgl.d.ts',
    'ea1439dd2e8fc83d3d26bd6890e706c6e5f0356dae8d9e4d112166170090232b',
  ],
  [
    'third_party/estertion-spine-3.6/LICENSE',
    'd2af98ecac7e4bb6e4c4491fc734db7762b94626b18bcc87c7eac6febd86e1b5',
  ],
])
const notices = await readFile(
  resolve(repositoryRoot, 'THIRD_PARTY_NOTICES.md'),
  'utf8',
)

for (const [relativePath, expectedHash] of expectedFiles) {
  const bytes = await readFile(resolve(repositoryRoot, relativePath))
  const actualHash = createHash('sha256').update(bytes).digest('hex')

  if (actualHash !== expectedHash) {
    throw new Error(
      `Vendored runtime SHA-256 mismatch: ${relativePath} (${actualHash})`,
    )
  }
  if (!notices.includes(relativePath) || !notices.includes(expectedHash)) {
    throw new Error(
      `THIRD_PARTY_NOTICES.md is missing provenance for ${relativePath}`,
    )
  }
}

const runtime40ProvenancePath = resolve(
  repositoryRoot,
  'qa/garupa/runtime-provenance/esotericsoftware-spine-webgl-4.0.31.json',
)
const runtime40ProvenanceBytes = await readFile(runtime40ProvenancePath)
const runtime40ProvenanceSha256 = createHash('sha256')
  .update(runtime40ProvenanceBytes)
  .digest('hex')
if (
  runtime40ProvenanceSha256 !==
  '34301ea407e8bed12a26adbdf6726ac07f7a780fa9765099c805789e452697d5'
) {
  throw new Error(
    `Spine 4.0 evaluation provenance changed: ${runtime40ProvenanceSha256}`,
  )
}
const runtime40Provenance = JSON.parse(runtime40ProvenanceBytes.toString('utf8'))
const webglPin = runtime40Provenance.package
const corePin = runtime40Provenance.transitivePackages?.find(
  (candidate) => candidate.name === '@esotericsoftware/spine-core',
)
if (
  runtime40Provenance.status !==
    'branch-integration-and-distribution-approved-release-blocked' ||
  runtime40Provenance.scope !==
    'local-evaluation-production-integration-and-branch-public-preview' ||
  runtime40Provenance.releaseGate?.productionIntegration !== 'allowed' ||
  runtime40Provenance.releaseGate?.publicDistribution !== 'allowed' ||
  runtime40Provenance.releaseGate?.release !== 'blocked' ||
  webglPin?.name !== '@esotericsoftware/spine-webgl' ||
  webglPin?.version !== '4.0.31' ||
  webglPin?.releaseCommit !== '425ce416bb218b28caeec47b317aa57cd7140375' ||
  webglPin?.tarballSha256 !==
    'fdfe7fc72b870a4da238f349634dd043390b5035dbce6782e7e4288adc6648a1' ||
  corePin?.version !== '4.0.31' ||
  corePin?.tarballSha256 !==
    '0cabd4eb969f5f1f4bef9782e8302a9edf59a56db2e1eafb85fcd190624a54fc'
) {
  throw new Error('Spine 4.0 package pin or integration/release gate is invalid.')
}

const rootPackage = JSON.parse(
  await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'),
)
if (
  rootPackage.dependencies?.[webglPin.name] !== webglPin.version ||
  rootPackage.devDependencies?.[webglPin.name] !== undefined
) {
  throw new Error(
    'Spine 4.0 must be an exact production dependency for branch activation.',
  )
}
const lockfile = await readFile(resolve(repositoryRoot, 'pnpm-lock.yaml'), 'utf8')
for (const pin of [webglPin, corePin]) {
  if (
    !pin ||
    !lockfile.includes(`'${pin.name}@${pin.version}':`) ||
    !lockfile.includes(`integrity: ${pin.integrity}`)
  ) {
    throw new Error(`pnpm lockfile is missing the approved ${pin?.name} pin.`)
  }
}

const webglPackagePath = require.resolve(
  '@esotericsoftware/spine-webgl/package.json',
)
const webglRoot = dirname(webglPackagePath)
const corePackagePath = require.resolve(
  '@esotericsoftware/spine-core/package.json',
  { paths: [webglRoot] },
)
const coreRoot = dirname(corePackagePath)
const [webglPackage, corePackage] = await Promise.all(
  [webglPackagePath, corePackagePath].map(async (path) =>
    JSON.parse(await readFile(path, 'utf8')),
  ),
)
if (
  webglPackage.name !== webglPin.name ||
  webglPackage.version !== webglPin.version ||
  webglPackage.license !== 'LicenseRef-LICENSE' ||
  webglPackage.dependencies?.[corePin.name] !== corePin.version ||
  corePackage.name !== corePin.name ||
  corePackage.version !== corePin.version ||
  corePackage.license !== 'LicenseRef-LICENSE'
) {
  throw new Error('Installed Spine 4.0 package metadata does not match the pin.')
}

const installedRuntime40Files = new Map([
  ['webglLicense', resolve(webglRoot, 'LICENSE')],
  ['webglIndex', resolve(webglRoot, 'dist/index.js')],
  ['webglIife', resolve(webglRoot, 'dist/iife/spine-webgl.js')],
  [
    'webglMinifiedIife',
    resolve(webglRoot, 'dist/iife/spine-webgl.min.js'),
  ],
  ['coreLicense', resolve(coreRoot, 'LICENSE')],
  ['coreIndex', resolve(coreRoot, 'dist/index.js')],
  ['coreIife', resolve(coreRoot, 'dist/iife/spine-core.js')],
  ['coreMinifiedIife', resolve(coreRoot, 'dist/iife/spine-core.min.js')],
])
let installedPackageLicense
for (const [label, path] of installedRuntime40Files) {
  const bytes = await readFile(path)
  const digest = createHash('sha256').update(bytes).digest('hex')
  const expected = runtime40Provenance.installedFiles?.[`${label}Sha256`]
  if (!expected || digest !== expected || !notices.includes(expected)) {
    throw new Error(`Spine 4.0 installed file provenance mismatch: ${label}`)
  }
  if (label === 'webglLicense') installedPackageLicense = bytes
}

const trackedLicensePath = runtime40Provenance.license?.trackedLicensePath
const trackedLicense = await readFile(resolve(repositoryRoot, trackedLicensePath))
const trackedLicenseDigest = createHash('sha256')
  .update(trackedLicense)
  .digest('hex')
const trackedLicenseWithoutRepositoryNewline = trackedLicense.subarray(
  0,
  trackedLicense.at(-1) === 0x0a
    ? trackedLicense.byteLength - 1
    : trackedLicense.byteLength,
)
if (
  trackedLicenseDigest !== runtime40Provenance.license.trackedLicenseSha256 ||
  !installedPackageLicense ||
  !trackedLicenseWithoutRepositoryNewline.equals(installedPackageLicense) ||
  !notices.includes(trackedLicensePath) ||
  !notices.includes(runtime40Provenance.license.copyrightNotice) ||
  !notices.includes(webglPin.releaseCommit)
) {
  throw new Error(
    'Spine 4.0 original license, copyright notice, or release provenance is missing.',
  )
}

console.log(
  'Verified vendored Spine 3.6 and branch-distribution-approved, release-blocked official Spine 4.0.31 provenance.',
)
