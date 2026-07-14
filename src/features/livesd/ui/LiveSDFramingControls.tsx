import { useI18n } from '../../../i18n'
import {
  LIVE_SD_FRAMING_OFFSET_DEFAULT,
  LIVE_SD_FRAMING_OFFSET_STEP,
  LIVE_SD_FRAMING_OFFSET_X_MAX,
  LIVE_SD_FRAMING_OFFSET_X_MIN,
  LIVE_SD_FRAMING_OFFSET_Y_MAX,
  LIVE_SD_FRAMING_OFFSET_Y_MIN,
  type LiveSDFramingOffset,
} from '../rendering/framingOffset'
import {
  LIVE_SD_FRAMING_SCALE_DEFAULT,
  LIVE_SD_FRAMING_SCALE_MAX,
  LIVE_SD_FRAMING_SCALE_MIN,
  LIVE_SD_FRAMING_SCALE_STEP,
} from '../rendering/framingScale'

export interface LiveSDFramingControlsProps {
  readonly disabled: boolean
  readonly framingOffset: LiveSDFramingOffset
  readonly framingScale: number
  readonly idPrefix?: string
  readonly onOffsetChange: (offset: LiveSDFramingOffset) => void
  readonly onReset: () => void
  readonly onScaleChange: (scale: number) => void
}

export function LiveSDFramingControls({
  disabled,
  framingOffset,
  framingScale,
  idPrefix,
  onOffsetChange,
  onReset,
  onScaleChange,
}: LiveSDFramingControlsProps) {
  const { t } = useI18n()
  const controlPrefix = idPrefix ? `${idPrefix}-` : ''
  const scaleId = `${controlPrefix}pet-framing-scale`
  const offsetXId = `${controlPrefix}pet-framing-offset-x`
  const offsetYId = `${controlPrefix}pet-framing-offset-y`
  const framingScalePercent = Math.round(framingScale * 100)
  const unchanged =
    framingScale === LIVE_SD_FRAMING_SCALE_DEFAULT &&
    framingOffset.x === LIVE_SD_FRAMING_OFFSET_DEFAULT.x &&
    framingOffset.y === LIVE_SD_FRAMING_OFFSET_DEFAULT.y

  return (
    <fieldset
      className="framing-scale-control"
      data-provider-capability="framing"
      disabled={disabled}
    >
      <legend>{t('common.framing')}</legend>
      <div className="framing-scale-control__input-row">
        <label htmlFor={scaleId}>{t('common.petSize')}</label>
        <input
          aria-label={t('common.petSizeSlider')}
          aria-valuetext={t('common.percentValue', {
            value: framingScalePercent,
          })}
          id={scaleId}
          max={LIVE_SD_FRAMING_SCALE_MAX * 100}
          min={LIVE_SD_FRAMING_SCALE_MIN * 100}
          onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
          step={LIVE_SD_FRAMING_SCALE_STEP * 100}
          type="range"
          value={framingScalePercent}
        />
        <output htmlFor={scaleId}>{framingScalePercent}%</output>
      </div>
      <div className="framing-scale-control__input-row">
        <label htmlFor={offsetXId}>{t('common.offsetX')}</label>
        <input
          aria-label={t('common.offsetXSlider')}
          aria-valuetext={t('common.pixelValue', {
            value: framingOffset.x,
          })}
          id={offsetXId}
          max={LIVE_SD_FRAMING_OFFSET_X_MAX}
          min={LIVE_SD_FRAMING_OFFSET_X_MIN}
          onChange={(event) =>
            onOffsetChange({
              ...framingOffset,
              x: Number(event.target.value),
            })
          }
          step={LIVE_SD_FRAMING_OFFSET_STEP}
          type="range"
          value={framingOffset.x}
        />
        <output htmlFor={offsetXId}>
          {t('common.pixelValue', { value: framingOffset.x })}
        </output>
      </div>
      <div className="framing-scale-control__input-row">
        <label htmlFor={offsetYId}>{t('common.offsetY')}</label>
        <input
          aria-label={t('common.offsetYSlider')}
          aria-valuetext={t('common.pixelValue', {
            value: framingOffset.y,
          })}
          id={offsetYId}
          max={LIVE_SD_FRAMING_OFFSET_Y_MAX}
          min={LIVE_SD_FRAMING_OFFSET_Y_MIN}
          onChange={(event) =>
            onOffsetChange({
              ...framingOffset,
              y: Number(event.target.value),
            })
          }
          step={LIVE_SD_FRAMING_OFFSET_STEP}
          type="range"
          value={framingOffset.y}
        />
        <output htmlFor={offsetYId}>
          {t('common.pixelValue', { value: framingOffset.y })}
        </output>
      </div>
      <button disabled={disabled || unchanged} onClick={onReset} type="button">
        {t('common.resetFraming')}
      </button>
    </fieldset>
  )
}
