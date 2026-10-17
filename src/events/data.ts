import type { Timed } from '../time/moments.ts'
import type { EventData, MapEvent, Venue } from './schema.ts'

export interface LoadedEvent extends MapEvent, Timed {
  readonly venue: Venue
}

export interface LoadedData {
  readonly collectedAt: number
  readonly venues: readonly Venue[]
  readonly events: readonly LoadedEvent[]
}

export interface VenueGroup {
  readonly venue: Venue
  readonly events: readonly LoadedEvent[]
}

/**
 * Joins events to venues and parses times once. The bundled file is validated
 * against EventDataSchema at build time and in tests, so zod stays out of the browser bundle.
 */
export function loadEventData(data: EventData): LoadedData {
  const venues = new Map(data.venues.map((venue) => [venue.id, venue]))
  const events = data.events.flatMap((event) => {
    const venue = venues.get(event.venueId)
    return venue ? [{ ...event, venue, startMs: Date.parse(event.start), endMs: Date.parse(event.end) }] : []
  })
  return { collectedAt: Date.parse(data.collectedAt), venues: data.venues, events }
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
