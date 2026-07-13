import { createHash } from 'node:crypto'
import {
  access,
  mkdir,
  readdir,
  writeFile,
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DEFAULT_BASE_URL = 'https://karth.top/api/'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3
const CHARACTER_DETAIL_CONCURRENCY = 3
const LOCALE_KEYS = ['ja', 'en', 'ko', 'zh_hant']

function usage() {
  return [
    'Usage:',
    '  node scripts/backupKarthApi.mjs --output <directory> [options]',
    '',
    'Options:',
    `  --base-url <url>          API root (default: ${DEFAULT_BASE_URL})`,
    '  --consumer-commit <sha>   KarthuriaApp source commit observed with the API',
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
    baseUrl: DEFAULT_BASE_URL,
    consumerCommit: null,
    outputRoot: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      console.log(usage())
      process.exit(0)
    }
    const value = readOption(argv, index, argument)
    if (argument === '--output') {
      options.outputRoot = resolve(value)
    } else if (argument === '--base-url') {
      options.baseUrl = value
    } else if (argument === '--consumer-commit') {
      if (!/^[0-9a-f]{40}$/iu.test(value)) {
        throw new Error('--consumer-commit must be a 40-character Git SHA.')
      }
      options.consumerCommit = value.toLocaleLowerCase('en-US')
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
    index += 1
  }

  if (!options.outputRoot) {
    throw new Error(`--output is required.\n\n${usage()}`)
  }

  const baseUrl = new URL(options.baseUrl)
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password) {
    throw new Error('--base-url must be an HTTPS URL without credentials.')
  }
  baseUrl.search = ''
  baseUrl.hash = ''
  if (!baseUrl.pathname.endsWith('/')) {
    baseUrl.pathname += '/'
  }
  options.baseUrl = baseUrl.href
  return options
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

function selectedHeaders(headers) {
  const result = {}
  for (const name of [
    'cache-control',
    'content-length',
    'content-type',
    'date',
    'etag',
    'last-modified',
  ]) {
    const value = headers.get(name)
    if (value !== null) {
      result[name] = value
    }
  }
  return result
}

function decodeJson(bytes, path) {
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    throw new Error(`${path} is not valid UTF-8.`, { cause: error })
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${path} is not valid JSON.`, { cause: error })
  }
}

async function ensureEmptyOutput(outputRoot) {
  try {
    await access(outputRoot)
    const entries = await readdir(outputRoot)
    if (entries.length > 0) {
      throw new Error(`Backup output directory is not empty: ${outputRoot}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
  await mkdir(outputRoot, { recursive: true })
}

async function fetchWithRetry(url) {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'livesd-pet-builder-karth-metadata-backup/1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS) {
        await delay(400 * attempt)
      }
    }
  }
  throw lastError ?? new Error(`Unable to fetch ${url}`)
}

async function mapWithConcurrency(values, concurrency, task) {
  const results = new Array(values.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await task(values[index], index)
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => worker(),
    ),
  )
  return results
}

function normalizeNames(value) {
  const names = {}
  if (!isRecord(value)) {
    return names
  }
  for (const locale of LOCALE_KEYS) {
    const name = value[locale]
    if (typeof name === 'string' && name.trim()) {
      names[locale] = name.trim()
    }
  }
  return names
}

function numericIdCompare(left, right) {
  return Number(left) - Number(right)
}

