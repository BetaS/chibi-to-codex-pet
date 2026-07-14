import {
  decodeCodexPetRecipe,
  parseCodexPetRecipe,
  type CodexPetRecipe,
} from './recipe'
import { serializeCodexPetManifest } from './manifest'
import { exportCodexPetPackage } from './packageExporter'
import { validateCodexPetPackage } from './packageValidator'
import { liveSD36FrameSampler } from '../livesd/export/LiveSD36FrameSampler'
import {
  prskRemoteCatalogSource,
  prskRemoteResourceSource,
  resolvePrskRemoteProvider,
} from '../livesd/prsk'
import type { PrskRemoteModelInput } from '../livesd/prsk'
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
  model: Pick<PrskRemoteModelInput, 'atlasBundle' | 'skeletonData'>,
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

export async function renderCodexPetRecipe(
  input: CodexPetRecipe | string,
): Promise<CodexPetRecipeRenderResult> {
  const recipe =
    typeof input === 'string'
      ? decodeCodexPetRecipe(input)
      : parseCodexPetRecipe(input)
  const controller = new AbortController()
  const source = recipe.source
  const model = source.provider === 'strr-res-pak'
    ? await loadStrrModel({
        catalog: await loadStrrCatalog({ signal: controller.signal }),
        characterId: source.characterId,
        editionId: source.editionId,
        signal: controller.signal,
      })
    : await (async () => {
        const provider = resolvePrskRemoteProvider(
          source.provider === 'prsk-chibi-viewer'
            ? { kind: 'prsk-chibi-viewer' }
            : {
                kind: 'custom',
                assetBaseUrl: source.assetBaseUrl,
              },
          { development: false },
        )
        const catalog = await prskRemoteCatalogSource.load({
          provider,
          signal: controller.signal,
        })
        return prskRemoteResourceSource.load({
          catalog,
          characterId: source.characterId,
          signal: controller.signal,
        })
      })()
  const sampled = await liveSD36FrameSampler.sample(
    createCodexPetRecipeSamplingInput(recipe, model, controller.signal),
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
