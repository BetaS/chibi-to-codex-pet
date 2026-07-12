import {
  GarupaSpine40PreviewFactory,
  officialGarupaSpine40RuntimeAdapter,
} from '../rendering'
import { GarupaSourceController } from './GarupaSourceController'

export function createDefaultGarupaSourceController(): GarupaSourceController {
  const previewFactory = new GarupaSpine40PreviewFactory({
    runtimeAdapter: officialGarupaSpine40RuntimeAdapter,
  })
  return new GarupaSourceController({
    createPreview: (source, canvas, signal) =>
      previewFactory.createPreview(
        {
          atlasBundle: source.atlasBundle,
          canvas,
          compatibility: source.metadata.compatibility,
          skeletonData: source.skeletonData,
          version: source.metadata.skeletonVersion,
        },
        { signal },
      ),
  })
}
