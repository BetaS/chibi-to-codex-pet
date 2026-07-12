import {
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react'

import { useI18n } from '../../../../i18n'
import { GARUPA_PINNED_PROVIDER_MANIFEST } from '../remote'
import { GarupaSourceController } from './GarupaSourceController'

export interface GarupaSourcePanelProps {
  readonly controller: GarupaSourceController
}

export function GarupaSourcePanel({ controller }: GarupaSourcePanelProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  )
  const [sourceKind, setSourceKind] = useState<'local' | 'pinned'>('local')
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [sdAssetBundleName, setSdAssetBundleName] = useState(
    GARUPA_PINNED_PROVIDER_MANIFEST.debugFixture.sdAssetBundleName,
  )

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null
    setLocalFile(file)
    setSourceKind('local')
    controller.selectLocal(file)
  }
  const selectLocal = () => {
    setSourceKind('local')
    controller.selectLocal(localFile)
  }
  const selectPinned = () => {
    setSourceKind('pinned')
    controller.selectPinned(sdAssetBundleName)
  }
  const changeBundle = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.value
    setSdAssetBundleName(next)
    if (sourceKind === 'pinned') controller.selectPinned(next)
  }
  const load = () => {
    const canvas = canvasRef.current
    if (canvas) void controller.load(canvas)
  }

  const statusKey =
    state.phase === 'loading'
      ? 'garupa.status.loading'
      : state.phase === 'ready'
        ? 'garupa.status.ready'
        : state.phase === 'error'
          ? 'garupa.status.error'
          : 'garupa.status.idle'

  return (
    <aside
      aria-labelledby="garupa-source-title"
      className="controls-panel"
    >
      <h2 id="garupa-source-title">{t('garupa.label')}</h2>
      <fieldset>
        <legend>{t('garupa.source')}</legend>
        <label>
          <input
            checked={sourceKind === 'local'}
            name="garupa-source-kind"
            onChange={selectLocal}
            type="radio"
          />
          {t('garupa.localPack')}
        </label>
        <p>{t('garupa.localPackDescription')}</p>
        <input
          accept=".zip,application/zip"
          aria-label={t('garupa.selectZip')}
          onChange={selectFile}
          type="file"
        />

        <label>
          <input
            checked={sourceKind === 'pinned'}
            name="garupa-source-kind"
            onChange={selectPinned}
            type="radio"
          />
          {t('garupa.pinnedSnapshot')}
        </label>
        <p>{t('garupa.pinnedDescription')}</p>
        <label>
          {t('garupa.bundleName')}
          <input
            onChange={changeBundle}
            type="text"
            value={sdAssetBundleName}
          />
        </label>
      </fieldset>

      <dl aria-label={t('garupa.manifestDisclosure')}>
        <dt>Repository</dt>
        <dd>{GARUPA_PINNED_PROVIDER_MANIFEST.repository.url}</dd>
        <dt>Commit</dt>
        <dd>{GARUPA_PINNED_PROVIDER_MANIFEST.repository.sourceRevision}</dd>
        <dt>Region</dt>
        <dd>{GARUPA_PINNED_PROVIDER_MANIFEST.regionSemantics}</dd>
        <dt>License status</dt>
        <dd>{GARUPA_PINNED_PROVIDER_MANIFEST.licenseStatus}</dd>
        <dt>Request origin</dt>
        <dd>{GARUPA_PINNED_PROVIDER_MANIFEST.delivery.requestOrigin}</dd>
      </dl>

      <button
        disabled={!state.selection || state.phase === 'loading'}
        onClick={load}
        type="button"
      >
        {t('garupa.load')}
      </button>
      <p role="status">{t(statusKey)}</p>
      {state.diagnostic ? (
        <p
          data-code={state.diagnostic.code}
          data-generation={state.diagnostic.generation}
          role="alert"
        >
          {t(state.diagnostic.messageKey, state.diagnostic.values)}
        </p>
      ) : null}
      <canvas
        aria-label={t('garupa.canvasLabel')}
        height={208}
        ref={canvasRef}
        width={192}
      />
    </aside>
  )
}
