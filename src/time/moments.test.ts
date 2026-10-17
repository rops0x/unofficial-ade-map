import { describe, expect, test } from 'vitest'
import { eventsAt, festivalRange, initialView, nextStartAfter } from './moments.ts'

const at = (iso: string): number => Date.parse(iso)

const events = [
  { id: 'early', startMs: at('2026-10-21T12:00:00Z'), endMs: at('2026-10-21T20:00:00Z') },
  { id: 'night', startMs: at('2026-10-23T21:00:00Z'), endMs: at('2026-10-24T03:00:00Z') },
  { id: 'last', startMs: at('2026-10-25T17:00:00Z'), endMs: at('2026-10-26T00:30:00Z') },
]

describe('festivalRange', () => {
  test('spans from the first start to the last end', () => {
    expect(festivalRange(events)).toEqual({ start: at('2026-10-21T12:00:00Z'), end: at('2026-10-26T00:30:00Z') })
  })

  test('is null when there are no events', () => {
    expect(festivalRange([])).toBeNull()
  })
})

describe('initialView', () => {
  const range = { start: at('2026-10-21T12:00:00Z'), end: at('2026-10-26T00:30:00Z') }

  test('before ADE starts, opens on the first event', () => {
    expect(initialView(at('2026-10-17T10:00:00Z'), range)).toEqual({ kind: 'preview', moment: range.start })
  })

  test('during ADE, opens on now', () => {
    const now = at('2026-10-23T22:15:00Z')
    expect(initialView(now, range)).toEqual({ kind: 'live', moment: now })
  })

  test('at the very first start, is live', () => {
    expect(initialView(range.start, range).kind).toBe('live')
  })

  test('once the last event has ended, says goodbye', () => {
    expect(initialView(range.end, range)).toEqual({ kind: 'ended', moment: range.end })
  })
})

describe('eventsAt', () => {
  test('includes events that have started and not yet ended', () => {
    expect(eventsAt(at('2026-10-24T01:00:00Z'), events).map((event) => event.id)).toEqual(['night'])
  })

  test('includes an event at its exact start', () => {
    expect(eventsAt(at('2026-10-23T21:00:00Z'), events).map((event) => event.id)).toEqual(['night'])
  })

  test('excludes an event at its exact end', () => {
    expect(eventsAt(at('2026-10-24T03:00:00Z'), events)).toEqual([])
  })

  test('does not change the input', () => {
    const input = Object.freeze([...events])
    expect(() => eventsAt(at('2026-10-24T01:00:00Z'), input)).not.toThrow()
  })
})

describe('nextStartAfter', () => {
  test('finds the next event to start', () => {
    expect(nextStartAfter(at('2026-10-22T10:00:00Z'), events)).toBe(at('2026-10-23T21:00:00Z'))
  })

  test('is null after the last start', () => {
    expect(nextStartAfter(at('2026-10-25T18:00:00Z'), events)).toBeNull()
  })
})
