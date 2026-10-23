/** What the visitor chose in the filters: option ids per filter group, and whether to hide sold-out events. */
export interface FilterSelection {
  readonly chosen: Readonly<Record<string, readonly string[]>>
  readonly isHidingSoldOut: boolean
}

/** The parts of an event the filters look at. */
export interface Filterable {
  // `| undefined` so events typed from the zod schema fit (exactOptionalPropertyTypes).
  readonly tags?: readonly string[] | undefined
  readonly isSoldOut?: boolean | undefined
}

export const EMPTY_SELECTION: FilterSelection = { chosen: {}, isHidingSoldOut: false }

const chosenIn = (selection: FilterSelection, groupId: string): readonly string[] =>
  Object.hasOwn(selection.chosen, groupId) ? (selection.chosen[groupId] ?? []) : []

export function isOptionChosen(selection: FilterSelection, groupId: string, optionId: string): boolean {
  return chosenIn(selection, groupId).includes(optionId)
}

export function toggleOption(selection: FilterSelection, groupId: string, optionId: string): FilterSelection {
  const current = chosenIn(selection, groupId)
  const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
  return { ...selection, chosen: { ...selection.chosen, [groupId]: next } }
}

export function activeFilterCount(selection: FilterSelection): number {
  const chosenCount = Object.values(selection.chosen).reduce((total, ids) => total + ids.length, 0)
  return chosenCount + (selection.isHidingSoldOut ? 1 : 0)
}

/** Like ADE's program page: any chosen option within a group, and every group with a choice. */
export function matchesFilters(event: Filterable, selection: FilterSelection): boolean {
  if (selection.isHidingSoldOut && event.isSoldOut === true) return false
  const tags = event.tags ?? []
  return Object.values(selection.chosen).every((ids) => ids.length === 0 || ids.some((id) => tags.includes(id)))
}
