import {
  decodeCodexPetRecipe,
  parseCodexPetRecipe,
  type CodexPetRecipe,
} from './recipe'
import { serializeCodexPetManifest } from './manifest'
import { exportCodexPetPackage } from './packageExporter'
import { validateCodexPetPackage } from './packageValidator'
import { liveSD36FrameSampler } from '../livesd/export/LiveSD36FrameSampler'
import type { LiveSDFrameSamplerContract } from '../livesd/export/types'
import {
  GarupaSpine40FrameSampler,
  materializeGarupaPinnedSnapshot,
  officialGarupaSpine40RuntimeAdapter,
} from '../livesd/garupa'
import type { LiveSDAtlasBundle } from '../livesd/model'
import {
  prskRemoteCatalogSource,
  prskRemoteResourceSource,
  resolvePrskRemoteProvider,
} from '../livesd/prsk'
import {
  loadStrrCatalog,
  loadStrrModel,
} from '../livesd/strr/staticProvider'
import { LIVE_SD_FRAMING_SCALE_DEFAULT } from '../livesd/rendering/framingScale'
import { isDefaultLiveSDFramingOffset } from '../livesd/rendering/framingOffset'

export interface CodexPetRecipeRenderResult {
  readonly filename: string
  readonly manifestId: string
  readonly petJson: string
  readonly spritesheetBase64: string
}

interface CodexPetRecipeModel {
  readonly atlasBundle: LiveSDAtlasBundle
  readonly skeletonData: ArrayBuffer
}

export interface CodexPetRecipeSamplingServices {
  readonly garupaSpine40: Pick<GarupaSpine40FrameSampler, 'sample'>
  readonly liveSD36: Pick<LiveSDFrameSamplerContract, 'sample'>
}

const garupaSpine40FrameSampler = new GarupaSpine40FrameSampler({
  runtimeAdapter: officialGarupaSpine40RuntimeAdapter,
})

const DEFAULT_RECIPE_SAMPLING_SERVICES = Object.freeze({
  garupaSpine40: garupaSpine40FrameSampler,
  liveSD36: liveSD36FrameSampler,
}) satisfies CodexPetRecipeSamplingServices

declare global {
  interface Window {
    renderCodexPetRecipe?: (
      recipe: CodexPetRecipe | string,
    ) => Promise<CodexPetRecipeRenderResult>
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export function createCodexPetRecipeSamplingInput(
  recipe: CodexPetRecipe,
  model: CodexPetRecipeModel,
  signal: AbortSignal,
) {
  return {
    atlasBundle: model.atlasBundle,
    framingOffset: {
      x: recipe.pet.framingOffsetX,
      y: recipe.pet.framingOffsetY,
    },
    framingScale: recipe.pet.framingScale,
    globalMirrorX: recipe.globalMirrorX,
    lookMovementScale: recipe.pet.lookMovementScale,
    ...(recipe.source.provider === 'strr-res-pak'
      ? { lookRigFallback: 'static' as const }
      : {}),
    skeletonData: model.skeletonData,
    mappings: recipe.mappings,
    signal,
  }
}

export function sampleCodexPetRecipeFrames(
  recipe: CodexPetRecipe,
  model: CodexPetRecipeModel,
  signal: AbortSignal,
  services: CodexPetRecipeSamplingServices =
    DEFAULT_RECIPE_SAMPLING_SERVICES,
) {
  const samplingInput = createCodexPetRecipeSamplingInput(
    recipe,
    model,
    signal,
  )
  return recipe.source.provider === 'garupa-pinned'
    ? services.garupaSpine40.sample(samplingInput)
    : services.liveSD36.sample(samplingInput)
}

async function loadCodexPetRecipeModel(
  recipe: CodexPetRecipe,
  signal: AbortSignal,
): Promise<CodexPetRecipeModel> {
  const source = recipe.source
  if (source.provider === 'garupa-pinned') {
    return materializeGarupaPinnedSnapshot(source.sdAssetBundleName, { signal })
  }
  if (source.provider === 'strr-res-pak') {
    return loadStrrModel({
      catalog: await loadStrrCatalog({ signal }),
      characterId: source.characterId,
      editionId: source.editionId,
      signal,
    })
  }

  const provider = resolvePrskRemoteProvider(
    source.provider === 'prsk-chibi-viewer'
      ? { kind: 'prsk-chibi-viewer' }
      : {
          kind: 'custom',
          assetBaseUrl: source.assetBaseUrl,
        },
    { development: false },
  )
  const catalog = await prskRemoteCatalogSource.load({ provider, signal })
  return prskRemoteResourceSource.load({
    catalog,
    characterId: source.characterId,
    signal,
  })
}

export async function renderCodexPetRecipe(
  input: CodexPetRecipe | string,
): Promise<CodexPetRecipeRenderResult> {
  const recipe =
    typeof input === 'string'
      ? decodeCodexPetRecipe(input)
      : parseCodexPetRecipe(input)
  const controller = new AbortController()
  const model = await loadCodexPetRecipeModel(recipe, controller.signal)
  const sampled = await sampleCodexPetRecipeFrames(
    recipe,
    model,
    controller.signal,
  )
  const exported = await exportCodexPetPackage({
    metadata: {
      displayName: recipe.pet.displayName,
      description: recipe.pet.description,
    },
    spritesheet: sampled.atlasPng,
  })
  const validated = await validateCodexPetPackage(exported.blob, {
    allowEdgeClipping:
      recipe.pet.framingScale > LIVE_SD_FRAMING_SCALE_DEFAULT ||
      !isDefaultLiveSDFramingOffset({
        x: recipe.pet.framingOffsetX,
        y: recipe.pet.framingOffsetY,
      }),
  })
  const spritesheetBytes = new Uint8Array(
    await validated.spritesheet.arrayBuffer(),
  )

  return {
    filename: exported.filename,
    manifestId: validated.manifest.id,
    petJson: serializeCodexPetManifest(validated.manifest),
    spritesheetBase64: bytesToBase64(spritesheetBytes),
  }
}

window.renderCodexPetRecipe = renderCodexPetRecipe
