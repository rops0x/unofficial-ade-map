import {
  AMSTERDAM_BOUNDS,
  EventDataSchema,
  EventSchema,
  type EventData,
  type MapEvent,
  type Venue,
  VenueSchema,
} from '../../src/events/schema.ts'
import { isHiddenVenueName } from '../../src/events/hidden.ts'
import { type AdeEvent, type NormalizeSkipReason, normalizeAdeEvent, type Occurrence } from './ade.ts'

export type LocationStatus = 'located' | 'no-address' | 'not-found'

export interface VenueLocation {
  readonly adeId: number
  readonly address: string | null
  readonly lat: number | null
  readonly lng: number | null
  readonly status: LocationStatus
}

/** Hand-made fixes in data/venue-overrides.json: hide a venue, or set its location. */
export type VenueOverride =
  | { readonly hidden: true }
  | { readonly address: string; readonly lat: number; readonly lng: number }

export type VenueLocations = Readonly<Record<string, VenueLocation>>
export type VenueOverrides = Readonly<Record<string, VenueOverride>>

export type SkipReason = NormalizeSkipReason | 'venue-not-located' | 'venue-outside-area' | 'invalid'

export interface BuildInput {
  readonly rawEvents: readonly AdeEvent[]
  readonly locations: VenueLocations
  readonly overrides: VenueOverrides
  readonly collectedAt: string
}

export interface BuildReport {
  readonly listings: number
  readonly events: number
  readonly venues: number
  readonly estimatedEnds: number
  readonly dailyWindows: number
  readonly skipped: Readonly<Partial<Record<SkipReason, number>>>
  readonly skippedExamples: readonly string[]
}

type VenueResult = { readonly ok: true; readonly venue: Venue } | { readonly ok: false; readonly reason: SkipReason }

const MAX_EXAMPLES = 15

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function isInsideAmsterdam(lat: number, lng: number): boolean {
  const { south, north, west, east } = AMSTERDAM_BOUNDS
  return lat >= south && lat <= north && lng >= west && lng <= east
}

function resolveVenue(name: string, locations: VenueLocations, overrides: VenueOverrides): VenueResult {
  // Object.hasOwn: a venue named "constructor" must not pick up inherited properties.
  const override = Object.hasOwn(overrides, name) ? overrides[name] : undefined
  const location = Object.hasOwn(locations, name) ? locations[name] : undefined
  if (isHiddenVenueName(name) || (override && 'hidden' in override)) return { ok: false, reason: 'hidden-venue' }

  const id = location ? `ade-venue-${location.adeId}` : `venue-${slug(name) || encodeURIComponent(name)}`
  const placed = override ?? (location?.status === 'located' ? location : null)
  if (!placed || placed.address === null || placed.lat === null || placed.lng === null) {
    return { ok: false, reason: 'venue-not-located' }
  }
  if (!isInsideAmsterdam(placed.lat, placed.lng)) return { ok: false, reason: 'venue-outside-area' }

  const parsed = VenueSchema.safeParse({ id, name, address: placed.address, lat: placed.lat, lng: placed.lng })
  return parsed.success ? { ok: true, venue: parsed.data } : { ok: false, reason: 'invalid' }
}

function toMapEvent(occurrence: Occurrence, venueId: string): MapEvent | null {
  const { venueName: _venueName, ...rest } = occurrence
  const parsed = EventSchema.safeParse({ ...rest, venueId })
  return parsed.success ? parsed.data : null
}

type Outcome =
  | { readonly kind: 'kept'; readonly venue: Venue; readonly events: readonly MapEvent[] }
  | { readonly kind: 'skipped'; readonly reason: SkipReason; readonly example: string }

function processListing(raw: AdeEvent, input: BuildInput): Outcome {
  const skip = (reason: SkipReason): Outcome => ({ kind: 'skipped', reason, example: `${reason}: ${raw.title} @ ${raw.venue?.title ?? '?'}` })
  const normalized = normalizeAdeEvent(raw)
  if (!normalized.ok) return skip(normalized.reason)

  const venueName = normalized.occurrences[0]?.venueName ?? ''
  const venue = resolveVenue(venueName, input.locations, input.overrides)
  if (!venue.ok) return skip(venue.reason)

  const events = normalized.occurrences.map((occurrence) => toMapEvent(occurrence, venue.venue.id))
  if (events.length === 0 || events.some((event) => event === null)) return skip('invalid')
  return { kind: 'kept', venue: venue.venue, events: events.filter((event): event is MapEvent => event !== null) }
}

function countBy<T extends string>(values: readonly T[]): Partial<Record<T, number>> {
  return values.reduce<Partial<Record<T, number>>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {})
}

export function buildEventData(input: BuildInput): { data: EventData; report: BuildReport } {
  const outcomes = input.rawEvents.map((raw) => processListing(raw, input))
  const kept = outcomes.filter((outcome) => outcome.kind === 'kept')
  const skipped = outcomes.filter((outcome) => outcome.kind === 'skipped')

  const events = kept.flatMap((outcome) => outcome.events)
  const venues = [...new Map(kept.map((outcome) => [outcome.venue.id, outcome.venue])).values()]
  const data = EventDataSchema.parse({ collectedAt: input.collectedAt, venues, events })

  return {
    data,
    report: {
      listings: input.rawEvents.length,
      events: events.length,
      venues: venues.length,
      estimatedEnds: events.filter((event) => event.isEndEstimated).length,
      dailyWindows: events.filter((event) => event.isDaily).length,
      skipped: countBy(skipped.map((outcome) => outcome.reason)),
      skippedExamples: skipped.slice(0, MAX_EXAMPLES).map((outcome) => outcome.example),
    },
  }
}
