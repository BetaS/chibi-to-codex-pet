import { describe, expect, it } from 'vitest'

import { toGarupaDiagnostic } from './errors'

describe('Garupa public error adapter', () => {
  it('keeps stable code and generation while exposing only safe context', () => {
    expect(
      toGarupaDiagnostic(
        {
          code: 'GARUPA_SKELETON_UNSUPPORTED_VERSION',
          message: '/Users/example/private/model.skel failed',
          stack: 'secret stack',
          details: {
            actualVersion: '4.1.0',
            path: '/Users/example/private/model.skel',
            bytes: 123,
          },
        },
        7,
      ),
    ).toEqual({
      code: 'GARUPA_SKELETON_UNSUPPORTED_VERSION',
      generation: 7,
      messageKey: 'garupa.error.pack',
      values: { actualVersion: '4.1.0', bytes: 123 },
    })
  })

  it('distinguishes the LIVE sprite and Cubism asset families', () => {
    expect(
      toGarupaDiagnostic({ code: 'GARUPA_LIVE_SPRITE_UNSUPPORTED' }, 1)
        .messageKey,
    ).toBe('garupa.error.liveSpriteUnsupported')
    expect(
      toGarupaDiagnostic({ code: 'GARUPA_ASSET_FAMILY_UNSUPPORTED' }, 1)
        .messageKey,
    ).toBe('garupa.error.assetFamilyUnsupported')
  })

  it('normalizes unknown exceptions without raw exception text', () => {
    expect(toGarupaDiagnostic(new Error('private byte dump'), 2)).toEqual({
      code: 'GARUPA_FAILED',
      generation: 2,
      messageKey: 'garupa.error.generic',
      values: {},
    })
  })
})
