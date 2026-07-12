import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstat, readFile, readdir, readlink, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const manifestPath = resolve(
  repositoryRoot,
  'src/features/livesd/garupa/remote/provider-manifest.v1.json',
)
const bytes = await readFile(manifestPath)
const manifest = JSON.parse(bytes.toString('utf8'))
const provenancePath = resolve(
  repositoryRoot,
  'qa/garupa/source-provenance/panxuc-bangdream-live2d-15b3e023.json',
)
const provenanceBytes = await readFile(provenancePath)
const provenance = JSON.parse(provenanceBytes.toString('utf8'))
const revision = '15b3e023cfdc576212f8b3a6b001c9f26e755f23'
const repositoryUrl = 'https://github.com/panxuc/bangdream-live2d'
const deliveryBase =
  `https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@${revision}`
const approvedManifestSha256 =
  '4db947430d85efc5d854945dda4d7c8ba5c5c571d4b71deaba49660d84f885fe'
const approvedProvenanceSha256 =
  '5779e754966aa4631e515173ed2be03ec09f7fac941e2e13914f292ee3accaf6'
const sha256Pattern = /^[0-9a-f]{64}$/
const relativePathPattern =
  /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\\)[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

const manifestSha256 = sha256(bytes)
assert(bytes.byteLength <= 8192, 'Garupa provider manifest is unexpectedly large.')
assert(
  manifestSha256 === approvedManifestSha256,
  'Garupa provider manifest bytes are not the approved frozen manifest.',
)
assert(
  provenanceBytes.byteLength <= 8192,
  'Garupa source provenance is unexpectedly large.',
)
assert(
  sha256(provenanceBytes) === approvedProvenanceSha256,
  'Garupa source provenance bytes are not the approved audit record.',
)

assert(manifest.schemaVersion === 1, 'Garupa provider schemaVersion must be 1.')
assert(manifest.status === 'experimental', 'Garupa provider must remain experimental.')
assert(manifest.gameId === 'garupa', 'Garupa provider gameId mismatch.')
assert(manifest.assetFamily === 'sdchara', 'Garupa provider asset family mismatch.')
assert(manifest.repository?.url === repositoryUrl, 'Garupa repository URL mismatch.')
assert(manifest.repository?.branch === 'live2d', 'Garupa provenance branch mismatch.')
assert(manifest.repository?.sourceRevision === revision, 'Garupa revision mismatch.')
assert(
  manifest.repository?.commitUrl === `${repositoryUrl}/commit/${revision}`,
  'Garupa commit URL mismatch.',
)
assert(manifest.delivery?.baseUrl === deliveryBase, 'Garupa delivery pin mismatch.')
assert(
  manifest.delivery?.requestOrigin === 'https://cdn.jsdelivr.net',
  'Garupa delivery origin mismatch.',
)
assert(manifest.delivery?.requestPolicy?.range === 'forbidden', 'Range must be forbidden.')
assert(manifest.licenseStatus === 'not-declared', 'Garupa data license state changed.')
assert(provenance.sourceRevision === revision, 'Garupa provenance revision mismatch.')
assert(
  provenance.inventory?.files === 2940 &&
    provenance.inventory?.bytes === 41262422,
  'Garupa private backup inventory mismatch.',
)
assert(
  provenance.inventory?.sha256InventorySha256 ===
    '9c649a1576cec0c5bd2448e9428411badc588b61ffe84adb36e399a02fe1c49d',
  'Garupa private backup hash inventory mismatch.',
)
assert(
  provenance.inventory?.fileMetadataSha256 ===
    'c7f677cb0cbdc25e7f98e2ab7ac18c60e5746c996c16b0af86a16fac05f07a6d',
  'Garupa private backup file metadata mismatch.',
)
assert(
  provenance.localBackupPolicy === 'private-unserved-untracked',
  'Garupa local backup policy mismatch.',
)

for (const [name, catalog] of Object.entries(manifest.catalogs ?? {})) {
  assert(relativePathPattern.test(catalog.path), `Unsafe Garupa catalog path: ${name}`)
  assert(Number.isSafeInteger(catalog.bytes) && catalog.bytes > 0, `Invalid catalog size: ${name}`)
  assert(sha256Pattern.test(catalog.sha256), `Invalid catalog hash: ${name}`)
  assert(
    JSON.stringify(catalog) === JSON.stringify(provenance.catalogs?.[name]),
    `Garupa catalog provenance mismatch: ${name}`,
  )
}

const roleCounts = new Map()
const sourcePaths = new Set()
const canonicalPaths = new Set()
for (const file of manifest.debugFixture?.files ?? []) {
  assert(
    ['atlas', 'buildData', 'png', 'skeleton'].includes(file.role),
    `Unexpected fixture role: ${file.role}`,
  )
  roleCounts.set(file.role, (roleCounts.get(file.role) ?? 0) + 1)
  assert(relativePathPattern.test(file.sourcePath), `Unsafe fixture path: ${file.sourcePath}`)
  assert(
    file.canonicalPath === null || relativePathPattern.test(file.canonicalPath),
    `Unsafe canonical fixture path: ${file.canonicalPath}`,
  )
  assert(Number.isSafeInteger(file.bytes) && file.bytes > 0, `Invalid fixture size: ${file.role}`)
  assert(sha256Pattern.test(file.sha256), `Invalid fixture hash: ${file.role}`)
  assert(!sourcePaths.has(file.sourcePath), `Duplicate fixture source path: ${file.sourcePath}`)
  sourcePaths.add(file.sourcePath)
  if (file.role === 'buildData') {
    assert(file.canonicalPath === null, 'Garupa buildData must not enter the canonical pack.')
  } else {
    assert(file.canonicalPath !== null, `Missing canonical path: ${file.role}`)
    assert(!canonicalPaths.has(file.canonicalPath), `Duplicate canonical path: ${file.canonicalPath}`)
    canonicalPaths.add(file.canonicalPath)
  }
}
for (const singletonRole of ['atlas', 'buildData', 'skeleton']) {
  assert(roleCounts.get(singletonRole) === 1, `Garupa fixture requires one ${singletonRole}.`)
}
assert((roleCounts.get('png') ?? 0) >= 1, 'Garupa fixture requires at least one PNG page.')
assert(
  provenance.representativeFixture?.canonicalZipSha256 ===
    'e2eb5f329e89b751808bb897e2261e33f93d9d5c6e583c32b2521d289a9e2eb8',
  'Garupa canonical debug ZIP provenance mismatch.',
)
assert(
  provenance.representativeFixture?.canonicalZipBytes === 462200,
  'Garupa canonical debug ZIP size mismatch.',
)

const repositoryFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean)
const isQaVisualEvidence = (path) =>
  /^qa\/[A-Za-z0-9_./-]+\.png$/u.test(path)
