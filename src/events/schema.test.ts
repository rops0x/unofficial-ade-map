import { describe, expect, test } from 'vitest'
import { FilterGroupsSchema } from '../filters/schema.ts'
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

  describe('filters', () => {
    const filters = [
      { id: 'genre', label: 'Genre', options: [{ id: '450', label: 'House', children: [{ id: '449', label: 'Deep House' }] }] },
      { id: 'type', label: 'Type', options: [{ id: '2592403', label: 'Warehouses' }] },
    ]

    test('accepts events tagged with known filter options, including genre styles', () => {
      const data = validData()
      const tagged = { ...data, filters, events: [{ ...data.events[0]!, tags: ['449', '450', '2592403'], isSoldOut: true }] }

      expect(EventDataSchema.safeParse(tagged).success).toBe(true)
    })

    test('rejects a tag that names no filter option', () => {
      const data = validData()
      const unknown = { ...data, filters, events: [{ ...data.events[0]!, tags: ['999'] }] }

      expect(EventDataSchema.safeParse(unknown).success).toBe(false)
    })

    test('rejects tags when the data has no filters', () => {
      const data = validData()
      const tagged = { ...data, events: [{ ...data.events[0]!, tags: ['450'] }] }

      expect(EventDataSchema.safeParse(tagged).success).toBe(false)
    })

    test('rejects a filter group without options', () => {
      const empty = { ...validData(), filters: [{ id: 'type', label: 'Type', options: [] }] }

      expect(EventDataSchema.safeParse(empty).success).toBe(false)
    })

    test('rejects an option id used twice, which would make a tag ambiguous', () => {
      const twice = { ...validData(), filters: [...filters, { id: 'program', label: 'Program', options: [{ id: '450', label: 'Festival' }] }] }

      expect(EventDataSchema.safeParse(twice).success).toBe(false)
    })

    test('rejects two groups with the same id, which would mix up what the visitor chose in each', () => {
      const twice = { ...validData(), filters: [...filters, { id: 'type', label: 'Type', options: [{ id: '1', label: 'Club nights' }] }] }

      expect(EventDataSchema.safeParse(twice).success).toBe(false)
    })

    test('the filter groups alone reject a repeated option id, so a bad scrape is caught before it is saved', () => {
      const style = { id: '449', label: 'Deep House' }
      const twice = [{ id: 'genre', label: 'Genre', options: [{ id: '450', label: 'House', children: [style] }, { id: '37', label: 'Techno', children: [style] }] }]

      expect(FilterGroupsSchema.safeParse(twice).success).toBe(false)
      expect(FilterGroupsSchema.safeParse(filters).success).toBe(true)
    })

    test('rejects an option id that is not one of ADE’s numeric category ids', () => {
      const listy = [{ id: 'type', label: 'Type', options: [{ id: '1,2', label: 'Club nights' }] }]

      expect(FilterGroupsSchema.safeParse(listy).success).toBe(false)
    })
  })
})
