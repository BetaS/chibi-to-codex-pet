import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import {
  BlobWriter,
  Uint8ArrayReader,
  ZipWriter,
} from '@zip.js/zip.js'

const repositoryRoot = resolve(import.meta.dirname, '..')
const manifestPath = resolve(
  repositoryRoot,
  'src/features/livesd/garupa/remote/provider-manifest.v1.json',
)
const provenancePath = resolve(
  repositoryRoot,
  'qa/garupa/source-provenance/panxuc-bangdream-live2d-15b3e023.json',
)
const approvedRevision = '15b3e023cfdc576212f8b3a6b001c9f26e755f23'
const approvedRepositoryUrl = 'https://github.com/panxuc/bangdream-live2d'
const approvedManifestSha256 =
  '4db947430d85efc5d854945dda4d7c8ba5c5c571d4b71deaba49660d84f885fe'
const manifestBytes = await readFile(manifestPath)
const manifest = JSON.parse(manifestBytes.toString('utf8'))
const provenance = JSON.parse(await readFile(provenancePath, 'utf8'))
const revision = manifest.repository?.sourceRevision
const sourceRepositoryUrl = manifest.repository?.url
const safeSegmentPattern = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/
const sha256Pattern = /^[0-9a-f]{64}$/

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

if (
  sha256(manifestBytes) !== approvedManifestSha256 ||
  revision !== approvedRevision ||
  sourceRepositoryUrl !== approvedRepositoryUrl ||
  provenance.sourceRevision !== approvedRevision ||
  provenance.repository !== approvedRepositoryUrl
) {
  throw new Error('Garupa provider manifest does not contain the approved repository pin.')
}

function isSafeRelativePath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    !path.includes('\\') &&
    path.split('/').every((segment) => safeSegmentPattern.test(segment))
  )
}

const fixture = manifest.debugFixture
if (
  !fixture ||
  !safeSegmentPattern.test(fixture.id) ||
  !safeSegmentPattern.test(fixture.sdAssetBundleName) ||
  !safeSegmentPattern.test(fixture.modelName) ||
  !Array.isArray(fixture.files) ||
  fixture.files.length < 4 ||
  fixture.files.some(
    (file) =>
      !isSafeRelativePath(file?.sourcePath) ||
      (file?.canonicalPath !== null &&
        !isSafeRelativePath(file?.canonicalPath)),
  )
) {
  throw new Error('Garupa provider manifest contains an unsafe debug fixture path.')
}
const fixtureRoleCounts = new Map()
const fixtureSourcePaths = new Set()
const fixtureCanonicalPaths = new Set()
for (const file of fixture.files) {
  if (
    !['atlas', 'buildData', 'png', 'skeleton'].includes(file.role) ||
    !Number.isSafeInteger(file.bytes) ||
    file.bytes <= 0 ||
    typeof file.sha256 !== 'string' ||
    !sha256Pattern.test(file.sha256) ||
    fixtureSourcePaths.has(file.sourcePath)
  ) {
    throw new Error('Garupa provider manifest contains an invalid debug fixture file.')
  }
  fixtureRoleCounts.set(
    file.role,
    (fixtureRoleCounts.get(file.role) ?? 0) + 1,
  )
  fixtureSourcePaths.add(file.sourcePath)
  if (file.role === 'buildData') {
    if (file.canonicalPath !== null) {
      throw new Error('Garupa buildData cannot enter the canonical fixture.')
    }
  } else {
    if (
      file.canonicalPath === null ||
      fixtureCanonicalPaths.has(file.canonicalPath)
    ) {
      throw new Error('Garupa canonical fixture paths must be present and unique.')
    }
    fixtureCanonicalPaths.add(file.canonicalPath)
  }
}
for (const role of ['atlas', 'buildData', 'skeleton']) {
  if (fixtureRoleCounts.get(role) !== 1) {
    throw new Error(`Garupa debug fixture requires exactly one ${role} file.`)
  }
}
if ((fixtureRoleCounts.get('png') ?? 0) < 1) {
  throw new Error('Garupa debug fixture requires at least one PNG page.')
}

