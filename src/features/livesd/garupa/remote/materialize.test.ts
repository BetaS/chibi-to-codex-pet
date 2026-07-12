import { describe, expect, it, vi } from 'vitest'

import { createSpine40SkeletonHeader } from '../../../../test/skeletonFixtures'
import { GarupaRemoteError } from './errors'
import {
  materializeGarupaPinnedSnapshot,
  type MaterializeGarupaPinnedOptions,
} from './materialize'
import { sha256Hex, type GarupaPinnedResponse } from './network'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const BUILD_DATA_FILE =
  'assets-star-forassetbundle-startapp-sdchara-builddata-00001-builddata.asset'
const BUILD_DATA_STEM = BUILD_DATA_FILE.replace(/-builddata\.asset$/u, '')

function fixtureResponses(atlasPage = 'u000_templete.png') {
  const index = {
    builddata: {
      assetPath: 'sdchara/builddata_rip',
      saveDir: 'sdchara/builddata_rip',
      fileCount: 3,
      files: [
        BUILD_DATA_FILE,
        `${BUILD_DATA_STEM}-u000_templete.atlas.txt`,
        `${BUILD_DATA_STEM}-u000_templete.png`,
      ],
    },
    'model/s000_templete': {
      assetPath: 'sdchara/model/s000_templete_rip',
      saveDir: 'sdchara/model/s000_templete_rip',
      fileCount: 1,
      files: ['s000_templete.skel'],
    },
  }
  const buildData = {
    Base: {
      model: {
        bundleName: 'sdchara/model/s000_templete',
        fileName: 's000_templete_SkeletonData.asset',
      },
      textures: [
        {
          bundleName: 'sdchara/00001',
          fileName: 'u000_templete_Atlas.asset',
        },
      ],
    },
  }
  const atlas = `${atlasPage}\nsize: 2,2\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\npma: false\n\nbody\n  rotate: false\n  xy: 0,0\n  size: 2,2\n`
  return new Map<string, Uint8Array>([
    ['sdchara/_info.json', encoder.encode(JSON.stringify(index))],
    [
      `sdchara/builddata_rip/${BUILD_DATA_FILE}`,
      encoder.encode(JSON.stringify(buildData)),
    ],
    [
      'sdchara/model/s000_templete_rip/s000_templete.skel',
      new Uint8Array(createSpine40SkeletonHeader('4.0.64')),
    ],
    [
      `sdchara/builddata_rip/${BUILD_DATA_STEM}-u000_templete.atlas.txt`,
      encoder.encode(atlas),
    ],
    [
      `sdchara/builddata_rip/${BUILD_DATA_STEM}-u000_templete.png`,
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]),
    ],
  ])
}

function mixedCaseModelResponses(options: { readonly collision?: boolean } = {}) {
  const responses = fixtureResponses()
  const indexBytes = responses.get('sdchara/_info.json')
  const buildDataPath = `sdchara/builddata_rip/${BUILD_DATA_FILE}`
  const buildDataBytes = responses.get(buildDataPath)
  const skeletonPath = 'sdchara/model/s000_templete_rip/s000_templete.skel'
  const skeletonBytes = responses.get(skeletonPath)
  if (!indexBytes || !buildDataBytes || !skeletonBytes) {
    throw new Error('Synthetic mixed-case fixture is incomplete.')
  }

  const index = JSON.parse(decoder.decode(indexBytes)) as Record<
    string,
    {
      assetPath: string
      fileCount: number
      files: string[]
      saveDir: string
    }
  >
  delete index['model/s000_templete']
  const modelEntry = {
    assetPath: 'sdchara/model/s000_templete_mygo_rip',
    fileCount: 1,
    files: ['s000_templete_MyGO.skel'],
    saveDir: 'sdchara/model/s000_templete_mygo_rip',
  }
  index['model/s000_templete_mygo'] = modelEntry
  if (options.collision) {
    index['model/s000_templete_MYGO'] = {
      ...modelEntry,
      assetPath: 'sdchara/model/s000_templete_mygo_duplicate_rip',
      saveDir: 'sdchara/model/s000_templete_mygo_duplicate_rip',
    }
  }
  responses.set('sdchara/_info.json', encoder.encode(JSON.stringify(index)))

  const buildData = JSON.parse(decoder.decode(buildDataBytes)) as {
    Base: {
      model: { bundleName: string; fileName: string }
    }
  }
  buildData.Base.model.bundleName = 'sdchara/model/s000_templete_MyGO'
  buildData.Base.model.fileName = 's000_templete_MyGO_SkeletonData.asset'
  responses.set(buildDataPath, encoder.encode(JSON.stringify(buildData)))
  responses.delete(skeletonPath)
  responses.set(
    'sdchara/model/s000_templete_mygo_rip/s000_templete_MyGO.skel',
    skeletonBytes,
  )
  return responses
}

