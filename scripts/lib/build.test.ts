import { describe, expect, test } from 'vitest'
import type { AdeEvent } from './ade.ts'
import { buildEventData, type VenueLocations } from './build.ts'

function adeEvent(id: number, venue: string, overrides: Partial<AdeEvent> = {}): AdeEvent {
  return {
    id,
    title: `Event ${id}`,
    start_date_time: { date: '2026-10-23 23:00:00.000000', timezone: 'Europe/Amsterdam' },
    end_date_time: { date: '2026-10-24 05:00:00.000000', timezone: 'Europe/Amsterdam' },
    show_end_date_time: true,
    url: `https://www.amsterdam-dance-event.nl/en/program/2026/event-${id}/${id}/`,
    venue: { title: venue },
    ...overrides,
  }
}

const locations: VenueLocations = {
  Melkweg: { adeId: 1, address: 'Lijnbaansgracht 234A, Amsterdam', lat: 52.3647, lng: 4.8812, status: 'located' },
  Paradiso: { adeId: 2, address: 'Weteringschans 6-8, Amsterdam', lat: 52.3622, lng: 4.8838, status: 'located' },
  'Somewhere Unknown': { adeId: 3, address: null, lat: null, lng: null, status: 'no-address' },
}

const collectedAt = '2026-10-20T10:00:00.000Z'

describe('buildEventData', () => {
  test('joins events to located venues', () => {
    const { data, report } = buildEventData({
      rawEvents: [adeEvent(1, 'Melkweg'), adeEvent(2, 'Paradiso'), adeEvent(3, 'Melkweg')],
      locations,
      overrides: {},
      collectedAt,
    })

    expect(data.venues.map((venue) => venue.name)).toEqual(['Melkweg', 'Paradiso'])
    expect(data.events.map((event) => [event.id, event.venueId])).toEqual([
      ['ade-1', 'ade-venue-1'],
      ['ade-2', 'ade-venue-2'],
      ['ade-3', 'ade-venue-1'],
    ])
    expect(report.events).toBe(3)
    expect(report.skipped).toEqual({})
  })

  test('skips events whose venue could not be located, and reports why', () => {
    const { data, report } = buildEventData({
      rawEvents: [adeEvent(1, 'Somewhere Unknown'), adeEvent(2, 'Not In Cache'), adeEvent(3, 'Secret Location')],
      locations,
      overrides: {},
      collectedAt,
    })

    expect(data.events).toEqual([])
    expect(report.skipped).toEqual({ 'venue-not-located': 2, 'hidden-venue': 1 })
  })

  test('an override can fix a venue location by hand', () => {
    const { data } = buildEventData({
      rawEvents: [adeEvent(1, 'Somewhere Unknown')],
      locations,
      overrides: { 'Somewhere Unknown': { address: 'Dam 1, Amsterdam', lat: 52.373, lng: 4.8925 } },
      collectedAt,
    })

    expect(data.venues).toEqual([
      { id: 'ade-venue-3', name: 'Somewhere Unknown', address: 'Dam 1, Amsterdam', lat: 52.373, lng: 4.8925 },
    ])
  })

  test('an override can hide a venue', () => {
    const { data, report } = buildEventData({
      rawEvents: [adeEvent(1, 'Melkweg')],
      locations,
      overrides: { Melkweg: { hidden: true } },
      collectedAt,
    })

    expect(data.events).toEqual([])
    expect(report.skipped).toEqual({ 'hidden-venue': 1 })
  })

  test('counts estimated end times and daily windows', () => {
    const { report } = buildEventData({
      rawEvents: [
        adeEvent(1, 'Melkweg', { show_end_date_time: false }),
        adeEvent(2, 'Paradiso', {
          start_date_time: { date: '2026-10-21 12:00:00.000000', timezone: 'Europe/Amsterdam' },
          end_date_time: { date: '2026-10-22 18:00:00.000000', timezone: 'Europe/Amsterdam' },
        }),
      ],
      locations,
      overrides: {},
      collectedAt,
    })

    expect(report).toMatchObject({ listings: 2, events: 3, estimatedEnds: 1, dailyWindows: 2 })
  })

  test('venues outside the Amsterdam area are skipped', () => {
    const { report } = buildEventData({
      rawEvents: [adeEvent(1, 'Melkweg')],
      locations: { Melkweg: { ...locations.Melkweg!, lat: 51.92, lng: 4.48 } },
      overrides: {},
      collectedAt,
    })

    expect(report.skipped).toEqual({ 'venue-outside-area': 1 })
  })
})