const configuredRoot = process.env.CHIBI_PRIVATE_FIXTURE_ROOT?.trim()
const defaultPrivateRoot = process.platform === 'darwin'
  ? resolve(
      homedir(),
      'Library',
      'Application Support',
      'chibi-to-codex-pet',
      'private-fixtures',
    )
  : resolve(
      homedir(),
      '.local',
      'share',
      'chibi-to-codex-pet',
      'private-fixtures',
    )
const privateRoot = configuredRoot
  ? resolve(configuredRoot)
  : defaultPrivateRoot
const relativePrivateRoot = relative(repositoryRoot, privateRoot).replaceAll(
  '\\',
  '/',
)
const nativeRelativePrivateRoot = relative(repositoryRoot, privateRoot)
const privateRootIsInsideRepository =
  nativeRelativePrivateRoot === '' ||
  (!nativeRelativePrivateRoot.startsWith(`..${sep}`) &&
    nativeRelativePrivateRoot !== '..' &&
    !isAbsolute(nativeRelativePrivateRoot))
if (privateRootIsInsideRepository) {
  throw new Error(
    `CHIBI_PRIVATE_FIXTURE_ROOT must be outside the repository: ${relativePrivateRoot}`,
  )
}

const snapshotRoot = resolve(
  privateRoot,
  'garupa',
  'bangdream-live2d',
  revision,
)
const checkoutRoot = resolve(snapshotRoot, 'repository')
const auditRoot = resolve(snapshotRoot, 'audit')
const canonicalRoot = resolve(snapshotRoot, 'canonical')

async function pathExists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function isInside(parent, candidate) {
  const childPath = relative(parent, candidate)
  return (
    childPath === '' ||
    (!childPath.startsWith(`..${sep}`) &&
      childPath !== '..' &&
      !isAbsolute(childPath))
  )
}

async function ensureOwnerDirectory(
  path,
  { recursive = false, repairPermissions = true } = {},
) {
  let created = false
  try {
    const createdPath = await mkdir(path, { mode: 0o700, recursive })
    created = recursive ? createdPath !== undefined : true
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
  }
  const metadata = await lstat(path)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Private fixture path must be a real directory: ${path}`)
  }
  if (created || repairPermissions) {
    await chmod(path, 0o700)
  } else if ((metadata.mode & 0o077) !== 0) {
    throw new Error(
      `Existing CHIBI_PRIVATE_FIXTURE_ROOT must already be owner-only: ${path}`,
    )
  }
}

async function assertPhysicallyOutsideRepository(path) {
  const [actualRepositoryRoot, actualPath] = await Promise.all([
    realpath(repositoryRoot),
    realpath(path),
  ])
  if (isInside(actualRepositoryRoot, actualPath)) {
    throw new Error(`Private fixture path resolves inside the repository: ${path}`)
  }
}

async function assertOutsidePublicAssets(path) {
  let publicAssetsRoot
  try {
    publicAssetsRoot = await realpath(resolve(repositoryRoot, 'public/assets'))
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
  const actualPath = await realpath(path)
  if (
    isInside(publicAssetsRoot, actualPath) ||
    isInside(actualPath, publicAssetsRoot)
  ) {
    throw new Error('Private fixture root must not overlap the Vite public assets root.')
  }
}

async function run(command, args, options = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
      },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        accept()
        return
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed (${signal ?? code})`,
        ),
      )
    })
  })
}