function buildNormalizedCatalog(charaList, charaDetails, dressList, capturedAt) {
  if (!isRecord(charaList) || !isRecord(dressList)) {
    throw new Error('Karth chara.json and dress.json roots must be objects.')
  }

  const editionsByCharacter = new Map()
  for (const value of Object.values(dressList)) {
    const basicInfo = isRecord(value) && isRecord(value.basicInfo)
      ? value.basicInfo
      : null
    const editionId = String(basicInfo?.cardID ?? '')
    const characterId = String(basicInfo?.character ?? '')
    if (!/^\d{1,16}$/u.test(editionId) || !/^\d{1,8}$/u.test(characterId)) {
      continue
    }
    const editions = editionsByCharacter.get(characterId) ?? []
    editions.push({
      id: editionId,
      names: normalizeNames(basicInfo.name),
      rarity: Number.isSafeInteger(basicInfo.rarity)
        ? basicInfo.rarity
        : null,
      released: isRecord(basicInfo.released)
        ? {
            ja: Number.isSafeInteger(basicInfo.released.ja)
              ? basicInfo.released.ja
              : null,
            ww: Number.isSafeInteger(basicInfo.released.ww)
              ? basicInfo.released.ww
              : null,
          }
        : null,
    })
    editionsByCharacter.set(characterId, editions)
  }

  const characters = Object.keys(charaList)
    .filter((id) => /^\d{1,8}$/u.test(id))
    .sort(numericIdCompare)
    .map((id) => {
      const listEntry = isRecord(charaList[id]) ? charaList[id] : {}
      const detail = isRecord(charaDetails.get(id))
        ? charaDetails.get(id)
        : {}
      const basicInfo = isRecord(detail.basicInfo)
        ? detail.basicInfo
        : isRecord(listEntry.basicInfo)
          ? listEntry.basicInfo
          : {}
      const info = isRecord(detail.info) ? detail.info : {}
      const editions = editionsByCharacter.get(id) ?? []
      editions.sort((left, right) => numericIdCompare(left.id, right.id))
      return {
        id,
        names: normalizeNames(info.name),
        schoolId: Number.isSafeInteger(basicInfo.school_id)
          ? basicInfo.school_id
          : null,
        editions,
      }
    })

  return {
    schemaVersion: 1,
    source: 'Karth fan archive API metadata snapshot',
    capturedAt,
    characters,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  await ensureEmptyOutput(options.outputRoot)

  const capturedAt = new Date().toISOString()
  const files = []

  const fetchJson = async (relativePath) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9_./-]*\.json$/u.test(relativePath) ||
        relativePath.includes('..')) {
      throw new Error(`Unsafe API path: ${relativePath}`)
    }
    const url = new URL(relativePath, options.baseUrl)
    if (url.origin !== new URL(options.baseUrl).origin ||
        !url.pathname.startsWith(new URL(options.baseUrl).pathname)) {
      throw new Error(`API path escaped the configured root: ${relativePath}`)
    }

    const response = await fetchWithRetry(url)
    const bytes = Buffer.from(await response.arrayBuffer())
    const value = decodeJson(bytes, relativePath)
    const localPath = `raw/${relativePath}`
    const outputPath = resolve(options.outputRoot, localPath)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, bytes)
    files.push({
      bytes: bytes.byteLength,
      headers: selectedHeaders(response.headers),
      localPath,
      sha256: sha256(bytes),
      status: response.status,
      url: response.url,
    })
    return value
  }

  console.log('Fetching Karth character and edition catalogs...')
  const charaList = await fetchJson('chara.json')
  const dressList = await fetchJson('dress.json')
  if (!isRecord(charaList)) {
    throw new Error('chara.json root must be an object.')
  }

  const characterIds = Object.keys(charaList)
    .filter((id) => /^\d{1,8}$/u.test(id))
    .sort(numericIdCompare)
  console.log(`Fetching ${characterIds.length} character detail records...`)
  const charaDetails = new Map()
  await mapWithConcurrency(
    characterIds,
    CHARACTER_DETAIL_CONCURRENCY,
    async (id) => {
      const detail = await fetchJson(`chara/${id}.json`)
      charaDetails.set(id, detail)
    },
  )

  const normalizedCatalog = buildNormalizedCatalog(
    charaList,
    charaDetails,
    dressList,
    capturedAt,
  )
  const normalizedBytes = Buffer.from(
    `${JSON.stringify(normalizedCatalog, null, 2)}\n`,
    'utf8',
  )
  await mkdir(resolve(options.outputRoot, 'normalized'), { recursive: true })
  await writeFile(
    resolve(options.outputRoot, 'normalized/catalog.json'),
    normalizedBytes,
  )

  files.sort((left, right) => left.localPath.localeCompare(right.localPath, 'en'))
  const manifest = {
    schemaVersion: 1,
    complete: true,
    capturedAt,
    source: {
      apiBaseUrl: options.baseUrl,
      consumerRepository: 'https://github.com/pnthach95/KarthuriaApp',
      consumerCommit: options.consumerCommit,
      fetchedEndpointPatterns: [
        'chara.json',
        'chara/{id}.json',
        'dress.json',
      ],
      note: 'Raw API bytes are preserved. normalized/catalog.json is generated locally for character-to-edition selection and is not an upstream response.',
    },
    counts: {
      characters: normalizedCatalog.characters.length,
      editions: normalizedCatalog.characters.reduce(
        (total, character) => total + character.editions.length,
        0,
      ),
      upstreamFiles: files.length,
    },
    files,
    generatedFiles: [
      {
        bytes: normalizedBytes.byteLength,
        localPath: 'normalized/catalog.json',
        sha256: sha256(normalizedBytes),
      },
    ],
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(resolve(options.outputRoot, 'manifest.json'), manifestBytes)

  const checksumLines = [
    ...files.map((file) => `${file.sha256}  ${file.localPath}`),
    `${sha256(normalizedBytes)}  normalized/catalog.json`,
    `${sha256(manifestBytes)}  manifest.json`,
  ]
  await writeFile(
    resolve(options.outputRoot, 'SHA256SUMS'),
    `${checksumLines.join('\n')}\n`,
    'utf8',
  )

  console.log('Karth API backup complete.')
  console.log(`  output: ${options.outputRoot}`)
  console.log(`  characters: ${manifest.counts.characters}`)
  console.log(`  editions: ${manifest.counts.editions}`)
  console.log(`  upstream files: ${manifest.counts.upstreamFiles}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
