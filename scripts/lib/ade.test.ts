import { describe, expect, test } from 'vitest'
import { type AdeEvent, AdeEventSchema, extractVenueAddress, normalizeAdeEvent } from './ade.ts'

const iso = (ms: number): string => new Date(ms).toISOString()

function adeEvent(overrides: Partial<AdeEvent> = {}): AdeEvent {
  return {
    id: 101,
    title: 'Night &amp; Day',
    start_date_time: { date: '2026-10-23 23:00:00.000000', timezone: 'Europe/Amsterdam' },
    end_date_time: { date: '2026-10-24 05:00:00.000000', timezone: 'Europe/Amsterdam' },
    show_end_date_time: true,
    url: 'https://www.amsterdam-dance-event.nl/en/program/2026/night-day/101/',
    venue: { title: 'Melkweg' },
    ...overrides,
  }
}

describe('normalizeAdeEvent', () => {
  test('converts Amsterdam wall-clock times to instants', () => {
    const result = normalizeAdeEvent(adeEvent())

    expect(result).toEqual({
      ok: true,
      occurrences: [
        {
          id: 'ade-101',
          name: 'Night & Day',
          venueName: 'Melkweg',
          start: '2026-10-23T21:00:00.000Z',
          end: '2026-10-24T03:00:00.000Z',
          isEndEstimated: false,
          isDaily: false,
          sourceUrl: 'https://www.amsterdam-dance-event.nl/en/program/2026/night-day/101/',
        },
      ],
    })
  })

  test('an end time listed on the same date as an overnight start moves to the next morning', () => {
    const result = normalizeAdeEvent(
      adeEvent({ end_date_time: { date: '2026-10-23 05:00:00.000000', timezone: 'Europe/Amsterdam' } }),
    )

    expect(result.ok && result.occurrences[0]?.end).toBe('2026-10-24T03:00:00.000Z')
  })

  test('an end date months before the start keeps its time, on the start day', () => {
    const result = normalizeAdeEvent(
      adeEvent({
        start_date_time: { date: '2026-10-22 20:30:00.000000', timezone: 'Europe/Amsterdam' },
        end_date_time: { date: '2026-08-27 23:30:00.000000', timezone: 'Europe/Amsterdam' },
      }),
    )

    expect(result.ok && result.occurrences.map((o) => [o.start, o.end, o.isDaily])).toEqual([
      ['2026-10-22T18:30:00.000Z', '2026-10-22T21:30:00.000Z', false],
    ])
  })

  test('an end date months before an overnight start moves to the next morning', () => {
    const result = normalizeAdeEvent(
      adeEvent({ end_date_time: { date: '2026-07-01 05:00:00.000000', timezone: 'Europe/Amsterdam' } }),
    )

    expect(result.ok && result.occurrences[0]?.end).toBe('2026-10-24T03:00:00.000Z')
  })

  test('a corrected end that would make the event implausibly long falls back to 8 hours', () => {
    const result = normalizeAdeEvent(
      adeEvent({
        start_date_time: { date: '2026-10-22 17:00:00.000000', timezone: 'Europe/Amsterdam' },
        end_date_time: { date: '2026-10-22 11:00:00.000000', timezone: 'Europe/Amsterdam' },
      }),
    )

    expect(result.ok && result.occurrences[0]).toMatchObject({ end: '2026-10-22T23:00:00.000Z', isEndEstimated: true })
  })

  test('a 24-hour listing across the clock change is one event, not a daily one', () => {
    const result = normalizeAdeEvent(
      adeEvent({
        start_date_time: { date: '2026-10-24 12:00:00.000000', timezone: 'Europe/Amsterdam' },
        end_date_time: { date: '2026-10-25 12:00:00.000000', timezone: 'Europe/Amsterdam' },
      }),
    )

    expect(result.ok && result.occurrences.map((o) => o.isDaily)).toEqual([false])
  })

  test('a hidden end time is assumed to be 8 hours after the start', () => {
    const result = normalizeAdeEvent(adeEvent({ show_end_date_time: false }))

    expect(result.ok && result.occurrences[0]).toMatchObject({
      end: '2026-10-24T05:00:00.000Z',
      isEndEstimated: true,
    })
  })

  test('a missing end time is assumed to be 8 hours after the start', () => {
    const result = normalizeAdeEvent(adeEvent({ end_date_time: null }))

    expect(result.ok && result.occurrences[0]).toMatchObject({ end: '2026-10-24T05:00:00.000Z', isEndEstimated: true })
  })

  test('an end equal to the start is treated as unknown', () => {
    const result = normalizeAdeEvent(
      adeEvent({ end_date_time: { date: '2026-10-23 23:00:00.000000', timezone: 'Europe/Amsterdam' } }),
    )

    expect(result.ok && result.occurrences[0]?.isEndEstimated).toBe(true)
  })

  test('a multi-day listing becomes one window per day', () => {
    const result = normalizeAdeEvent(
      adeEvent({
        start_date_time: { date: '2026-10-21 08:00:00.000000', timezone: 'Europe/Amsterdam' },
        end_date_time: { date: '2026-10-23 18:00:00.000000', timezone: 'Europe/Amsterdam' },
      }),
    )

    expect(result.ok && result.occurrences.map((o) => [o.id, o.start, o.end, o.isDaily])).toEqual([
      ['ade-101-2026-10-21', '2026-10-21T06:00:00.000Z', '2026-10-21T16:00:00.000Z', true],
      ['ade-101-2026-10-22', '2026-10-22T06:00:00.000Z', '2026-10-22T16:00:00.000Z', true],
      ['ade-101-2026-10-23', '2026-10-23T06:00:00.000Z', '2026-10-23T16:00:00.000Z', true],
    ])
  })

  test('a 02:00 end on 25 Oct uses the first 02:00, before the clocks go back', () => {
    const result = normalizeAdeEvent(
      adeEvent({
        start_date_time: { date: '2026-10-24 22:00:00.000000', timezone: 'Europe/Amsterdam' },
        end_date_time: { date: '2026-10-25 02:00:00.000000', timezone: 'Europe/Amsterdam' },
      }),
    )

    expect(result.ok && result.occurrences[0]?.end).toBe(iso(Date.parse('2026-10-25T00:00:00Z')))
  })

  test('skips an event at a secret location', () => {
    expect(normalizeAdeEvent(adeEvent({ venue: { title: 'Secret Location' } }))).toEqual({
      ok: false,
      reason: 'hidden-venue',
    })
  })

  test('skips an event without a venue', () => {
    expect(normalizeAdeEvent(adeEvent({ venue: null }))).toEqual({ ok: false, reason: 'no-venue' })
    // Seen on 2026-10-23: a listing with a venue but no venue name. Skip it, don't fail the whole crawl.
    expect(normalizeAdeEvent(AdeEventSchema.parse({ ...adeEvent(), venue: { title: null } }))).toEqual({ ok: false, reason: 'no-venue' })
  })

  test('skips an event without a link to its event page', () => {
    expect(normalizeAdeEvent(adeEvent({ url: '' }))).toEqual({ ok: false, reason: 'no-event-page' })
  })

  test('skips an event with an unreadable start time', () => {
    const result = normalizeAdeEvent(adeEvent({ start_date_time: { date: 'soon', timezone: 'Europe/Amsterdam' } }))

    expect(result).toEqual({ ok: false, reason: 'invalid-time' })
  })
})