async function capture(command, args, cwd = repositoryRoot) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        accept(stdout.trim())
        return
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed (${signal ?? code}): ${stderr.trim()}`,
        ),
      )
    })
  })
}

async function prepareCheckout() {
  if (await pathExists(checkoutRoot)) {
    const metadata = await lstat(checkoutRoot)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('Debug snapshot checkout must be a real directory.')
    }
  }
  const gitDirectory = resolve(checkoutRoot, '.git')
  if (!(await pathExists(gitDirectory))) {
    const partRoot = `${checkoutRoot}.part-${process.pid}`
    await rm(partRoot, { force: true, recursive: true })
    await ensureOwnerDirectory(partRoot)
    try {
      await run('git', ['init', '--quiet'], { cwd: partRoot })
      await run(
        'git',
        ['remote', 'add', 'origin', sourceRepositoryUrl],
        { cwd: partRoot },
      )
      await run(
        'git',
        [
          'fetch',
          '--no-tags',
          '--depth=1',
          '--filter=blob:none',
          'origin',
          revision,
        ],
        { cwd: partRoot },
      )
      await run(
        'git',
        ['sparse-checkout', 'init', '--no-cone'],
        { cwd: partRoot },
      )
      await run(
        'git',
        [
          'sparse-checkout',
          'set',
          '--no-cone',
          '/sdchara/',
          '/data/characters.all.5.json',
          '/data/costumes.all.5.json',
        ],
        { cwd: partRoot },
      )
      await run('git', ['checkout', '--detach', revision], {
        cwd: partRoot,
      })
      await rename(partRoot, checkoutRoot)
    } catch (error) {
      await rm(partRoot, { force: true, recursive: true })
      throw error
    }
  }

  const gitMetadata = await lstat(gitDirectory)
  if (!gitMetadata.isDirectory() || gitMetadata.isSymbolicLink()) {
    throw new Error('Debug snapshot .git must be a real directory.')
  }

  const origin = await capture(
    'git',
    ['remote', 'get-url', 'origin'],
    checkoutRoot,
  )
  if (origin !== sourceRepositoryUrl) {
    throw new Error(`Unexpected debug snapshot origin: ${origin}`)
  }
  await run(
    'git',
    ['sparse-checkout', 'init', '--no-cone'],
    { cwd: checkoutRoot },
  )
  await run(
    'git',
    [
      'sparse-checkout',
      'set',
      '--no-cone',
      '/sdchara/',
      '/data/characters.all.5.json',
      '/data/costumes.all.5.json',
    ],
    { cwd: checkoutRoot },
  )
  let head = await capture('git', ['rev-parse', 'HEAD'], checkoutRoot)
  if (head !== revision) {
    await run('git', ['fetch', '--depth=1', 'origin', revision], {
      cwd: checkoutRoot,
    })
    await run('git', ['checkout', '--detach', revision], {
      cwd: checkoutRoot,
    })
    head = await capture('git', ['rev-parse', 'HEAD'], checkoutRoot)
  }
  if (head !== revision) {
    throw new Error(`Debug snapshot HEAD mismatch: ${head}`)
  }
  const status = await capture('git', ['status', '--porcelain'], checkoutRoot)
  if (status) {
    throw new Error('Debug snapshot checkout has local modifications.')
  }
  const commitDate = await capture(
    'git',
    ['show', '-s', '--format=%cI', 'HEAD'],
    checkoutRoot,
  )
  return new Date(commitDate).toISOString().replace('.000Z', 'Z')
}

async function walkFiles(directory, root = checkoutRoot) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === '.git') continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(path, root)))
    } else if (entry.isFile()) {
      files.push(relative(root, path).replaceAll('\\', '/'))
    } else {
      throw new Error(`Debug snapshot contains a non-regular entry: ${path}`)
    }
  }
  return files
}

async function readCheckoutFile(path) {
  if (!isSafeRelativePath(path)) {
    throw new Error(`Unsafe checkout file path: ${path}`)
  }
  const absolutePath = resolve(checkoutRoot, path)
  const metadata = await lstat(absolutePath)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Checkout asset must be a regular file: ${path}`)
  }
  const [actualCheckoutRoot, actualPath] = await Promise.all([
    realpath(checkoutRoot),
    realpath(absolutePath),
  ])
  if (!isInside(actualCheckoutRoot, actualPath)) {
    throw new Error(`Checkout asset resolves outside the snapshot: ${path}`)
  }
  return readFile(absolutePath)
}

async function buildInventory() {
  const paths = (await walkFiles(checkoutRoot)).sort()
  const entries = []
  let totalBytes = 0
  for (const path of paths) {
    const bytes = await readCheckoutFile(path)
    totalBytes += bytes.byteLength
    entries.push({
      path,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    })
  }
  return { entries, totalBytes }
}

