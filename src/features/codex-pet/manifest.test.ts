import { describe, expect, it } from 'vitest'

import {
  createCodexPetManifest,
  isSafeCodexPetId,
  normalizeCodexPetMetadata,
  slugifyCodexPetId,
} from './manifest'

describe('Codex Pet manifest metadata', () => {
  it('trims metadata and creates a safe, collapsed ASCII slug', () => {
    expect(
      normalizeCodexPetMetadata({
        description: '  A cheerful character.  ',
        displayName: '  Crème__AIRI / 01  ',
      }),
    ).toEqual({
      description: 'A cheerful character.',
      displayName: 'Crème__AIRI / 01',
      id: 'creme-airi-01',
    })
  })

  it('encodes non-ASCII letters deterministically into a safe id', () => {
    const id = slugifyCodexPetId('아이리')

    expect(id).not.toBe('')
    expect(isSafeCodexPetId(id)).toBe(true)
    expect(slugifyCodexPetId('아이리')).toBe(id)
  })

  it('creates the fixed v2 spritesheet manifest', () => {
    expect(
      createCodexPetManifest({
        description: '  Airi normal  ',
        displayName: ' Airi Normal ',
      }),
    ).toEqual({
      description: 'Airi normal',
      displayName: 'Airi Normal',
      id: 'airi-normal',
      spriteVersionNumber: 2,
      spritesheetPath: 'spritesheet.png',
    })
  })

  it.each([
    ['   ', 'DISPLAY_NAME_REQUIRED'],
    ['... / \\\\', 'PET_ID_INVALID'],
  ] as const)('rejects an unusable display name %#', (displayName, code) => {
    expect(() => createCodexPetManifest({ displayName })).toThrow(
      expect.objectContaining({ code }),
    )
  })
})
