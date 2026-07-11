import { useEffect, useMemo, useRef, useState } from 'react'

import { useI18n } from '../../i18n'
import {
  CODEX_PET_ATLAS_COLUMNS,
  CODEX_PET_ATLAS_ROWS,
  CODEX_PET_LOOK_DIRECTIONS,
  CODEX_PET_LOOK_FRAME_COUNT,
  CODEX_PET_STATES,
  type CodexPetStateId,
} from './contract'
import { calculateCodexPetLookDirectionIndex } from './lookDirection'
import type { CodexPetManifest } from './manifest'
import { getCodexPetStateCopy } from './stateCopy'

export interface CodexPetInstalledPreviewProps {
  readonly manifest: CodexPetManifest
  readonly spritesheetUrl: string
}

export function CodexPetInstalledPreview({
  manifest,
  spritesheetUrl,
}: CodexPetInstalledPreviewProps) {
  const { t } = useI18n()
  const spriteRef = useRef<HTMLDivElement>(null)
  const [selectedStateId, setSelectedStateId] =
    useState<CodexPetStateId>('idle')
  const [isHovered, setIsHovered] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const [lookDirectionIndex, setLookDirectionIndex] = useState<number | null>(
    null,
  )
  const stateId: CodexPetStateId = isHovered
    ? 'jumping'
    : selectedStateId
  const state = useMemo(
    () => CODEX_PET_STATES.find((candidate) => candidate.id === stateId),
    [stateId],
  )

  useEffect(() => {
    if (!state || state.frameCount <= 1) {
      return
    }

    const baseDuration = state.frameDurationsMs[frameIndex] ?? 140
    const duration = state.id === 'idle' ? baseDuration * 6 : baseDuration
    const handle = window.setTimeout(() => {
      setFrameIndex((current) => (current + 1) % state.frameCount)
    }, duration)
    return () => window.clearTimeout(handle)
  }, [frameIndex, state])

  if (!state) {
    return null
  }
  const stateCopy = getCodexPetStateCopy(state.id, t)

  const lookDirection =
    lookDirectionIndex === null
      ? null
      : CODEX_PET_LOOK_DIRECTIONS[lookDirectionIndex]
  const renderedColumn = lookDirection?.column ?? frameIndex
  const renderedRow = lookDirection?.row ?? state.row
  const columnPercent =
    CODEX_PET_ATLAS_COLUMNS <= 1
      ? 0
      : (renderedColumn / (CODEX_PET_ATLAS_COLUMNS - 1)) * 100
  const rowPercent =
    CODEX_PET_ATLAS_ROWS <= 1
      ? 0
      : (renderedRow / (CODEX_PET_ATLAS_ROWS - 1)) * 100

  const clearPointerLook = () => {
    setFrameIndex(0)
    setIsHovered(false)
    setLookDirectionIndex(null)
  }

  return (
    <section className="codex-pet-installed-preview" aria-labelledby="installed-preview-title">
      <div className="codex-pet-installed-preview__heading">
        <div>
          <p className="toolbar-label">{t('installed.eyebrow')}</p>
          <h3 id="installed-preview-title">{t('installed.title')}</h3>
        </div>
        <label>
          <span>{t('installed.state')}</span>
          <select
            aria-label={t('installed.stateSelector')}
            onChange={(event) => {
              setFrameIndex(0)
              setSelectedStateId(event.target.value as CodexPetStateId)
            }}
            value={selectedStateId}
          >
            {CODEX_PET_STATES.map((candidate) => {
              const copy = getCodexPetStateCopy(candidate.id, t)
              return (
                <option key={candidate.id} value={candidate.id}>
                  {copy.label}
                </option>
              )
            })}
          </select>
        </label>
      </div>

      <div
        aria-label={t('installed.trackingArea', {
          name: manifest.displayName,
        })}
        className="codex-pet-installed-preview__stage"
        data-testid="codex-pet-preview-stage"
        onPointerCancel={clearPointerLook}
        onPointerLeave={clearPointerLook}
        onPointerMove={(event) => {
          const spriteBounds = spriteRef.current?.getBoundingClientRect()
          if (!spriteBounds) {
            setLookDirectionIndex(null)
            return
          }

          const dx = event.clientX - (spriteBounds.left + spriteBounds.width / 2)
          const dy = event.clientY - (spriteBounds.top + spriteBounds.height / 2)
          setLookDirectionIndex(calculateCodexPetLookDirectionIndex(dx, dy))
        }}
      >
        <div
          className="codex-pet-border-box"
          data-testid="codex-pet-border-box"
        >
          <span className="preview-border-label">{t('installed.outputFrame')}</span>
          <div
            aria-label={t('installed.spriteLabel', {
              name: manifest.displayName,
              state: stateCopy.label,
            })}
            className="codex-pet-sprite"
            data-atlas-column={renderedColumn}
            data-atlas-row={renderedRow}
            data-frame-index={frameIndex}
            data-look-direction-index={lookDirection?.index}
            data-pet-state={state.id}
            data-sprite-version={manifest.spriteVersionNumber}
            onPointerEnter={() => {
              setFrameIndex(0)
              setIsHovered(true)
            }}
            onPointerLeave={() => {
              setFrameIndex(0)
              setIsHovered(false)
            }}
            ref={spriteRef}
            role="img"
            style={{
              backgroundImage: `url(${spritesheetUrl})`,
              backgroundPosition: `${columnPercent}% ${rowPercent}%`,
              backgroundSize: `${CODEX_PET_ATLAS_COLUMNS * 100}% ${CODEX_PET_ATLAS_ROWS * 100}%`,
            }}
          />
        </div>
      </div>
      <p className="codex-pet-installed-preview__caption" aria-live="polite">
        <strong>
          {lookDirection
            ? t('installed.gazeCounter', {
                current: lookDirection.index + 1,
                total: CODEX_PET_LOOK_FRAME_COUNT,
              })
            : stateCopy.label}
        </strong>
        <span>
          {lookDirection
            ? t('installed.gazeDescription', {
                state: stateCopy.label,
                degrees: lookDirection.angleDegrees,
              })
            : stateCopy.description}
        </span>
        <code>
          row {renderedRow} · column {renderedColumn}
          {lookDirection
            ? ` · look ${lookDirection.index}`
            : ` · frame ${frameIndex + 1}/${state.frameCount}`}
        </code>
      </p>
    </section>
  )
}
