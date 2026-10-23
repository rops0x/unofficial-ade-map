import type { StatusNoun } from '../ui/status.ts'
import { activeFilterCount, type Filterable, type FilterSelection, matchesFilters } from './filters.ts'

/** What the visitor narrowed the map to: picks only, ADE's filters, or both. */
export interface ShownView {
  readonly isPicksOnly: boolean
  readonly selection: FilterSelection
}

/** The events the map shows: only picks when asked, and only those that match the chosen filters. */
export function shownEvents<T extends Filterable & { readonly pick?: unknown }>(events: readonly T[], view: ShownView): readonly T[] {
  return events.filter((event) => (!view.isPicksOnly || event.pick !== undefined) && matchesFilters(event, view.selection))
}

/** What the status line counts, so "3 matching picks on" says exactly what is on the map. */
export function shownNoun(view: ShownView): StatusNoun {
  const isFiltering = activeFilterCount(view.selection) > 0
  if (view.isPicksOnly) return isFiltering ? 'matching pick' : 'pick'
  return isFiltering ? 'matching event' : 'event'
}
