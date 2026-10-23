import { describe, expect, test } from 'vitest'
import type { LoadedEvent } from '../events/data.ts'
import { attachPicks, unmatchedPicks } from './picks.ts'
import type { PicksData } from './schema.ts'

const venue = { id: 'v1', name: 'Paradiso', address: 'Weteringschans 6-8, Amsterdam', lat: 52.3622, lng: 4.8838 }
const source = { id: 'fri', name: 'r/amsterdam_rave', title: 'Friday preview', url: 'https://www.reddit.com/r/amsterdam_rave/comments/1/' }

function event(id: string): LoadedEvent {
  return {
    id,
    name: `Event ${id}`,
    venueId: 'v1',
    venue,
    start: '2026-10-23T21:00:00.000Z',
    end: '2026-10-24T03:00:00.000Z',
    startMs: Date.parse('2026-10-23T21:00:00.000Z'),
    endMs: Date.parse('2026-10-24T03:00:00.000Z'),
    isEndEstimated: false,
    isDaily: false,
    sourceUrl: `https://example.org/${id}`,
  }
}

const picks: PicksData = {
  sources: [source],
  picks: [
    { eventId: 'a', sourceId: 'fri', note: 'Live set.' },
    { eventId: 'gone', sourceId: 'fri' },
  ],
}

describe('attachPicks', () => {
  test('marks each picked event with its note and source', () => {
    const [picked] = attachPicks([event('a')], picks)

    expect(picked?.pick).toEqual({ note: 'Live set.', source })
  })

  test('leaves events nobody picked as they were', () => {
    const original = event('b')

    const [unpicked] = attachPicks([original], picks)

    expect(unpicked).toBe(original)
    expect(unpicked && 'pick' in unpicked).toBe(false)
  })

  test('does not change the events it was given', () => {
    const original = event('a')

    attachPicks([original], picks)

    expect('pick' in original).toBe(false)
  })

  test('a pick without a note carries only its source', () => {
    const [picked] = attachPicks([event('gone')], picks)

    expect(picked?.pick).toEqual({ source })
  })
})

describe('unmatchedPicks', () => {
  test('lists picks whose event is not in the data', () => {
    expect(unmatchedPicks(picks, new Set(['a']))).toEqual([{ eventId: 'gone', sourceId: 'fri' }])
  })

  test('is empty when every pick matches', () => {
    expect(unmatchedPicks(picks, new Set(['a', 'gone']))).toEqual([])
  })
})
