import { createHash } from 'node:crypto'
import { access, readFile, readdir } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const distRoot = resolve(repositoryRoot, 'dist')
const requiredFiles = [
  'vendor/estertion-spine-3.6/spine-webgl.js',
  'vendor/estertion-spine-3.6/LICENSE',
  'vendor/estertion-spine-3.6/THIRD_PARTY_NOTICES.md',
  'vendor/esotericsoftware-spine-4.0.31/LICENSE',
  'vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
  'client/vendor/esotericsoftware-spine-4.0.31/LICENSE',
  'client/vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
  'manifests/garupa/bangdream-live2d.v1.json',
  'client/manifests/garupa/bangdream-live2d.v1.json',
]

for (const relativePath of requiredFiles) {
  await access(resolve(distRoot, relativePath))
}

async function listFiles(directory, root = distRoot) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath, root)))
    } else {
      files.push(relative(root, entryPath).replaceAll('\\', '/'))
    }
  }

  return files
}

const outputFiles = await listFiles(distRoot)
const allowedSpine40NoticePaths = new Set([
  'vendor/esotericsoftware-spine-4.0.31/LICENSE',
  'vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
  'client/vendor/esotericsoftware-spine-4.0.31/LICENSE',
  'client/vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
])
const unapprovedSpine40Files = outputFiles.filter(
  (path) =>
    /(?:esotericsoftware|spine-webgl-4\.0|spine40-local)/i.test(path) &&
    !allowedSpine40NoticePaths.has(path),
)
if (unapprovedSpine40Files.length > 0) {
  throw new Error(
    `Production build contains unapproved standalone Spine 4.0 files: ${unapprovedSpine40Files.join(', ')}`,
  )
}
const spine40LicensePaths = [
  'vendor/esotericsoftware-spine-4.0.31/LICENSE',
  'client/vendor/esotericsoftware-spine-4.0.31/LICENSE',
]
for (const path of spine40LicensePaths) {
  const digest = createHash('sha256')
    .update(await readFile(resolve(distRoot, path)))
    .digest('hex')
  if (digest !== '8f9c3dbc5bbb98eb042bfe6f9e8e4c0fab32eb256b2767bd4fc7f87d27f60619') {
    throw new Error(`Production Spine 4.0 license notice changed: ${path}`)
  }
}
const spine40NoticePaths = [
  'vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
  'client/vendor/esotericsoftware-spine-4.0.31/THIRD_PARTY_NOTICES.md',
]
for (const path of spine40NoticePaths) {
  const notice = await readFile(resolve(distRoot, path), 'utf8')
  if (
    !notice.includes('@esotericsoftware/spine-webgl@4.0.31') ||
    !notice.includes('Copyright (c) 2013-2019, Esoteric Software LLC') ||
    !notice.includes(
      'Public preview and production artifact inclusion are approved',
    ) ||
    !notice.includes('Release and push remain blocked')
  ) {
    throw new Error(`Production Spine 4.0 notice is incomplete: ${path}`)
  }
}
const approvedGarupaManifestSha256 =
  '4db947430d85efc5d854945dda4d7c8ba5c5c571d4b71deaba49660d84f885fe'
const manifestOutputPaths = [
  'manifests/garupa/bangdream-live2d.v1.json',
  'client/manifests/garupa/bangdream-live2d.v1.json',
]
const manifestOutputs = await Promise.all(
  manifestOutputPaths.map((path) => readFile(resolve(distRoot, path))),
)
for (const [index, manifestBytes] of manifestOutputs.entries()) {
  const digest = createHash('sha256').update(manifestBytes).digest('hex')
  if (
    manifestBytes.byteLength > 8192 ||
    digest !== approvedGarupaManifestSha256
  ) {
    throw new Error(
      `Production Garupa provider manifest is not byte-identical to the approved pin: ${manifestOutputPaths[index]}`,
    )
  }
}
const garupaProviderManifest = JSON.parse(manifestOutputs[0].toString('utf8'))
const approvedGarupaRevision =
  '15b3e023cfdc576212f8b3a6b001c9f26e755f23'
const approvedGarupaDeliveryBase =
  `https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@${approvedGarupaRevision}`