describe('AdeEventSchema', () => {
  test('reads an event’s categories and sold-out flag', () => {
    const parsed = AdeEventSchema.parse({ ...adeEvent(), categories: 'Nighttime events / Techno', soldOut: true })

    expect(parsed).toMatchObject({ categories: 'Nighttime events / Techno', soldOut: true })
  })

  test('categories or a sold-out flag of an unexpected kind never block the event, which matters more than its filters', () => {
    const parsed = AdeEventSchema.parse({ ...adeEvent(), categories: ['Techno'], soldOut: 'no' })

    expect(parsed).toMatchObject({ id: 101, categories: null, soldOut: null })
  })
})

describe('extractVenueAddress', () => {
  test('reads the address from the venue page map link', () => {
    const html = `<div>Venue | <a class="ade-two-columns-header__link"
      href="https://www.google.com/maps/search/?api=1&amp;query=Zonneplein 30, Amsterdam"
      target="_blank">Zonneplein 30, Amsterdam</a></div>`

    expect(extractVenueAddress(html)).toBe('Zonneplein 30, Amsterdam')
  })

  test('decodes encoded characters', () => {
    const html = '<a href="https://www.google.com/maps/search/?api=1&amp;query=Prins%20Hendrikkade%2033%2C%20Amsterdam">x</a>'

    expect(extractVenueAddress(html)).toBe('Prins Hendrikkade 33, Amsterdam')
  })

  test('is null when the page shows no address', () => {
    expect(extractVenueAddress('<div>Venue</div>')).toBeNull()
  })
})
