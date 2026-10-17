import { describe, expect, test } from 'vitest'
import bundled from '../data/events.json'
import { groupByVenue, loadEventData } from './data.ts'
import { EventDataSchema, type EventData } from './schema.ts'

const data: EventData = {
  collectedAt: '2026-10-20T10:00:00.000Z',
  venues: [
    { id: 'v1', name: 'Paradiso', address: 'Weteringschans 6-8, Amsterdam', lat: 52.3622, lng: 4.8838 },
    { id: 'v2', name: 'Melkweg', address: 'Lijnbaansgracht 234A, Amsterdam', lat: 52.3647, lng: 4.8812 },
  ],
  events: [
    { id: 'b', name: 'Late', venueId: 'v1', start: '2026-10-23T23:00:00Z', end: '2026-10-24T04:00:00Z', isEndEstimated: false, isDaily: false, sourceUrl: 'https://example.org/b' },
    { id: 'a', name: 'Early', venueId: 'v1', start: '2026-10-23T20:00:00Z', end: '2026-10-24T02:00:00Z', isEndEstimated: false, isDaily: false, sourceUrl: 'https://example.org/a' },
    { id: 'c', name: 'Other', venueId: 'v2', start: '2026-10-23T21:00:00Z', end: '2026-10-24T03:00:00Z', isEndEstimated: true, isDaily: false, sourceUrl: 'https://example.org/c' },
  ],
}

describe('loadEventData', () => {
  test('joins each event to its venue and parses times once', () => {
    const loaded = loadEventData(data)

    expect(loaded.events[0]).toMatchObject({ id: 'b', venue: { name: 'Paradiso' }, startMs: Date.parse('2026-10-23T23:00:00Z') })
    expect(loaded.collectedAt).toBe(Date.parse('2026-10-20T10:00:00.000Z'))
  })
})

describe('groupByVenue', () => {
  test('groups events per venue, earliest first, venues by name', () => {
    const groups = groupByVenue(loadEventData(data).events)

    expect(groups.map((group) => [group.venue.name, group.events.map((event) => event.id)])).toEqual([
      ['Melkweg', ['c']],
      ['Paradiso', ['a', 'b']],
    ])
  })
})

describe('bundled events.json', () => {
  test('passes the schema, so the site never ships broken data', () => {
    expect(EventDataSchema.safeParse(bundled).success).toBe(true)
  })
})
