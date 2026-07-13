import { createHash } from 'node:crypto'
import {
  access,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

const PROVIDER_NAME = 'karth'
const STATIC_API_ROOT = 'api/karth'

function usage() {
  return [
    'Usage:',
    '  node scripts/installKarthStaticSnapshot.mjs \\',
    '    --backup <karth-backup-directory> \\',
    '    --archive <local-backup-directory> [--snapshot-id YYYYMMDD]',
  ].join('\n')
}

function readOption(argv, index, option) {
  const value = argv[index + 1]
  if (!value || value === '--' || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`)
  }
  return value
}

function parseArgs(argv) {
  const options = {
    backupRoot: '',
    archiveRoot: '',
    snapshotId: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      console.log(usage())
      process.exit(0)
    }
    const value = readOption(argv, index, argument)
    if (argument === '--backup') {
      options.backupRoot = resolve(value)
    } else if (argument === '--archive') {
      options.archiveRoot = resolve(value)
    } else if (argument === '--snapshot-id') {
      options.snapshotId = value
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
    index += 1
  }

  if (!options.backupRoot || !options.archiveRoot) {
    throw new Error(`--backup and --archive are required.\n\n${usage()}`)
  }
  if (options.snapshotId !== null && !/^\d{8}$/u.test(options.snapshotId)) {
    throw new Error('--snapshot-id must use YYYYMMDD.')
  }
  return options
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function sha256File(path) {
  return sha256(await readFile(path))
}

function parseJson(bytes, label) {
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8.`, { cause: error })
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} is not valid JSON.`, { cause: error })
  }
}

function safeRelativePath(value, label) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe ${label}: ${String(value)}`)
  }
  return value
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`Invalid SHA-256 for ${label}.`)
  }
  return value
}

