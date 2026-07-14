import { Spine36RuntimeProfileAdapter } from './Spine36RuntimeProfileAdapter'
import { Spine40RuntimeProfileAdapter } from './Spine40RuntimeProfileAdapter'
import { readSpineRuntimeSkeletonHeader } from './skeletonRuntimeHeader'
import { SpineRuntimeProfileError } from './versionedRuntimeError'
import type {
  SpineRuntimeBoundHandoff,
  SpineRuntimeBounds,
  SpineRuntimeKey,
  SpineRuntimeProfileAdapter,
  SpineRuntimeSelection,
} from './versionedRuntimeTypes'

export class SpineVersionedRuntimeRegistry {
  readonly #adapterByKey: ReadonlyMap<SpineRuntimeKey, SpineRuntimeProfileAdapter>

  constructor(
    adapters: readonly SpineRuntimeProfileAdapter[] = [
      new Spine36RuntimeProfileAdapter(),
      new Spine40RuntimeProfileAdapter(),
    ],
  ) {
    const adapterByKey = new Map<SpineRuntimeKey, SpineRuntimeProfileAdapter>()
    for (const adapter of adapters) {
      if (adapterByKey.has(adapter.runtimeKey)) {
        throw new TypeError(`Duplicate Spine runtime profile: ${adapter.runtimeKey}`)
      }
      adapterByKey.set(adapter.runtimeKey, adapter)
    }
    this.#adapterByKey = adapterByKey
  }

  select(
    skeletonData: ArrayBuffer,
    requestedRuntimeKey?: SpineRuntimeKey,
  ): SpineRuntimeSelection {
    const header = readSpineRuntimeSkeletonHeader(skeletonData)
    if (
      requestedRuntimeKey !== undefined &&
      requestedRuntimeKey !== header.runtimeKey
    ) {
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_MISMATCH',
        `요청한 ${requestedRuntimeKey} profile과 skeleton ${header.version}이 일치하지 않습니다.`,
        {
          actualVersion: header.version,
          requestedRuntimeKey,
          runtimeKey: header.runtimeKey,
        },
      )
    }

    const adapter = this.#adapterByKey.get(header.runtimeKey)
    if (!adapter) {
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_UNSUPPORTED',
        `등록되지 않은 Spine runtime profile입니다: ${header.runtimeKey}`,
        {
          actualVersion: header.version,
          requestedRuntimeKey: requestedRuntimeKey ?? null,
          runtimeKey: header.runtimeKey,
        },
      )
    }

    return Object.freeze({ adapter, header })
  }

  createHandoff<T>(
    selection: SpineRuntimeSelection,
    source: T,
    canonicalBounds: SpineRuntimeBounds | null = null,
  ): SpineRuntimeBoundHandoff<T> {
    return Object.freeze({
      adapterIdentity: selection.adapter.adapterIdentity,
      canonicalBounds: canonicalBounds
        ? Object.freeze({ ...canonicalBounds })
        : null,
      runtimeKey: selection.adapter.runtimeKey,
      source,
    })
  }

  resolveHandoff<T>(
    handoff: SpineRuntimeBoundHandoff<T>,
    requestedRuntimeKey: SpineRuntimeKey = handoff.runtimeKey,
  ): SpineRuntimeProfileAdapter {
    const adapter = this.#adapterByKey.get(handoff.runtimeKey)
    if (
      requestedRuntimeKey !== handoff.runtimeKey ||
      !adapter ||
      adapter.adapterIdentity !== handoff.adapterIdentity
    ) {
      throw new SpineRuntimeProfileError(
        'RUNTIME_PROFILE_MISMATCH',
        'Ready source의 Spine runtime profile 또는 adapter identity가 변경되었습니다.',
        {
          requestedRuntimeKey,
          runtimeKey: handoff.runtimeKey,
        },
      )
    }
    return adapter
  }
}

export const spineVersionedRuntimeRegistry =
  new SpineVersionedRuntimeRegistry()
