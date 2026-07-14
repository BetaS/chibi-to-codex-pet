import {
  Fragment,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'

import type { ProviderComboboxCapability } from '../../providerIntegrationContract'

import { useI18n } from '../../../i18n'
import {
  filterComboboxOptions,
  type SearchableComboboxOption,
  type SearchableComboboxOptionGroup,
} from './searchableComboboxOptions'

export type {
  SearchableComboboxOption,
  SearchableComboboxOptionGroup,
} from './searchableComboboxOptions'

export interface SearchableComboboxProps {
  readonly className?: string
  readonly defaultQuery?: string
  readonly disabled?: boolean
  readonly disabledMessage?: string
  readonly emptyMessage?: string
  readonly error?: string | null
  readonly id?: string
  readonly label: string
  readonly loading?: boolean
  readonly loadingMessage?: string
  readonly noResultsMessage?: string
  readonly onChange: (
    value: string,
    option: SearchableComboboxOption,
  ) => void
  readonly onFocus?: () => void
  readonly onQueryChange?: (query: string) => void
  readonly options: readonly SearchableComboboxOption[]
  readonly placeholder?: string
  readonly providerCapability?: ProviderComboboxCapability
  readonly query?: string
  readonly queryResetKey?: number | string
  readonly value: string | null
}

interface QueryState {
  readonly resetKey: SearchableComboboxProps['queryResetKey']
  readonly value: string
}

interface InteractionState {
  readonly activeIndex: number
  readonly open: boolean
  readonly resetKey: SearchableComboboxProps['queryResetKey']
}

interface IndexedComboboxOption {
  readonly index: number
  readonly option: SearchableComboboxOption
}

interface ComboboxOptionSection {
  readonly group: SearchableComboboxOptionGroup | null
  readonly options: readonly IndexedComboboxOption[]
}

type ListboxPlacement = 'above' | 'below'

interface ListboxLayout {
  readonly anchorBottom: number
  readonly anchorTop: number
  readonly left: number
  readonly maxHeight: number
  readonly placement: ListboxPlacement
  readonly viewportHeight: number
  readonly width: number
}

const LISTBOX_MAX_HEIGHT_PX = 18 * 16
const LISTBOX_MAX_VIEWPORT_RATIO = 0.45
const LISTBOX_VIEWPORT_GAP_PX = 8
const LISTBOX_ANCHOR_GAP_PX = 2

function resolveListboxLayout(
  input: HTMLInputElement,
  listbox?: HTMLUListElement | null,
): ListboxLayout {
  const rect = input.getBoundingClientRect()
  const view = input.ownerDocument.defaultView
  const viewportHeight = Math.max(1, view?.innerHeight ?? 1)
  const viewportWidth = Math.max(1, view?.innerWidth ?? 1)
  const heightCap = Math.min(
    LISTBOX_MAX_HEIGHT_PX,
    viewportHeight * LISTBOX_MAX_VIEWPORT_RATIO,
  )
  const measuredHeight = listbox?.scrollHeight ?? 0
  const desiredHeight = Math.min(
    heightCap,
    measuredHeight > 0 ? measuredHeight : heightCap,
  )
  const spaceAbove = Math.max(
    0,
    rect.top - LISTBOX_VIEWPORT_GAP_PX - LISTBOX_ANCHOR_GAP_PX,
  )
  const spaceBelow = Math.max(
    0,
    viewportHeight -
      rect.bottom -
      LISTBOX_VIEWPORT_GAP_PX -
      LISTBOX_ANCHOR_GAP_PX,
  )
  const placement: ListboxPlacement =
    spaceBelow < desiredHeight && spaceAbove > spaceBelow ? 'above' : 'below'
  const availableHeight = placement === 'above' ? spaceAbove : spaceBelow
  const maxHeight = Math.max(1, Math.min(heightCap, availableHeight))
  const width = Math.max(
    1,
    Math.min(
      rect.width || input.offsetWidth || 1,
      viewportWidth - LISTBOX_VIEWPORT_GAP_PX * 2,
    ),
  )
  const maximumLeft = Math.max(
    LISTBOX_VIEWPORT_GAP_PX,
    viewportWidth - LISTBOX_VIEWPORT_GAP_PX - width,
  )
  const left = Math.min(
    Math.max(rect.left, LISTBOX_VIEWPORT_GAP_PX),
    maximumLeft,
  )

  return {
    anchorBottom: rect.bottom,
    anchorTop: rect.top,
    left,
    maxHeight,
    placement,
    viewportHeight,
    width,
  }
}

function sameListboxLayout(
  left: ListboxLayout | null,
  right: ListboxLayout,
): boolean {
  return Boolean(
    left &&
      left.anchorBottom === right.anchorBottom &&
      left.anchorTop === right.anchorTop &&
      left.left === right.left &&
      left.maxHeight === right.maxHeight &&
      left.placement === right.placement &&
      left.viewportHeight === right.viewportHeight &&
      left.width === right.width,
  )
}

function joinClassNames(...classNames: (string | undefined)[]): string {
  return classNames.filter(Boolean).join(' ')
}

function sectionComboboxOptions(
  options: readonly SearchableComboboxOption[],
): readonly ComboboxOptionSection[] {
  const sections: Array<{
    group: SearchableComboboxOptionGroup | null
    options: IndexedComboboxOption[]
  }> = []

  options.forEach((option, index) => {
    const group = option.group ?? null
    const current = sections.at(-1)
    const sameGroup = current
      ? current.group?.key === group?.key &&
        current.group?.label === group?.label
      : false
    if (current && sameGroup) {
      current.options.push({ index, option })
      return
    }
    sections.push({
      group,
      options: [{ index, option }],
    })
  })

  return sections
}

export function SearchableCombobox({
  className,
  defaultQuery = '',
  disabled = false,
  disabledMessage: disabledMessageProp,
  emptyMessage: emptyMessageProp,
  error = null,
  id,
  label,
  loading = false,
  loadingMessage: loadingMessageProp,
  noResultsMessage: noResultsMessageProp,
  onChange,
  onFocus,
  onQueryChange,
  options,
  placeholder,
  providerCapability,
  query: controlledQuery,
  queryResetKey,
  value,
}: SearchableComboboxProps) {
  const { t } = useI18n()
  const disabledMessage =
    disabledMessageProp ?? t('common.unavailable')
  const emptyMessage = emptyMessageProp ?? t('common.noOptions')
  const loadingMessage = loadingMessageProp ?? t('common.loadingList')
  const noResultsMessage = noResultsMessageProp ?? t('common.noResults')
  const generatedId = useId().replaceAll(':', '')
  const inputId = id ?? `searchable-combobox-${generatedId}`
  const labelId = `${inputId}-label`
  const listboxId = `${inputId}-listbox`
  const statusId = `${inputId}-status`
  const [queryState, setQueryState] = useState<QueryState>({
    resetKey: queryResetKey,
    value: defaultQuery,
  })
  const [interaction, setInteraction] = useState<InteractionState>({
    activeIndex: -1,
    open: false,
    resetKey: queryResetKey,
  })
  const activeOptionRef = useRef<HTMLLIElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const [listboxLayout, setListboxLayout] =
    useState<ListboxLayout | null>(null)

  const uncontrolledQuery = Object.is(queryState.resetKey, queryResetKey)
    ? queryState.value
    : ''
  const query = controlledQuery ?? uncontrolledQuery
  const filteredOptions = useMemo(
    () => filterComboboxOptions(options, query),
    [options, query],
  )
  const optionSections = useMemo(
    () => sectionComboboxOptions(filteredOptions),
    [filteredOptions],
  )
  const selectedOption = options.find((option) => option.value === value)
  const unavailable =
    disabled || loading || error !== null || options.length === 0
  const interactionIsCurrent = Object.is(
    interaction.resetKey,
    queryResetKey,
  )
  const open = interactionIsCurrent && interaction.open && !unavailable
  const activeIndex =
    open && filteredOptions.length > 0
      ? interaction.activeIndex >= 0 &&
        interaction.activeIndex < filteredOptions.length
        ? interaction.activeIndex
        : 0
      : -1
  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
  const activeOptionValue =
    activeIndex >= 0 ? filteredOptions[activeIndex]?.value : undefined
  const inputValue = open ? query : (selectedOption?.label ?? '')

  useLayoutEffect(() => {
    if (!open || activeIndex < 0) {
      return
    }

    const activeOption = activeOptionRef.current
    if (typeof activeOption?.scrollIntoView === 'function') {
      activeOption.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, activeOptionValue, open])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const input = inputRef.current
    if (!input) {
      return
    }
    const view = input.ownerDocument.defaultView
    const updateLayout = () => {
      const nextLayout = resolveListboxLayout(input, listboxRef.current)
      setListboxLayout((currentLayout) =>
        sameListboxLayout(currentLayout, nextLayout)
          ? currentLayout
          : nextLayout,
      )
    }

    updateLayout()
    view?.addEventListener('resize', updateLayout)
    input.ownerDocument.addEventListener('scroll', updateLayout, true)
    return () => {
      view?.removeEventListener('resize', updateLayout)
      input.ownerDocument.removeEventListener('scroll', updateLayout, true)
    }
  }, [filteredOptions, open])

  const updateQuery = (nextQuery: string) => {
    if (controlledQuery === undefined) {
      setQueryState({ resetKey: queryResetKey, value: nextQuery })
    }
    onQueryChange?.(nextQuery)
  }

  const openListbox = () => {
    if (unavailable) {
      return
    }

    const selectedIndex = filteredOptions.findIndex(
      (option) => option.value === value,
    )
    if (inputRef.current) {
      setListboxLayout(resolveListboxLayout(inputRef.current))
    }
    setInteraction({
      activeIndex:
        selectedIndex >= 0 ? selectedIndex : filteredOptions.length > 0 ? 0 : -1,
      open: true,
      resetKey: queryResetKey,
    })
  }

  const closeListbox = () => {
    setListboxLayout(null)
    setInteraction({
      activeIndex: -1,
      open: false,
      resetKey: queryResetKey,
    })
  }

  const commitOption = (option: SearchableComboboxOption) => {
    const canonicalOption = options.find(
      (candidate) => candidate.value === option.value,
    )
    if (!canonicalOption) {
      return
    }

    closeListbox()
    onChange(canonicalOption.value, canonicalOption)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value
    const nextOptions = filterComboboxOptions(options, nextQuery)
    updateQuery(nextQuery)
    setListboxLayout(resolveListboxLayout(event.currentTarget))
    setInteraction({
      activeIndex: nextOptions.length > 0 ? 0 : -1,
      open: true,
      resetKey: queryResetKey,
    })
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (event.relatedTarget?.closest(`#${CSS.escape(listboxId)}`)) {
      return
    }
    closeListbox()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        if (!open) {
          openListbox()
          return
        }
        if (filteredOptions.length === 0) {
          return
        }
        setInteraction({
          activeIndex: (activeIndex + 1) % filteredOptions.length,
          open: true,
          resetKey: queryResetKey,
        })
        return
      }
      case 'ArrowUp': {
        event.preventDefault()
        if (!open) {
          openListbox()
          return
        }
        if (filteredOptions.length === 0) {
          return
        }
        setInteraction({
          activeIndex:
            (activeIndex - 1 + filteredOptions.length) %
            filteredOptions.length,
          open: true,
          resetKey: queryResetKey,
        })
        return
      }
      case 'Enter': {
        if (!open) {
          event.preventDefault()
          openListbox()
          return
        }

        const activeOption = filteredOptions[activeIndex]
        if (activeOption) {
          event.preventDefault()
          commitOption(activeOption)
        }
        return
      }
      case 'Escape': {
        if (open) {
          event.preventDefault()
          closeListbox()
          event.currentTarget.select()
        }
        return
      }
      default:
        return
    }
  }

  const statusMessage = error
    ? error
    : loading
      ? loadingMessage
      : disabled
        ? disabledMessage
        : options.length === 0
          ? emptyMessage
          : open && filteredOptions.length === 0
            ? noResultsMessage
            : ''

  const renderOption = ({
    index,
    option,
  }: IndexedComboboxOption) => {
    const highlighted = index === activeIndex
    const selected = option.value === value
    return (
      <li
        aria-selected={selected}
        className={joinClassNames(
          'searchable-combobox__option',
          highlighted
            ? 'searchable-combobox__option--highlighted'
            : undefined,
          selected
            ? 'searchable-combobox__option--selected'
            : undefined,
        )}
        data-highlighted={highlighted || undefined}
        id={`${listboxId}-option-${index}`}
        key={option.value}
        onClick={() => commitOption(option)}
        onMouseDown={(event: MouseEvent<HTMLLIElement>) => {
          event.preventDefault()
        }}
        onMouseMove={() => {
          if (!highlighted) {
            setInteraction({
              activeIndex: index,
              open: true,
              resetKey: queryResetKey,
            })
          }
        }}
        ref={highlighted ? activeOptionRef : undefined}
        role="option"
      >
        {option.label}
      </li>
    )
  }

  const listbox = open ? (
    <ul
      aria-labelledby={labelId}
      className="searchable-combobox__listbox"
      data-placement={listboxLayout?.placement ?? 'below'}
      id={listboxId}
      ref={listboxRef}
      role="listbox"
      style={listboxLayout
        ? {
            bottom: listboxLayout.placement === 'above'
              ? listboxLayout.viewportHeight -
                listboxLayout.anchorTop +
                LISTBOX_ANCHOR_GAP_PX
              : 'auto',
            left: listboxLayout.left,
            maxHeight: listboxLayout.maxHeight,
            top: listboxLayout.placement === 'below'
              ? listboxLayout.anchorBottom + LISTBOX_ANCHOR_GAP_PX
              : 'auto',
            width: listboxLayout.width,
          }
        : undefined}
    >
      {optionSections.map((section, sectionIndex) => {
        if (!section.group) {
          return (
            <Fragment key={`ungrouped-${sectionIndex}`}>
              {section.options.map(renderOption)}
            </Fragment>
          )
        }
        const headingId = `${listboxId}-group-${sectionIndex}`
        return (
          <li
            aria-labelledby={headingId}
            className="searchable-combobox__group"
            key={`${section.group.key}-${sectionIndex}`}
            role="group"
          >
            <div
              className="searchable-combobox__group-heading"
              id={headingId}
            >
              {section.group.label}
            </div>
            <ul
              className="searchable-combobox__group-options"
              role="presentation"
            >
              {section.options.map(renderOption)}
            </ul>
          </li>
        )
      })}
    </ul>
  ) : null

  return (
    <div
      className={joinClassNames('searchable-combobox', className)}
      data-provider-capability={providerCapability}
      data-state={
        error
          ? 'error'
          : loading
            ? 'loading'
            : unavailable
              ? 'disabled'
              : open
                ? 'open'
                : 'ready'
      }
    >
      <label
        className="searchable-combobox__label"
        htmlFor={inputId}
        id={labelId}
      >
        {label}
      </label>
      <input
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-busy={loading || undefined}
        aria-controls={listboxId}
        aria-describedby={statusId}
        aria-errormessage={error ? statusId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        className="searchable-combobox__input"
        disabled={unavailable}
        id={inputId}
        onBlur={handleBlur}
        onChange={handleInputChange}
        onClick={openListbox}
        onFocus={() => {
          openListbox()
          onFocus?.()
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        role="combobox"
        type="text"
        value={inputValue}
      />

      {listbox && typeof document !== 'undefined'
        ? createPortal(listbox, document.body)
        : listbox}

      <p
        aria-atomic="true"
        aria-live="polite"
        className="searchable-combobox__status"
        id={statusId}
        role="status"
      >
        {statusMessage}
      </p>
    </div>
  )
}
