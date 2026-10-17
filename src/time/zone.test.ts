import { describe, expect, test } from 'vitest'
import { localParts, zonedToInstant } from './zone.ts'

const AMS = 'Europe/Amsterdam'

describe('zonedToInstant', () => {
  test('converts summer time (CEST, UTC+2)', () => {
    const instant = zonedToInstant({ year: 2026, month: 10, day: 23, hour: 23, minute: 0 }, AMS)

    expect(new Date(instant).toISOString()).toBe('2026-10-23T21:00:00.000Z')
  })

  test('converts winter time (CET, UTC+1) after the clocks go back', () => {
    const instant = zonedToInstant({ year: 2026, month: 10, day: 25, hour: 18, minute: 0 }, AMS)

    expect(new Date(instant).toISOString()).toBe('2026-10-25T17:00:00.000Z')
  })

  test('picks the first occurrence of the repeated 02:00–03:00 hour on 25 Oct 2026', () => {
    const instant = zonedToInstant({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, AMS)

    expect(new Date(instant).toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })

  test('moves a time in the spring-forward gap one hour later', () => {
    const instant = zonedToInstant({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }, AMS)

    expect(new Date(instant).toISOString()).toBe('2026-03-29T01:30:00.000Z')
  })
})

describe('localParts', () => {
  test('reads wall-clock time in Amsterdam across the DST change', () => {
    expect(localParts(Date.parse('2026-10-25T00:30:00Z'), AMS)).toEqual({
      year: 2026, month: 10, day: 25, hour: 2, minute: 30,
    })
    expect(localParts(Date.parse('2026-10-25T01:30:00Z'), AMS)).toEqual({
      year: 2026, month: 10, day: 25, hour: 2, minute: 30,
    })
  })
})
