import {
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

import { useI18n } from '../../../i18n'
import {
  filterComboboxOptions,
  type SearchableComboboxOption,
} from './searchableComboboxOptions'

export type { SearchableComboboxOption } from './searchableComboboxOptions'

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

function joinClassNames(...classNames: (string | undefined)[]): string {
  return classNames.filter(Boolean).join(' ')
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

  const uncontrolledQuery = Object.is(queryState.resetKey, queryResetKey)
    ? queryState.value
    : ''
  const query = controlledQuery ?? uncontrolledQuery
  const filteredOptions = useMemo(
    () => filterComboboxOptions(options, query),
    [options, query],
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
    setInteraction({
      activeIndex:
        selectedIndex >= 0 ? selectedIndex : filteredOptions.length > 0 ? 0 : -1,
      open: true,
      resetKey: queryResetKey,
    })
  }

  const closeListbox = () => {
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

  return (
    <div
      className={joinClassNames('searchable-combobox', className)}
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
        role="combobox"
        type="text"
        value={inputValue}
      />

      {open ? (
        <ul
          aria-labelledby={labelId}
          className="searchable-combobox__listbox"
          id={listboxId}
          role="listbox"
        >
          {filteredOptions.map((option, index) => {
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
          })}
        </ul>
      ) : null}

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