async function responseFor(
  path: string,
  bytes: Uint8Array,
): Promise<GarupaPinnedResponse> {
  return {
    bytes,
    contentType: path.endsWith('.png')
      ? 'image/png'
      : path.endsWith('.json')
        ? 'application/json'
        : 'application/octet-stream',
    sha256: await sha256Hex(bytes),
    url: `https://cdn.jsdelivr.test/${path}`,
  }
}

function materializeOptions(
  responses: ReadonlyMap<string, Uint8Array>,
  requested: string[],
): MaterializeGarupaPinnedOptions {
  return {
    signal: new AbortController().signal,
    acquiredAt: '2026-07-11T00:00:00Z',
    decodePng: vi.fn(async () => ({ width: 2, height: 2 })),
    fetchBytes: async (path) => {
      requested.push(path)
      const bytes = responses.get(path)
      if (!bytes) {
        throw new GarupaRemoteError(
          'GARUPA_REMOTE_SNAPSHOT_INVALID',
          'Synthetic file is missing.',
        )
      }
      return responseFor(path, bytes)
    },
  }
}

describe('Garupa pinned snapshot materialization', () => {
  it('materializes one exact-commit graph into provider-independent canonical input', async () => {
    const requested: string[] = []
    const source = await materializeGarupaPinnedSnapshot(
      '00001',
      materializeOptions(fixtureResponses(), requested),
    )

    expect(requested).toEqual([
      'sdchara/_info.json',
      `sdchara/builddata_rip/${BUILD_DATA_FILE}`,
      'sdchara/model/s000_templete_rip/s000_templete.skel',
      `sdchara/builddata_rip/${BUILD_DATA_STEM}-u000_templete.atlas.txt`,
      `sdchara/builddata_rip/${BUILD_DATA_STEM}-u000_templete.png`,
    ])
    expect(source.metadata).toMatchObject({
      gameId: 'garupa',
      assetFamily: 'sdchara',
      runtimeKey: 'spine-4.0',
      skeletonVersion: '4.0.64',
      compatibility: 'verified',
      alphaMode: 'straight',
      lookRigProfile: 'garupa-dual-eye-v1',
      provenance: {
        sourceKind: 'github-mirror',
        sourceRevision: '15b3e023cfdc576212f8b3a6b001c9f26e755f23',
      },
    })
    expect([...source.atlasBundle.atlasPages.keys()]).toEqual([
      'costume/u000_templete.png',
    ])
    expect(JSON.stringify(source)).not.toContain('bestdori')
    expect(JSON.stringify(source)).not.toContain('buildData')
    expect(JSON.stringify(source)).not.toContain('jsdelivr')
  })

  it('resolves a unique mixed-case shared model key from the snapshot index', async () => {
    const requested: string[] = []
    const source = await materializeGarupaPinnedSnapshot(
      '00001',
      materializeOptions(mixedCaseModelResponses(), requested),
    )

    expect(requested).toContain(
      'sdchara/model/s000_templete_mygo_rip/s000_templete_MyGO.skel',
    )
    expect(source.metadata.modelName).toBe('s000_templete_MyGO')
  })

  it('rejects case-folded shared model key collisions before requesting a skeleton', async () => {
    const requested: string[] = []
    await expect(
      materializeGarupaPinnedSnapshot(
        '00001',
        materializeOptions(
          mixedCaseModelResponses({ collision: true }),
          requested,
        ),
      ),
    ).rejects.toMatchObject({ code: 'GARUPA_REMOTE_SNAPSHOT_INVALID' })
    expect(requested.some((path) => path.endsWith('.skel'))).toBe(false)
  })

  it('rejects unsafe atlas pages atomically before returning a partial source', async () => {
    const requested: string[] = []
    await expect(
      materializeGarupaPinnedSnapshot(
        '00001',
        materializeOptions(fixtureResponses('../escape.png'), requested),
      ),
    ).rejects.toMatchObject({ code: 'GARUPA_REMOTE_SNAPSHOT_INVALID' })
    expect(requested).not.toContain(
      `sdchara/builddata_rip/${BUILD_DATA_STEM}-u000_templete.png`,
    )
  })
})
