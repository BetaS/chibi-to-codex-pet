/**
 * Source-independent LiveSD atlas data.
 *
 * `atlasPages` keys are normalized paths relative to the source root. This
 * object owns no object URLs, WebGL resources, or runtime instances.
 */
export interface LiveSDAtlasBundle {
  readonly sourceName: string
  readonly atlasPath: string
  readonly atlasText: string
  readonly atlasPages: ReadonlyMap<string, Blob>
}