function deriveSnapshotId(capturedAt) {
  if (typeof capturedAt !== 'string') {
    throw new Error('Backup manifest is missing capturedAt.')
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T/u.exec(capturedAt)
  if (!match) {
    throw new Error('Backup capturedAt is not an ISO timestamp.')
  }
  return `${match[1]}${match[2]}${match[3]}`
}

async function ensureEmptyTarget(targetRoot) {
  try {
    await access(targetRoot)
    if ((await readdir(targetRoot)).length > 0) {
      throw new Error(`Static snapshot target is not empty: ${targetRoot}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
  await mkdir(targetRoot, { recursive: true })
}

function validateBackupManifest(value) {
  if (
    !isRecord(value) ||
    value.complete !== true ||
    !isRecord(value.source) ||
    value.source.apiBaseUrl !== 'https://karth.top/api/' ||
    !isRecord(value.counts) ||
    !Array.isArray(value.files)
  ) {
    throw new Error('Karth backup manifest is incomplete or invalid.')
  }
  if (
    !Number.isSafeInteger(value.counts.upstreamFiles) ||
    value.counts.upstreamFiles !== value.files.length
  ) {
    throw new Error('Karth backup upstream file count does not match its manifest.')
  }
  return value
}

async function materializeUpstreamFiles({
  backupRoot,
  backupManifest,
  targetRoot,
}) {
  const seenPaths = new Set()
  const records = []

  for (const sourceRecord of backupManifest.files) {
    if (!isRecord(sourceRecord)) {
      throw new Error('Karth backup contains an invalid file record.')
    }
    const sourcePath = safeRelativePath(sourceRecord.localPath, 'backup path')
    if (!sourcePath.startsWith('raw/')) {
      throw new Error(`Expected a raw API response path: ${sourcePath}`)
    }
    const staticPath = safeRelativePath(
      sourcePath.slice('raw/'.length),
      'static API path',
    )
    if (seenPaths.has(staticPath)) {
      throw new Error(`Duplicate static API path: ${staticPath}`)
    }
    seenPaths.add(staticPath)

    const sourceUrl = new URL(String(sourceRecord.url))
    if (!sourceUrl.href.startsWith('https://karth.top/api/')) {
      throw new Error(`Unexpected upstream API URL: ${sourceUrl.href}`)
    }
    const expectedSha256 = assertSha256(sourceRecord.sha256, sourcePath)
    if (!Number.isSafeInteger(sourceRecord.bytes) || sourceRecord.bytes < 1) {
      throw new Error(`Invalid byte count for ${sourcePath}.`)
    }

    const sourceBytes = await readFile(resolve(backupRoot, ...sourcePath.split('/')))
    if (sourceBytes.byteLength !== sourceRecord.bytes) {
      throw new Error(`Byte count mismatch for ${sourcePath}.`)
    }
    if (sha256(sourceBytes) !== expectedSha256) {
      throw new Error(`SHA-256 mismatch for ${sourcePath}.`)
    }
    parseJson(sourceBytes, sourcePath)

    const targetPath = resolve(targetRoot, ...staticPath.split('/'))
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, sourceBytes)
    records.push({
      path: staticPath,
      url: sourceUrl.href,
      status: sourceRecord.status,
      headers: sourceRecord.headers,
      bytes: sourceBytes.byteLength,
      sha256: expectedSha256,
    })
  }

  return records.sort((left, right) => left.path.localeCompare(right.path))
}

async function readJsonFile(path, label) {
  return parseJson(await readFile(path), label)
}

async function writeArchiveIndex(archiveRoot, snapshot) {
  const indexPath = resolve(archiveRoot, STATIC_API_ROOT, 'index.json')
  let snapshots = []
  try {
    const existing = await readJsonFile(indexPath, 'Karth static API index')
    if (isRecord(existing) && Array.isArray(existing.snapshots)) {
      snapshots = existing.snapshots.filter(
        (candidate) => isRecord(candidate) && candidate.id !== snapshot.id,
      )
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
  snapshots.push(snapshot)
  snapshots.sort((left, right) => String(left.id).localeCompare(String(right.id)))
  const index = {
    version: 1,
    provider: PROVIDER_NAME,
    defaultSnapshot: snapshot.id,
    snapshots,
  }
  await mkdir(dirname(indexPath), { recursive: true })
  await writeFile(indexPath, jsonBytes(index))
}

async function updateArchiveManifest(archiveRoot, snapshot) {
  const manifestPath = resolve(archiveRoot, 'manifest.json')
  const manifest = await readJsonFile(manifestPath, 'STRR provider manifest')
  if (!isRecord(manifest)) {
    throw new Error('STRR provider manifest root must be an object.')
  }
  const existing = Array.isArray(manifest.staticApiSnapshots)
    ? manifest.staticApiSnapshots.filter(
      (candidate) =>
        isRecord(candidate) &&
        !(candidate.provider === PROVIDER_NAME && candidate.id === snapshot.id),
    )
    : []
  existing.push(snapshot)
  existing.sort((left, right) => String(left.id).localeCompare(String(right.id)))
  manifest.staticApiSnapshots = existing
  await writeFile(manifestPath, jsonBytes(manifest))
}

async function listFiles(directory, root = directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path, root)))
    } else if (entry.isFile()) {
      files.push(relative(root, path).split(sep).join('/'))
    } else {
      throw new Error(`Unsupported provider filesystem entry: ${path}`)
    }
  }
  return files
}

async function refreshArchiveChecksums(archiveRoot) {
  const files = (await listFiles(archiveRoot))
    .filter((path) => path !== 'SHA256SUMS')
    .sort((left, right) => left.localeCompare(right))
  const records = []
  for (const path of files) {
    records.push(`${await sha256File(resolve(archiveRoot, ...path.split('/')))}  ${path}\n`)
  }
  await writeFile(resolve(archiveRoot, 'SHA256SUMS'), records.join(''), 'utf-8')
  return files.length
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const backupManifestPath = resolve(options.backupRoot, 'manifest.json')
  const backupManifestBytes = await readFile(backupManifestPath)
  const backupManifest = validateBackupManifest(
    parseJson(backupManifestBytes, 'Karth backup manifest'),
  )
  const snapshotId = options.snapshotId ?? deriveSnapshotId(backupManifest.capturedAt)
  const relativeBasePath = `${STATIC_API_ROOT}/${snapshotId}`
  const targetRoot = resolve(options.archiveRoot, ...relativeBasePath.split('/'))
  await ensureEmptyTarget(targetRoot)

  const files = await materializeUpstreamFiles({
    backupRoot: options.backupRoot,
    backupManifest,
    targetRoot,
  })
  const sourceBackupManifestSha256 = sha256(backupManifestBytes)
  const staticManifest = {
    version: 1,
    provider: PROVIDER_NAME,
    snapshotId,
    capturedAt: backupManifest.capturedAt,
    complete: true,
    source: {
      ...backupManifest.source,
      sourceBackupManifestSha256,
      note: (
        'Raw API response bytes are preserved under versioned local-backup paths. '
        + 'The application runtime does not read or serve this archive.'
      ),
    },
    counts: backupManifest.counts,
    files,
  }
  const staticManifestBytes = jsonBytes(staticManifest)
  await writeFile(resolve(targetRoot, 'manifest.json'), staticManifestBytes)
  const staticManifestSha256 = sha256(staticManifestBytes)

  const snapshotChecksums = [
    ...files.map((file) => `${file.sha256}  ${file.path}\n`),
    `${staticManifestSha256}  manifest.json\n`,
  ].sort((left, right) => left.localeCompare(right))
  await writeFile(
    resolve(targetRoot, 'SHA256SUMS'),
    snapshotChecksums.join(''),
    'utf-8',
  )

  const snapshotRecord = {
    provider: PROVIDER_NAME,
    id: snapshotId,
    capturedAt: backupManifest.capturedAt,
    relativeBasePath,
    manifestPath: `${relativeBasePath}/manifest.json`,
    manifestSha256: staticManifestSha256,
    sourceBackupManifestSha256,
    counts: backupManifest.counts,
  }
  await writeArchiveIndex(options.archiveRoot, snapshotRecord)
  await updateArchiveManifest(options.archiveRoot, snapshotRecord)
  const checksummedFiles = await refreshArchiveChecksums(options.archiveRoot)

  console.log('Karth static API snapshot installed.')
  console.log(`  snapshot: ${snapshotId}`)
  console.log(`  archive path: ${relativeBasePath}`)
  console.log(`  upstream files: ${files.length}`)
  console.log(`  archive checksummed files: ${checksummedFiles}`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
