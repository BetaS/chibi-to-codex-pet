export interface SearchableComboboxOptionGroup {
  readonly key: string
  readonly label: string
  readonly searchTerms?: readonly string[]
}

export interface SearchableComboboxOption {
  readonly group?: SearchableComboboxOptionGroup
  readonly label: string
  readonly value: string
}

export function filterComboboxOptions(
  options: readonly SearchableComboboxOption[],
  query: string,
): readonly SearchableComboboxOption[] {
  if (query.length === 0) {
    return options
  }

  const normalizedQuery = query.toLocaleLowerCase()
  return options.filter(
    (option) =>
      option.label.toLocaleLowerCase().includes(normalizedQuery) ||
      option.value.toLocaleLowerCase().includes(normalizedQuery) ||
      option.group?.key.toLocaleLowerCase().includes(normalizedQuery) ||
      option.group?.label.toLocaleLowerCase().includes(normalizedQuery) ||
      option.group?.searchTerms?.some((term) =>
        term.toLocaleLowerCase().includes(normalizedQuery),
      ),
  )
}
