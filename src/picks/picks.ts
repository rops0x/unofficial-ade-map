import type { EventPick, LoadedEvent } from '../events/data.ts'
import type { Pick, PicksData } from './schema.ts'

/**
 * Marks each picked event with its note and source, returning new events.
 * The bundled file is validated at build time and in tests, like events.json.
 */
export function attachPicks(events: readonly LoadedEvent[], data: PicksData): readonly LoadedEvent[] {
  const sources = new Map(data.sources.map((source) => [source.id, source]))
  const picks = new Map(
    data.picks.flatMap((pick): [string, EventPick][] => {
      const source = sources.get(pick.sourceId)
      if (!source) return []
      return [[pick.eventId, pick.note === undefined ? { source } : { note: pick.note, source }]]
    }),
  )
  return events.map((event) => {
    const pick = picks.get(event.id)
    return pick ? { ...event, pick } : event
  })
}

/** Picks whose event is no longer in the collected data (cancelled, renamed, or never listed on the map). */
export function unmatchedPicks(data: PicksData, eventIds: ReadonlySet<string>): readonly Pick[] {
  return data.picks.filter((pick) => !eventIds.has(pick.eventId))
}
