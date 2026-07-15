import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import {
  main,
  parseArgs,
  renderResultToPayload,
  resolveCodexHome,
} from './cli'

const PNG_SIGNATURE_BASE64 = Buffer.from([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
]).toString('base64')
const packageMetadata = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { readonly version: string }

function petJson(id: string): string {
  return JSON.stringify({
    id,
    displayName: 'Test Pet',
    description: '',
    spriteVersionNumber: 2,
    spritesheetPath: 'spritesheet.png',
  }) + '\n'
}

describe('CLI parser', () => {
  it('--version은 package metadata 버전을 출력한다', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      await expect(main(['--version'], {})).resolves.toBe(0)
      expect(log).toHaveBeenCalledWith(packageMetadata.version)
    } finally {
      log.mockRestore()
    }
  })

  it('install --recipe 옵션을 해석한다', () => {
    expect(
      parseArgs([
        'install',
        '--recipe',
        'abc',
        '--codex-home',
        '/tmp/codex-home',
        '--dry-run',
        '--force',
      ]),
    ).toEqual({
      recipe: 'abc',
      codexHome: '/tmp/codex-home',
      dryRun: true,
      force: true,
    })
  })

  it('recipe 없는 install을 exit 2로 반환한다', async () => {
    await expect(main(['install'], {})).resolves.toBe(2)
  })
})

describe('Codex home resolution', () => {
  it('명시적 --codex-home이 CODEX_HOME보다 우선한다', () => {
    expect(
      resolveCodexHome('/tmp/explicit-home', {
        CODEX_HOME: '/tmp/env-home',
      }),
    ).toBe('/tmp/explicit-home')
  })

  it('상대 CODEX_HOME을 거부한다', () => {
    expect(() => resolveCodexHome(undefined, { CODEX_HOME: 'relative' }))
      .toThrow(/absolute path/)
  })
})

describe('renderer payload validation', () => {
  it('manifest와 PNG signature가 유효한 renderer payload를 수용한다', () => {
    expect(
      renderResultToPayload({
        filename: 'test-pet.codex-pet.zip',
        manifestId: 'test-pet',
        petJson: petJson('test-pet'),
        spritesheetBase64: PNG_SIGNATURE_BASE64,
      }),
    ).toMatchObject({
      id: 'test-pet',
    })
  })

  it('manifest ID 불일치를 거부한다', () => {
    expect(() =>
      renderResultToPayload({
        filename: 'test-pet.codex-pet.zip',
        manifestId: 'test-pet',
        petJson: petJson('other-pet'),
        spritesheetBase64: PNG_SIGNATURE_BASE64,
      }),
    ).toThrow(/manifest/)
  })
})
