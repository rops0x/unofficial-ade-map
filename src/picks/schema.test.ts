import { describe, expect, test } from 'vitest'
import bundled from '../data/picks.json'
import { PICK_NOTE_MAX_LENGTH, type PicksData, PicksDataSchema } from './schema.ts'

const source = { id: 'fri', name: 'r/amsterdam_rave', title: 'Friday preview', url: 'https://www.reddit.com/r/amsterdam_rave/comments/1/' }

function data(overrides: Partial<PicksData> = {}): PicksData {
  return { sources: [source], picks: [{ eventId: 'e1', sourceId: 'fri', note: 'Ambient in a church.' }], ...overrides }
}

describe('PicksDataSchema', () => {
  test('accepts picks that credit a known source', () => {
    expect(PicksDataSchema.safeParse(data()).success).toBe(true)
  })

  test('accepts a pick without a note', () => {
    expect(PicksDataSchema.safeParse(data({ picks: [{ eventId: 'e1', sourceId: 'fri' }] })).success).toBe(true)
  })

  test('rejects a pick that credits no known source', () => {
    const result = PicksDataSchema.safeParse(data({ picks: [{ eventId: 'e1', sourceId: 'sat' }] }))

    expect(result.error?.issues[0]?.message).toBe('unknown source sat')
  })

  test('rejects the same event picked twice', () => {
    const result = PicksDataSchema.safeParse(data({ picks: [{ eventId: 'e1', sourceId: 'fri' }, { eventId: 'e1', sourceId: 'fri' }] }))

    expect(result.error?.issues[0]?.message).toBe('event e1 is picked twice')
  })

  test('rejects two sources with the same id', () => {
    const result = PicksDataSchema.safeParse(data({ sources: [source, source] }))

    expect(result.error?.issues[0]?.message).toBe('duplicate source id fri')
  })

  test('rejects a source link that is not a web page', () => {
    expect(PicksDataSchema.safeParse(data({ sources: [{ ...source, url: 'javascript:alert(1)' }] })).success).toBe(false)
  })

  test('rejects a note too long for a popup', () => {
    const note = 'x'.repeat(PICK_NOTE_MAX_LENGTH + 1)

    expect(PicksDataSchema.safeParse(data({ picks: [{ eventId: 'e1', sourceId: 'fri', note }] })).success).toBe(false)
  })
})

describe('bundled picks.json', () => {
  test('passes the schema, so the site never ships broken picks', () => {
    expect(PicksDataSchema.safeParse(bundled).success).toBe(true)
  })
})