const forbiddenRepositoryFiles = repositoryFiles.filter((path) => {
  const lower = path.toLowerCase()
  if (isQaVisualEvidence(lower)) return false
  return (
    lower.startsWith('assets/garupa/') ||
    lower.startsWith('assets/sdchara/') ||
    lower.startsWith('public/assets/garupa/') ||
    lower.startsWith('public/assets/sdchara/') ||
    /(?:\.skel|\.atlas(?:\.txt)?|\.png|\.zip|\.asset|\.bundle|\.unity3d)$/.test(
      lower,
    )
  )
})
assert(
  forbiddenRepositoryFiles.length === 0,
  `Repository model/archive assets are forbidden: ${forbiddenRepositoryFiles.join(', ')}`,
)

for (const privatePath of [
  '.debug-fixtures',
  'assets/garupa',
  'assets/sdchara',
  'public/assets/garupa',
  'public/assets/sdchara',
]) {
  try {
    await lstat(resolve(repositoryRoot, privatePath))
    throw new Error(`Garupa private assets must remain outside the repository: ${privatePath}`)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

const publicAssetsPath = resolve(repositoryRoot, 'public/assets')
try {
  const publicAssetsMetadata = await lstat(publicAssetsPath)
  assert(
    publicAssetsMetadata.isSymbolicLink(),
    'public/assets must be absent or the approved symlink.',
  )
  assert(
    (await readlink(publicAssetsPath)) === '../assets',
    'public/assets symlink target must remain ../assets.',
  )
  assert(
    (await realpath(publicAssetsPath)) ===
      (await realpath(resolve(repositoryRoot, 'assets'))),
    'public/assets must resolve to the repository-local assets directory.',
  )
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const forbiddenContentHashes = new Set([
  'bda0e41031f0b95c37ebd5d051da88b04f895f80771ce2259bc9cd90ff83adaa',
  '1b4de69f9f2ddcfb1ba7b3a000fbbaaa42b685e86fda4b3f248011ee84ca385f',
  'b4a5f30486dc55ee43e8704cb3b801075e2bb566af53099af1583be13cfdcb6b',
  'ccb1a04d1b51b920d0e12193716160cfd50f79aad0bca9610ea082cebbbe9cd4',
  '9ceb0a645f0132133ffeb770f939f8e62da3908b99d4f43b40073c03051e2364',
  'e2eb5f329e89b751808bb897e2261e33f93d9d5c6e583c32b2521d289a9e2eb8',
])

function hasForbiddenBinaryContent(fileBytes, path) {
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
  return (
    (isPng && !isQaVisualEvidence(path.toLowerCase())) ||
    isZip ||
    forbiddenContentHashes.has(sha256(fileBytes))
  )
}

const leakedRepositoryFiles = []
for (const path of repositoryFiles) {
  const absolutePath = resolve(repositoryRoot, path)
  let metadata
  try {
    metadata = await lstat(absolutePath)
  } catch (error) {
    if (error?.code === 'ENOENT') continue
    throw error
  }
  if (metadata.isSymbolicLink()) {
    leakedRepositoryFiles.push(`${path} (symlink)`)
    continue
  }
  if (!metadata.isFile()) continue
  const fileBytes = await readFile(absolutePath)
  if (hasForbiddenBinaryContent(fileBytes, path)) {
    leakedRepositoryFiles.push(path)
  }
}

const indexEntries = execFileSync('git', ['ls-files', '-s', '-z'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean)
for (const entry of indexEntries) {
  const tabIndex = entry.indexOf('\t')
  assert(tabIndex > 0, `Invalid Git index entry: ${entry}`)
  const [mode, , stage] = entry.slice(0, tabIndex).split(' ')
  const path = entry.slice(tabIndex + 1)
  assert(
    (mode === '100644' || mode === '100755') && stage === '0',
    `Git index contains a symlink, submodule, or unresolved entry: ${path}`,
  )
  const indexedBytes = execFileSync('git', ['show', `:${path}`], {
    cwd: repositoryRoot,
    maxBuffer: 128 * 1024 * 1024,
  })
  if (hasForbiddenBinaryContent(indexedBytes, path)) {
    leakedRepositoryFiles.push(`${path} (index)`)
  }
}

async function listIgnoredAssetFiles(directory, root = directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listIgnoredAssetFiles(path, root)))
    } else if (entry.isFile()) {
      files.push({ absolutePath: path, path: path.slice(root.length + 1) })
    } else {
      files.push({ absolutePath: null, path: `${path.slice(root.length + 1)} (symlink)` })
    }
  }
  return files
}

for (const asset of await listIgnoredAssetFiles(resolve(repositoryRoot, 'assets'))) {
  const lowerPath = asset.path.toLowerCase()
  const isApprovedPrskFixturePath =
    /^prsk\/[A-Za-z0-9_][A-Za-z0-9._-]*\/sekai_atlas\.(?:atlas|png)$/u.test(
      asset.path,
    ) || asset.path === 'prsk/base_model/sekai_skeleton.skel'
  if (
    asset.absolutePath === null ||
    !isApprovedPrskFixturePath ||
    lowerPath.includes('garupa') ||
    lowerPath.includes('sdchara')
  ) {
    leakedRepositoryFiles.push(`assets/${asset.path}`)
    continue
  }
  const assetBytes = await readFile(asset.absolutePath)
  if (forbiddenContentHashes.has(sha256(assetBytes))) {
    leakedRepositoryFiles.push(`assets/${asset.path}`)
  }
}
assert(
  leakedRepositoryFiles.length === 0,
  `Repository contains forbidden binary/model bytes: ${leakedRepositoryFiles.join(', ')}`,
)

console.log(
  `Verified Garupa provider manifest ${manifestSha256} at ${revision}.`,
)