async function atomicWrite(path, bytes) {
  await mkdir(dirname(path), { mode: 0o700, recursive: true })
  const partPath = `${path}.part-${process.pid}`
  await rm(partPath, { force: true })
  await writeFile(partPath, bytes, { flag: 'wx', mode: 0o600 })
  try {
    await rename(partPath, path)
  } catch (error) {
    await rm(partPath, { force: true })
    throw error
  }
  await chmod(path, 0o600)
}

async function createCanonicalFixture() {
  const canonicalFiles = new Map()
  for (const descriptor of fixture.files) {
    const bytes = await readCheckoutFile(descriptor.sourcePath)
    const actualHash = sha256(bytes)
    if (
      bytes.byteLength !== descriptor.bytes ||
      actualHash !== descriptor.sha256
    ) {
      throw new Error(
        `Approved debug fixture mismatch: ${descriptor.sourcePath}`,
      )
    }
    if (descriptor.canonicalPath) {
      canonicalFiles.set(descriptor.canonicalPath, bytes)
    }
  }

  const skeleton = fixture.files.find((file) => file.role === 'skeleton')
  const atlas = fixture.files.find((file) => file.role === 'atlas')
  if (!skeleton?.canonicalPath || !atlas?.canonicalPath) {
    throw new Error('Debug fixture requires canonical skeleton and atlas paths.')
  }
  const files = Object.fromEntries(
    [...canonicalFiles].map(([path, bytes]) => [path, sha256(bytes)]),
  )
  const packManifest = {
    schemaVersion: 1,
    gameId: 'garupa',
    assetFamily: 'sdchara',
    sdAssetBundleName: fixture.sdAssetBundleName,
    modelName: fixture.modelName,
    skeletonPath: skeleton.canonicalPath,
    atlasPath: atlas.canonicalPath,
    files,
    provenance: {
      sourceKind: 'github-mirror',
      sourceRevision: revision,
      acquiredAt: manifest.approvedAt,
    },
  }
  const packManifestBytes = Buffer.from(
    JSON.stringify(packManifest, null, 2) + '\n',
  )
  const fixtureRoot = resolve(canonicalRoot, fixture.id)
  await rm(fixtureRoot, { force: true, recursive: true })
  await ensureOwnerDirectory(fixtureRoot)
  await atomicWrite(
    resolve(fixtureRoot, 'garupa-spine-pack.json'),
    packManifestBytes,
  )
  for (const [path, bytes] of canonicalFiles) {
    await atomicWrite(resolve(fixtureRoot, path), bytes)
  }

  const writer = new ZipWriter(new BlobWriter('application/zip'))
  const zipEntries = [
    ['garupa-spine-pack.json', packManifestBytes],
    ...[...canonicalFiles],
  ].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  const deterministicZipDate = new Date(1980, 0, 1, 0, 0, 0, 0)
  for (const [path, bytes] of zipEntries) {
    await writer.add(path, new Uint8ArrayReader(bytes), {
      extendedTimestamp: false,
      lastModDate: deterministicZipDate,
      level: 6,
      useCompressionStream: false,
      useWebWorkers: false,
    })
  }
  const zipBlob = await writer.close()
  const zipBytes = Buffer.from(await zipBlob.arrayBuffer())
  const zipPath = resolve(canonicalRoot, `${fixture.id}.garupa-spine.zip`)
  await atomicWrite(zipPath, zipBytes)
  return {
    fixtureId: fixture.id,
    files,
    packManifestSha256: sha256(packManifestBytes),
    zipBytes: zipBytes.byteLength,
    zipPath: relative(snapshotRoot, zipPath).replaceAll('\\', '/'),
    zipSha256: sha256(zipBytes),
  }
}

function recordsMatch(left, right) {
  const leftEntries = Object.entries(left ?? {}).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  const rightEntries = Object.entries(right ?? {}).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries)
}

