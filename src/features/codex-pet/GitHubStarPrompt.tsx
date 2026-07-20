import {
  useEffect,
  useRef,
  type MouseEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import { trackButtonClick } from '../../analytics/ga4'
import { useI18n } from '../../i18n'
import { GITHUB_REPOSITORY_URL } from '../github'

export { GITHUB_REPOSITORY_URL } from '../github'

interface GitHubStarPromptProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly returnFocusRef: RefObject<HTMLAnchorElement | null>
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function GitHubStarPrompt({
  isOpen,
  onClose,
  returnFocusRef,
}: GitHubStarPromptProps) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement>(null)
  const repositoryLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const returnFocusElement = returnFocusRef.current
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    repositoryLinkRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR,
        ) ?? [],
      )
      const firstElement = focusableElements.at(0)
      const lastElement = focusableElements.at(-1)
      if (!firstElement || !lastElement) {
        event.preventDefault()
        return
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
      if (returnFocusElement?.isConnected) {
        returnFocusElement.focus()
      } else if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [isOpen, onClose, returnFocusRef])

  if (!isOpen) {
    return null
  }

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div
      className="github-star-prompt__backdrop"
      data-testid="github-star-prompt-backdrop"
      onMouseDown={closeFromBackdrop}
    >
      <div
        aria-describedby="github-star-prompt-description"
        aria-labelledby="github-star-prompt-title"
        aria-modal="true"
        className="github-star-prompt"
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label={t('starPrompt.closeLabel')}
          className="github-star-prompt__close"
          onClick={() => {
            trackButtonClick('star_prompt_close')
            onClose()
          }}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>

        <h2 id="github-star-prompt-title">{t('starPrompt.title')}</h2>
        <p id="github-star-prompt-description">{t('starPrompt.description')}</p>

        <div className="github-star-prompt__actions">
          <a
            className="github-star-prompt__repository-link"
            href={GITHUB_REPOSITORY_URL}
            onClick={() => {
              trackButtonClick('star_prompt_repository_open')
              onClose()
            }}
            ref={repositoryLinkRef}
            rel="noreferrer"
            target="_blank"
          >
            <span aria-hidden="true">★</span>
            {t('starPrompt.repositoryAction')}
          </a>
          <button
            className="github-star-prompt__dismiss"
            onClick={() => {
              trackButtonClick('star_prompt_dismiss')
              onClose()
            }}
            type="button"
          >
            {t('starPrompt.dismiss')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
