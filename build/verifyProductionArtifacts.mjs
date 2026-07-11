import { access, readFile, readdir } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const distRoot = resolve(repositoryRoot, 'dist')
const requiredFiles = [
  'vendor/estertion-spine-3.6/spine-webgl.js',
  'vendor/estertion-spine-3.6/LICENSE',
  'vendor/estertion-spine-3.6/THIRD_PARTY_NOTICES.md',
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
const forbiddenModelFiles = outputFiles.filter((path) => {
  const lowerPath = path.toLowerCase()
  const basename = lowerPath.slice(lowerPath.lastIndexOf('/') + 1)

  return (
    lowerPath.startsWith('assets/prsk/') ||
    lowerPath.includes('/assets/prsk/') ||
    basename.endsWith('.skel') ||
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

const inspectableFiles = outputFiles.filter((path) =>
  /\.(?:css|html|js|json|txt)$/.test(path.toLowerCase()),
)
const bundledText = (
  await Promise.all(
    inspectableFiles.map((path) => readFile(resolve(distRoot, path), 'utf8')),
  )
).join('\n')

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
const productionSourceFiles = (await listFiles(sourceRoot, sourceRoot)).filter(
  (path) =>
    /\.[cm]?[jt]sx?$/.test(path) &&
    !path.includes('.test.') &&
    !path.startsWith('test/'),
)

for (const path of productionSourceFiles) {
  const source = await readFile(resolve(sourceRoot, path), 'utf8')
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
  'Verified production runtime notices, locale/Pet-preset-only storage, and exclusion of model assets, generated catalogs, fixed option lists, and persisted user URLs.',
)
