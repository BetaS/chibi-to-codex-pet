import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
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

console.log('Verified vendored LiveSD runtime provenance.')
