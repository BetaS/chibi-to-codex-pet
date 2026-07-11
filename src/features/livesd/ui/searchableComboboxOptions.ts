export interface SearchableComboboxOption {
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
      option.value.toLocaleLowerCase().includes(normalizedQuery),
  )
}
