import {
  garupaSpinePackImporter,
  type GarupaCanonicalSource,
} from '../importer'
import {
  materializeGarupaPinnedSnapshot,
  type MaterializeGarupaPinnedOptions,
} from '../remote/materialize'
import type { GarupaSpine40PreviewSession } from '../rendering'
import { toGarupaDiagnostic, type GarupaDiagnostic } from '../errors'

export type GarupaSourceSelection =
  | {
      readonly kind: 'local'
      readonly file: File
    }
  | {
      readonly kind: 'pinned'
      readonly sdAssetBundleName: string
    }

export interface GarupaSourceSummary {
  readonly generation: number
  readonly kind: GarupaSourceSelection['kind']
  readonly modelName: string
  readonly runtimeKey: 'spine-4.0'
  readonly sdAssetBundleName: string
  readonly version: string
}

export interface GarupaSourceControllerState {
  readonly active: GarupaSourceSummary | null
  readonly diagnostic: GarupaDiagnostic | null
  readonly generation: number
  readonly phase: 'error' | 'idle' | 'loading' | 'ready'
  readonly selection:
    | { readonly kind: 'local'; readonly name: string }
    | { readonly kind: 'pinned'; readonly sdAssetBundleName: string }
    | null
}

export type GarupaLocalImporter = (
  file: File,
) => Promise<GarupaCanonicalSource>

export type GarupaPinnedMaterializer = (
  sdAssetBundleName: string,
  options: MaterializeGarupaPinnedOptions,
) => Promise<GarupaCanonicalSource>

export type GarupaPreviewCreator = (
  source: GarupaCanonicalSource,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
) => Promise<GarupaSpine40PreviewSession>

export interface GarupaSourceControllerOptions {
  readonly createPreview: GarupaPreviewCreator
  readonly importLocal?: GarupaLocalImporter
  readonly materializePinned?: GarupaPinnedMaterializer
}

type StateListener = () => void

const IDLE_STATE: GarupaSourceControllerState = Object.freeze({
  active: null,
  diagnostic: null,
  generation: 0,
  phase: 'idle',
  selection: null,
})

function sourceSummary(
  source: GarupaCanonicalSource,
  kind: GarupaSourceSelection['kind'],
  generation: number,
): GarupaSourceSummary {
  return Object.freeze({
    generation,
    kind,
    modelName: source.metadata.modelName,
    runtimeKey: source.metadata.runtimeKey,
    sdAssetBundleName: source.metadata.sdAssetBundleName,
    version: source.metadata.skeletonVersion,
  })
}

function safelyDispose(session: GarupaSpine40PreviewSession | null): void {
  try {
    session?.dispose()
  } catch {
    // A stale or replaced session must not break the active source handoff.
  }
}

export class GarupaSourceController {
  readonly #createPreview: GarupaPreviewCreator
  readonly #importLocal: GarupaLocalImporter
  readonly #listeners = new Set<StateListener>()
  readonly #materializePinned: GarupaPinnedMaterializer
  #activePreview: GarupaSpine40PreviewSession | null = null
  #activeSource: GarupaCanonicalSource | null = null
  #disposed = false
  #generation = 0
  #request: AbortController | null = null
  #selection: GarupaSourceSelection | null = null
  #state: GarupaSourceControllerState = IDLE_STATE

  constructor(options: GarupaSourceControllerOptions) {
    this.#createPreview = options.createPreview
    this.#importLocal =
      options.importLocal ?? ((file) => garupaSpinePackImporter.import(file))
    this.#materializePinned =
      options.materializePinned ?? materializeGarupaPinnedSnapshot
  }

  getState = (): GarupaSourceControllerState => this.#state

  getActiveSource(): GarupaCanonicalSource | null {
    return this.#activeSource
  }

  getActivePreview(): GarupaSpine40PreviewSession | null {
    return this.#activePreview
  }

  subscribe = (listener: StateListener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  clearSelection(): void {
    this.#assertUsable()
    this.#selection = null
    this.#publish({
      ...this.#state,
      diagnostic: null,
      phase: this.#activeSource ? 'ready' : 'idle',
      selection: null,
    })
  }

  selectLocal(file: File | null): void {
    this.#assertUsable()
    this.#selection = file ? { kind: 'local', file } : null
    this.#publish({
      ...this.#state,
      diagnostic: null,
      phase: this.#activeSource ? 'ready' : 'idle',
      selection: file ? { kind: 'local', name: file.name } : null,
    })
  }

  selectPinned(sdAssetBundleName: string): void {
    this.#assertUsable()
    this.#selection = { kind: 'pinned', sdAssetBundleName }
    this.#publish({
      ...this.#state,
      diagnostic: null,
      phase: this.#activeSource ? 'ready' : 'idle',
      selection: { kind: 'pinned', sdAssetBundleName },
    })
  }

  async load(canvas: HTMLCanvasElement): Promise<boolean> {
    this.#assertUsable()
    const selection = this.#selection
    if (!selection) return false

    this.#request?.abort()
    const request = new AbortController()
    this.#request = request
    const generation = ++this.#generation
    this.#publish({
      ...this.#state,
      diagnostic: null,
      generation,
      phase: 'loading',
    })

    let nextPreview: GarupaSpine40PreviewSession | null = null
    try {
      const nextSource =
        selection.kind === 'local'
          ? await this.#importLocal(selection.file)
          : await this.#materializePinned(selection.sdAssetBundleName, {
              signal: request.signal,
            })
      if (!this.#isCurrent(generation, request)) return false

      nextPreview = await this.#createPreview(
        nextSource,
        canvas,
        request.signal,
      )
      if (!this.#isCurrent(generation, request)) {
        safelyDispose(nextPreview)
        return false
      }

      const previousPreview = this.#activePreview
      this.#activeSource = nextSource
      this.#activePreview = nextPreview
      nextPreview = null
      this.#publish({
        ...this.#state,
        active: sourceSummary(nextSource, selection.kind, generation),
        diagnostic: null,
        generation,
        phase: 'ready',
      })
      safelyDispose(previousPreview)
      return true
    } catch (error) {
      safelyDispose(nextPreview)
      if (!this.#isCurrent(generation, request)) return false
      this.#publish({
        ...this.#state,
        diagnostic: toGarupaDiagnostic(error, generation),
        generation,
        phase: 'error',
      })
      return false
    } finally {
      if (this.#request === request) this.#request = null
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#generation += 1
    this.#request?.abort()
    this.#request = null
    safelyDispose(this.#activePreview)
    this.#activePreview = null
    this.#activeSource = null
    this.#selection = null
    this.#state = IDLE_STATE
    this.#listeners.clear()
  }

  #isCurrent(generation: number, request: AbortController): boolean {
    return (
      !this.#disposed &&
      !request.signal.aborted &&
      generation === this.#generation &&
      request === this.#request
    )
  }

  #publish(state: GarupaSourceControllerState): void {
    this.#state = Object.freeze(state)
    for (const listener of this.#listeners) listener()
  }

  #assertUsable(): void {
    if (this.#disposed) {
      throw new Error('GarupaSourceController has been disposed.')
    }
  }
}