if (
  garupaProviderManifest.schemaVersion !== 1 ||
  garupaProviderManifest.status !== 'experimental' ||
  garupaProviderManifest.gameId !== 'garupa' ||
  garupaProviderManifest.assetFamily !== 'sdchara' ||
  garupaProviderManifest.repository?.sourceRevision !== approvedGarupaRevision ||
  garupaProviderManifest.delivery?.baseUrl !== approvedGarupaDeliveryBase ||
  garupaProviderManifest.delivery?.requestPolicy?.range !== 'forbidden' ||
  garupaProviderManifest.licenseStatus !== 'not-declared' ||
  garupaProviderManifest.catalogs?.assetIndex?.sha256 !==
    'bbbfa18d864c80b6d4464b3ec0f15cafad1a327e1bf265db474b80274567bea9'
) {
  throw new Error('Production Garupa provider manifest is not the approved pin.')
}
const forbiddenModelFiles = outputFiles.filter((path) => {
  const lowerPath = path.toLowerCase()
  const basename = lowerPath.slice(lowerPath.lastIndexOf('/') + 1)

  return (
    lowerPath.startsWith('assets/prsk/') ||
    lowerPath.includes('/assets/prsk/') ||
    basename.endsWith('.skel') ||
    basename.endsWith('.atlas') ||
    basename.endsWith('.atlas.txt') ||
    basename.endsWith('.png') ||
    basename.endsWith('.zip') ||
    basename.endsWith('.asset') ||
    basename.endsWith('.bundle') ||
    basename.endsWith('.unity3d') ||
    basename.endsWith('-builddata.asset') ||
    lowerPath.includes('.debug-fixtures/') ||
    basename === 'sekai_atlas.atlas' ||
    basename === 'sekai_atlas.png' ||
    basename === 'catalog.json' ||
    lowerPath.includes('/generated-catalog') ||
    /(?:character|animation)[-_]?(?:catalog|list)\.(?:json|txt)$/.test(
      basename,
    )
  )
})

if (forbiddenModelFiles.length > 0) {
  throw new Error(
    `Production build contains model assets: ${forbiddenModelFiles.join(', ')}`,
  )
}

const forbiddenContentHashes = new Set([
  'bda0e41031f0b95c37ebd5d051da88b04f895f80771ce2259bc9cd90ff83adaa',
  '1b4de69f9f2ddcfb1ba7b3a000fbbaaa42b685e86fda4b3f248011ee84ca385f',
  'b4a5f30486dc55ee43e8704cb3b801075e2bb566af53099af1583be13cfdcb6b',
  'ccb1a04d1b51b920d0e12193716160cfd50f79aad0bca9610ea082cebbbe9cd4',
  '9ceb0a645f0132133ffeb770f939f8e62da3908b99d4f43b40073c03051e2364',
  'e2eb5f329e89b751808bb897e2261e33f93d9d5c6e583c32b2521d289a9e2eb8',
])
const leakedOutputFiles = []
for (const path of outputFiles) {
  const fileBytes = await readFile(resolve(distRoot, path))
  const digest = createHash('sha256').update(fileBytes).digest('hex')
  const isPng =
    fileBytes.length >= 8 &&
    fileBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isZip =
    fileBytes.length >= 4 &&
    fileBytes[0] === 0x50 &&
    fileBytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(fileBytes[2]) &&
    [0x04, 0x06, 0x08].includes(fileBytes[3])
  if (isPng || isZip || forbiddenContentHashes.has(digest)) {
    leakedOutputFiles.push(path)
  }
}
if (leakedOutputFiles.length > 0) {
  throw new Error(
    `Production build contains forbidden binary/model bytes: ${leakedOutputFiles.join(', ')}`,
  )
}
const inspectableFiles = outputFiles.filter((path) =>
  /\.(?:css|html|js|json|txt)$/.test(path.toLowerCase()),
)
const bundledText = (
  await Promise.all(
    inspectableFiles.map((path) => readFile(resolve(distRoot, path), 'utf8')),
  )
).join('\n')
if (
  !bundledText.includes(
    'spine-4.0:@esotericsoftware/spine-webgl@4.0.31',
  ) ||
  !bundledText.includes('DISABLE_UNPACK_PREMULTIPLIED_ALPHA_WEBGL')
) {
  throw new Error(
    'Production build is missing the approved lazy Spine 4.0 runtime JavaScript.',
  )
}
const approvedInlinePayloadHashes = new Set([
  // @zip.js/zip.js 2.8.26 zlib WebAssembly payload.
  '7afa4a3f66925cb403280d4369feb712a1a00a1ef040cfdb87b12d06c2c0dea2',
  // Vendored estertion Spine 3.6 LoadingScreen PNGs.
  '57efe645b26f8ea451cfa4430f12c6f635b553004c410e117269b8e371da726c',
  '7c308c9cc9c3ba745d1833bc0a7efafd1021fad88c2dacb757388b0b36f5b862',
  // Official @esotericsoftware/spine-webgl 4.0.31 LoadingScreen PNGs.
  'ee676857db46124e666640e697f82228f5a05499503eba6164255e7c7a99b434',
  '33b53cc8c1a4b59ead1c9f69025a462664299aba3ca4c41d11a48af4375f5822',
])
const unexpectedInlinePayloads = (
  bundledText.match(/[A-Za-z0-9+/]{4096,}={0,2}/g) ?? []
).filter(
  (payload) =>
    !approvedInlinePayloadHashes.has(
      createHash('sha256').update(payload).digest('hex'),
    ),
)
const unexpectedDataUriPayloads = Array.from(
  bundledText.matchAll(
    /data:(?:image\/png|application\/(?:zip|octet-stream));base64,([A-Za-z0-9+/]+={0,2})/gi,
  ),
  (match) => match[1] ?? '',
).filter(
  (payload) =>
    !approvedInlinePayloadHashes.has(
      createHash('sha256').update(payload).digest('hex'),
    ),
)
if (
  unexpectedInlinePayloads.length > 0 ||
  unexpectedDataUriPayloads.length > 0
) {
  throw new Error('Production build contains an inline binary payload.')
}