function assertApprovedSnapshot({
  canonical,
  commitDate,
  fileMetadataSha256,
  inventorySha256,
  inventory,
}) {
  const approvedFixture = provenance.representativeFixture
  const mismatches = [
    [commitDate !== provenance.commitDate, 'commit date'],
    [inventory.entries.length !== provenance.inventory?.files, 'file count'],
    [inventory.totalBytes !== provenance.inventory?.bytes, 'byte count'],
    [inventorySha256 !== provenance.inventory?.sha256InventorySha256, 'inventory hash'],
    [fileMetadataSha256 !== provenance.inventory?.fileMetadataSha256, 'file metadata hash'],
    [canonical.fixtureId !== approvedFixture?.id, 'fixture ID'],
    [!recordsMatch(canonical.files, approvedFixture?.canonicalFiles), 'canonical files'],
    [canonical.packManifestSha256 !== approvedFixture?.packManifestSha256, 'pack manifest hash'],
    [canonical.zipBytes !== approvedFixture?.canonicalZipBytes, 'ZIP byte count'],
    [canonical.zipSha256 !== approvedFixture?.canonicalZipSha256, 'ZIP hash'],
  ]
    .filter(([mismatch]) => mismatch)
    .map(([, label]) => label)
  if (mismatches.length > 0) {
    throw new Error(
      `Private Garupa snapshot does not match approved QA provenance: ${mismatches.join(', ')}`,
    )
  }
}

await ensureOwnerDirectory(privateRoot, {
  recursive: true,
  repairPermissions: !configuredRoot,
})
await assertPhysicallyOutsideRepository(privateRoot)
await assertOutsidePublicAssets(privateRoot)
for (const privateDirectory of [
  resolve(privateRoot, 'garupa'),
  resolve(privateRoot, 'garupa', 'bangdream-live2d'),
  snapshotRoot,
  auditRoot,
  canonicalRoot,
]) {
  await ensureOwnerDirectory(privateDirectory)
  await assertPhysicallyOutsideRepository(privateDirectory)
}
const lockPath = resolve(snapshotRoot, '.backup.lock')
let lock
try {
  lock = await open(lockPath, 'wx', 0o600)
} catch (error) {
  if (error?.code === 'EEXIST') {
    throw new Error(`Another Garupa backup is already running: ${lockPath}`)
  }
  throw error
}

try {
  await rm(resolve(auditRoot, 'acquisition.json'), { force: true })
  const commitDate = await prepareCheckout()
  const inventory = await buildInventory()
  const canonical = await createCanonicalFixture()
  const sha256InventoryBytes = Buffer.from(
    inventory.entries
      .map((entry) => `${entry.sha256}  ${entry.path}`)
      .join('\n') + '\n',
  )
  const fileMetadataBytes = Buffer.from(
    inventory.entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
  )
  const inventorySha256 = sha256(sha256InventoryBytes)
  const fileMetadataSha256 = sha256(fileMetadataBytes)
  assertApprovedSnapshot({
    canonical,
    commitDate,
    fileMetadataSha256,
    inventory,
    inventorySha256,
  })
  const receipt = {
    schemaVersion: 1,
    gameId: 'garupa',
    assetFamily: 'sdchara',
    repository: sourceRepositoryUrl,
    sourceRevision: revision,
    commitDate,
    sparsePaths: [
      '/sdchara/',
      '/data/characters.all.5.json',
      '/data/costumes.all.5.json',
    ],
    upstream: manifest.upstream,
    licenseStatus: manifest.licenseStatus,
    inventory: {
      files: inventory.entries.length,
      bytes: inventory.totalBytes,
      sha256File: {
        path: 'audit/files.sha256',
        sha256: inventorySha256,
      },
      metadataFile: {
        path: 'audit/files.jsonl',
        sha256: fileMetadataSha256,
      },
    },
    canonical,
  }
  await atomicWrite(resolve(auditRoot, 'files.sha256'), sha256InventoryBytes)
  await atomicWrite(resolve(auditRoot, 'files.jsonl'), fileMetadataBytes)
  await atomicWrite(
    resolve(auditRoot, 'acquisition.json'),
    Buffer.from(JSON.stringify(receipt, null, 2) + '\n'),
  )

  console.log(`Garupa debug snapshot ready: ${snapshotRoot}`)
  console.log(
    `Pinned ${inventory.entries.length} files (${inventory.totalBytes} bytes) at ${revision}.`,
  )
  console.log(`Canonical ZIP SHA-256: ${canonical.zipSha256}`)
} finally {
  await lock.close()
  await rm(lockPath, { force: true })
}
