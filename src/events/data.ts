import type { FilterGroup } from '../filters/schema.ts'
import type { PickSource } from '../picks/schema.ts'
import type { Timed } from '../time/moments.ts'
import type { EventData, MapEvent, Venue } from './schema.ts'

/** Someone recommended this event; the map highlights it and credits them. */
export interface EventPick {
  readonly note?: string
  readonly source: PickSource
}

export interface LoadedEvent extends MapEvent, Timed {
  readonly venue: Venue
  readonly pick?: EventPick
}

export interface LoadedData {
  readonly collectedAt: number
  readonly venues: readonly Venue[]
  readonly events: readonly LoadedEvent[]
  /** ADE's program filters; empty when the data was collected without them. */
  readonly filters: readonly FilterGroup[]
}

export interface VenueGroup {
  readonly venue: Venue
  readonly events: readonly LoadedEvent[]
}

/**
 * Joins events to venues and parses times once. The bundled file is validated
 * against EventDataSchema at build time and in tests, so the browser doesn't check it again.
 */
export function loadEventData(data: EventData): LoadedData {
  const venues = new Map(data.venues.map((venue) => [venue.id, venue]))
  const events = data.events.flatMap((event) => {
    const venue = venues.get(event.venueId)
    return venue ? [{ ...event, venue, startMs: Date.parse(event.start), endMs: Date.parse(event.end) }] : []
  })
  return { collectedAt: Date.parse(data.collectedAt), venues: data.venues, events, filters: data.filters ?? [] }
}

export function groupByVenue(events: readonly LoadedEvent[]): readonly VenueGroup[] {
  const venueIds = [...new Set(events.map((event) => event.venue.id))]
  return venueIds
    .map((venueId) => {
      const atVenue = events.filter((event) => event.venue.id === venueId)
      return { venue: atVenue[0]!.venue, events: [...atVenue].sort((a, b) => a.startMs - b.startMs) }
    })
    .sort((a, b) => a.venue.name.localeCompare(b.venue.name))
}
