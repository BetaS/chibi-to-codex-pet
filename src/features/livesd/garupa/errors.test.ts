import { describe, expect, it } from 'vitest'

import { SpineRuntimeProfileError } from '../runtime/versionedRuntimeError'
import { toGarupaDiagnostic } from './errors'
import { GarupaPackImportError } from './importer/errors'
import { GarupaRenderingError } from './rendering/errors'

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

  it('keeps allowlisted context from the real Garupa and runtime error shapes', () => {
    const importerDiagnostic = toGarupaDiagnostic(
      new GarupaPackImportError(
        'GARUPA_SKELETON_UNSUPPORTED_VERSION',
        '/Users/example/private/model.skel failed',
        {
          actualVersion: '4.1.0',
          path: '/Users/example/private/model.skel',
        },
      ),
      3,
    )
    expect(importerDiagnostic.values).toEqual({ actualVersion: '4.1.0' })

    const renderingDiagnostic = toGarupaDiagnostic(
      new GarupaRenderingError(
        'GARUPA_PREVIEW_RENDER_FAILED',
        'private rendering failure',
        {
          actualVersion: '4.0.64',
          runtimeKey: 'spine-4.0',
          stage: 'internal-stage',
        },
      ),
      4,
    )
    expect(renderingDiagnostic.values).toEqual({
      actualVersion: '4.0.64',
      runtimeKey: 'spine-4.0',
    })

    const runtimeDiagnostic = toGarupaDiagnostic(
      new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_MISMATCH',
        'private runtime mismatch',
        {
          actualVersion: '3.6.53',
          requestedRuntimeKey: 'spine-4.0',
          runtimeKey: 'spine-3.6',
        },
      ),
      5,
    )
    expect(runtimeDiagnostic).toMatchObject({
      code: 'RUNTIME_PROFILE_MISMATCH',
      generation: 5,
      values: {
        actualVersion: '3.6.53',
        requestedRuntimeKey: 'spine-4.0',
        runtimeKey: 'spine-3.6',
      },
    })
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