const configuredBasePath = process.env.DEPLOY_BASE_PATH?.trim()
if (configuredBasePath) {
  const basePath = configuredBasePath.endsWith('/')
    ? configuredBasePath
    : `${configuredBasePath}/`
  const indexHtml = await readFile(resolve(distRoot, 'index.html'), 'utf8')
  const runtimeRootUrl =
    `${basePath}vendor/estertion-spine-3.6`

  if (!indexHtml.includes(`${basePath}assets/`)) {
    throw new Error(
      `Production index does not use the configured base path: ${basePath}`,
    )
  }
  if (!bundledText.includes(runtimeRootUrl)) {
    throw new Error(
      `Production runtime URL does not use the configured base path: ${runtimeRootUrl}`,
    )
  }
}

const forbiddenEmbeddedValues = [
  {
    label: 'fixed PRSK character ID',
    pattern: /\bsd_[A-Za-z0-9_.-]{2,}\b/,
  },
  {
    label: 'fixed sample animation option',
    pattern: /\bm_(?:normal|wait|idle|talk|walk|run)_[A-Za-z0-9_]+\b/,
  },
  {
    label: 'test or user-specific remote origin',
    pattern: /https?:\/\/(?:assets\.)?example\.(?:com|test)|https?:\/\/localhost(?::\d+)?\/area_sd/,
  },
  {
    label: 'unapproved Garupa asset endpoint',
    pattern:
      /https?:\/\/(?:bestdori\.com|(?:www\.)?haneoka\.org|raw\.githubusercontent\.com)\//,
  },
  {
    label: 'mutable bangdream-live2d delivery URL',
    pattern:
      /https:\/\/cdn\.jsdelivr\.net\/gh\/panxuc\/bangdream-live2d@(?!15b3e023cfdc576212f8b3a6b001c9f26e755f23(?:\/|['"`]))(?!\$\{)/,
  },
]

for (const { label, pattern } of forbiddenEmbeddedValues) {
  if (pattern.test(bundledText)) {
    throw new Error(`Production build contains ${label}.`)
  }
}

const localeStorageKey = 'chibi-to-codex-pet.locale.v1'
if (!bundledText.includes(localeStorageKey)) {
  throw new Error('Production build is missing the versioned locale storage key.')
}
const petPresetStorageKey = 'chibi-to-codex-pet.pet-presets.v1'
if (!bundledText.includes(petPresetStorageKey)) {
  throw new Error('Production build is missing the versioned Pet preset storage key.')
}

for (const persistenceApi of ['sessionStorage', 'indexedDB']) {
  if (bundledText.includes(persistenceApi)) {
    throw new Error(
      `Production build unexpectedly persists remote input via ${persistenceApi}.`,
    )
  }
}

const sourceRoot = resolve(repositoryRoot, 'src')
const allowedLocalStorageFiles = new Set([
  'features/codex-pet/settingsPresets.ts',
  'i18n/I18nProvider.tsx',
  'i18n/locale.ts',
])
const allowedSpine40SourceFiles = new Set([
  'features/livesd/garupa/rendering/runtimeAdapter.ts',
  'features/livesd/runtime/Spine40RuntimeLoader.ts',
  'features/livesd/runtime/Spine40RuntimeProfileAdapter.ts',
])
const allowedDynamicGarupaPinSourceFiles = new Set([
  'features/livesd/garupa/remote/providerManifest.ts',
])
const productionSourceFiles = (await listFiles(sourceRoot, sourceRoot)).filter(
  (path) =>
    /\.[cm]?[jt]sx?$/.test(path) &&
    !path.includes('.test.') &&
    !path.startsWith('test/'),
)

for (const path of productionSourceFiles) {
  const source = await readFile(resolve(sourceRoot, path), 'utf8')
  if (
    source.includes('@esotericsoftware/spine-webgl') &&
    !allowedSpine40SourceFiles.has(path)
  ) {
    throw new Error(
      `Source outside the approved integration boundary imports Spine 4.0: ${path}`,
    )
  }
  if (
    source.includes(
      'https://cdn.jsdelivr.net/gh/panxuc/bangdream-live2d@${',
    ) &&
    !allowedDynamicGarupaPinSourceFiles.has(path)
  ) {
    throw new Error(
      `Source outside the approved manifest validator constructs a dynamic Garupa delivery URL: ${path}`,
    )
  }
  if (source.includes('localStorage') && !allowedLocalStorageFiles.has(path)) {
    throw new Error(
      `Production source uses localStorage outside the locale and Pet preset allowlist: ${path}`,
    )
  }
  for (const persistenceApi of ['sessionStorage', 'indexedDB']) {
    if (source.includes(persistenceApi)) {
      throw new Error(
        `Production source unexpectedly uses ${persistenceApi}: ${path}`,
      )
    }
  }
}

console.log(
  'Verified production runtime notices, approved lazy Spine 4.0 JS inclusion, Garupa provider pin, locale/Pet-preset-only storage, and exclusion of model assets, debug fixtures, generated catalogs, fixed option lists, and persisted user URLs.',
)
