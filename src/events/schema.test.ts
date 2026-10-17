import { describe, expect, test } from 'vitest'
import { EventDataSchema, type EventData } from './schema.ts'

function validData(): EventData {
  return {
    collectedAt: '2026-10-20T10:00:00.000Z',
    venues: [{ id: 'v1', name: 'Melkweg', address: 'Lijnbaansgracht 234A, Amsterdam', lat: 52.3647, lng: 4.8812 }],
    events: [
      {
        id: 'ade-1',
        name: 'Night One',
        venueId: 'v1',
        start: '2026-10-23T21:00:00.000Z',
        end: '2026-10-24T03:00:00.000Z',
        isEndEstimated: false,
        isDaily: false,
        sourceUrl: 'https://www.amsterdam-dance-event.nl/en/program/2026/night-one/1/',
      },
    ],
  }
}

describe('EventDataSchema', () => {
  test('accepts valid data', () => {
    // Arrange
    const data = validData()

    // Act
    const result = EventDataSchema.safeParse(data)

    // Assert
    expect(result.success).toBe(true)
  })

  test('rejects an event without a link to its event page', () => {
    const data = validData()
    const withoutLink = { ...data, events: [{ ...data.events[0]!, sourceUrl: '' }] }

    expect(EventDataSchema.safeParse(withoutLink).success).toBe(false)
  })

  test('rejects non-http links', () => {
    const data = validData()
    const scriptLink = { ...data, events: [{ ...data.events[0]!, sourceUrl: 'javascript:alert(1)' }] }

    expect(EventDataSchema.safeParse(scriptLink).success).toBe(false)
  })

  test('rejects an event that ends before it starts', () => {
    const data = validData()
    const backwards = { ...data, events: [{ ...data.events[0]!, end: '2026-10-23T20:00:00.000Z' }] }

    expect(EventDataSchema.safeParse(backwards).success).toBe(false)
  })

  test('rejects times without a zone offset', () => {
    const data = validData()
    const local = { ...data, events: [{ ...data.events[0]!, start: '2026-10-23T23:00:00' }] }

    expect(EventDataSchema.safeParse(local).success).toBe(false)
  })

  test('rejects an event whose venue is missing', () => {
    const data = validData()
    const orphan = { ...data, events: [{ ...data.events[0]!, venueId: 'nope' }] }

    expect(EventDataSchema.safeParse(orphan).success).toBe(false)
  })

  test('rejects a venue outside the Amsterdam area', () => {
    const data = validData()
    const faraway = { ...data, venues: [{ ...data.venues[0]!, lat: 48.85, lng: 2.35 }] }

    expect(EventDataSchema.safeParse(faraway).success).toBe(false)
  })

  test('rejects a hidden venue so underground events never reach the map', () => {
    const data = validData()
    const secret = { ...data, venues: [{ ...data.venues[0]!, name: 'Secret Location' }] }

    expect(EventDataSchema.safeParse(secret).success).toBe(false)
  })

  test('rejects a venue whose address hides the location', () => {
    const data = validData()
    const secret = { ...data, venues: [{ ...data.venues[0]!, address: 'Secret location, Amsterdam' }] }

    expect(EventDataSchema.safeParse(secret).success).toBe(false)
  })

  test('rejects two events with the same id', () => {
    const data = validData()
    const duplicated = { ...data, events: [data.events[0]!, data.events[0]!] }

    expect(EventDataSchema.safeParse(duplicated).success).toBe(false)
  })

  test('rejects blank names', () => {
    const data = validData()
    const blank = { ...data, events: [{ ...data.events[0]!, name: '   ' }] }

    expect(EventDataSchema.safeParse(blank).success).toBe(false)
  })
})
