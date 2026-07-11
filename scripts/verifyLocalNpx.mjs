import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localNpmCache = join(repositoryRoot, '.npm-cache')
const localPackageSpec = './packages/cli'

const airiSmokeRecipe = {
  schemaVersion: 1,
  kind: 'livesd-recipe',
  renderer: 'livesd36-codex-pet@1',
  globalMirrorX: false,
  source: {
    provider: 'prsk-chibi-viewer',
    characterId: 'sd_07airi_normal',
  },
  pet: {
    displayName: 'Airi Normal',
    description: '',
    framingScale: 1,
    lookMovementScale: 1,
  },
  mappings: {
    idle: { animationName: 'w_happy_idle01_f', mirrorX: false },
    'running-right': { animationName: 'w_normal_walk01_f', mirrorX: true },
    'running-left': { animationName: 'w_normal_walk01_f', mirrorX: false },
    waving: { animationName: 'w_cute_joy01_f', mirrorX: false },
    jumping: { animationName: 'z_test_F_negi01', mirrorX: false },
    failed: { animationName: 'w_happy_sad01_f', mirrorX: false },
    waiting: { animationName: 'w_happy_listen01_f', mirrorX: false },
    running: { animationName: 'w_happy_doubt01_f', mirrorX: false },
    review: { animationName: 'w_happy_doubt02_f', mirrorX: false },
  },
}

function encodeRecipe(recipe) {
  return Buffer.from(JSON.stringify(recipe), 'utf8').toString('base64url')
}

function parseArgs(argv) {
  const options = {
    codexHome: mkdtempSync(join(tmpdir(), 'chibi-to-codex-pet-codex-home-')),
    recipe: encodeRecipe(airiSmokeRecipe),
    render: true,
    install: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--') {
      continue
    }
    if (arg === '--no-render') {
      options.render = false
      options.install = false
      continue
    }
    if (arg === '--dry-run-only') {
      options.render = true
      options.install = false
      continue
    }
    if (arg === '--codex-home') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--codex-home requires a path')
      }
      options.codexHome = resolve(value)
      index += 1
      continue
    }
    if (arg === '--recipe') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--recipe requires a value')
      }
      options.recipe = value
      index += 1
      continue
    }
    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function run(label, command, args, extraEnv = {}) {
  console.log(`\n==> ${label}`)
  console.log([command, ...args].join(' '))
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      CI: 'true',
      npm_config_cache: localNpmCache,
      ...extraEnv,
    },
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status ?? 'unknown'}`)
  }
}

function npxArgs(...args) {
  return [
    '-y',
    '--package',
    localPackageSpec,
    '--',
    'chibi-to-codex-pet',
    ...args,
  ]
}

const options = parseArgs(process.argv.slice(2))

run('install workspace dependencies', 'pnpm', ['install', '--frozen-lockfile'])
run('build local CLI and renderer', 'pnpm', [
  '--filter',
  'chibi-to-codex-pet',
  'build',
])
run('verify local CLI package contents', 'pnpm', [
  '--filter',
  'chibi-to-codex-pet',
  'verify:pack',
])
run('verify local npx bin', 'npx', npxArgs('--version'))

if (options.render) {
  run('dry-run recipe install through local npx', 'npx', npxArgs(
    'install',
    '--recipe',
    options.recipe,
    '--codex-home',
    options.codexHome,
    '--dry-run',
  ))
}

if (options.install) {
  run('install recipe into temporary Codex home through local npx', 'npx', npxArgs(
    'install',
    '--recipe',
    options.recipe,
    '--codex-home',
    options.codexHome,
  ))
  run('verify idempotent reinstall through local npx', 'npx', npxArgs(
    'install',
    '--recipe',
    options.recipe,
    '--codex-home',
    options.codexHome,
  ))
}

console.log('\nLocal npx verification complete.')
console.log(`Codex home used: ${options.codexHome}`)
console.log(`Generated local npx shape: npm_config_cache=.npm-cache npx -y --package ${localPackageSpec} -- chibi-to-codex-pet install --recipe <recipe>`)
