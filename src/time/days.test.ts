import { describe, expect, test } from 'vitest'
import { festivalDay, festivalDayKey, festivalDays, momentAtStep, sameClockTimeOn, stepAt, stepCount } from './days.ts'

const at = (iso: string): number => Date.parse(iso)

describe('festivalDayKey', () => {
  test('an evening belongs to its own day', () => {
    expect(festivalDayKey(at('2026-10-23T21:00:00Z'))).toBe('2026-10-23') // Fri 23:00
  })

  test('01:00 belongs to the night before', () => {
    expect(festivalDayKey(at('2026-10-23T23:00:00Z'))).toBe('2026-10-23') // Sat 01:00
  })

  test('a new day starts at 06:00', () => {
    expect(festivalDayKey(at('2026-10-24T04:00:00Z'))).toBe('2026-10-24') // Sat 06:00
  })

  test('the repeated hour on 25 Oct still belongs to Saturday night', () => {
    expect(festivalDayKey(at('2026-10-25T01:30:00Z'))).toBe('2026-10-24') // second 02:30
  })
})

describe('festivalDay', () => {
  test('runs from 06:00 to 06:00 the next morning', () => {
    const day = festivalDay('2026-10-23')
    expect(day.start).toBe(at('2026-10-23T04:00:00Z'))
    expect(day.end).toBe(at('2026-10-24T04:00:00Z'))
    expect(day.label).toBe('Fri 23 Oct')
  })

  test('Saturday is 25 hours long because the clocks go back', () => {
    const day = festivalDay('2026-10-24')
    expect(day.end - day.start).toBe(25 * 60 * 60 * 1000)
  })
})

describe('festivalDays', () => {
  test('lists every day the festival touches', () => {
    const range = { start: at('2026-10-21T12:00:00Z'), end: at('2026-10-26T04:00:00Z') }
    expect(festivalDays(range).map((day) => day.key)).toEqual([
      '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
    ])
  })
})

describe('festivalDays when the first listing starts after midnight', () => {
  test('starts on that calendar day, not the night before', () => {
    const range = { start: at('2026-10-20T22:00:00Z'), end: at('2026-10-22T04:00:00Z') } // Wed 00:00
    expect(festivalDays(range).map((day) => day.key)).toEqual(['2026-10-21'])
  })
})

describe('sameClockTimeOn', () => {
  test('keeps 23:00 when moving to another day', () => {
    expect(sameClockTimeOn(festivalDay('2026-10-24'), at('2026-10-23T21:00:00Z'))).toBe(at('2026-10-24T21:00:00Z'))
  })

  test('keeps 04:00 across the clock change', () => {
    // Sun 25 Oct 04:00 CET -> Mon 26 Oct 04:00 CET
    expect(sameClockTimeOn(festivalDay('2026-10-25'), at('2026-10-25T03:00:00Z'))).toBe(at('2026-10-26T03:00:00Z'))
  })

  test('keeps 01:00 as the night after the chosen day', () => {
    expect(sameClockTimeOn(festivalDay('2026-10-22'), at('2026-10-23T23:00:00Z'))).toBe(at('2026-10-22T23:00:00Z'))
  })
})

describe('slider steps', () => {
  const friday = festivalDay('2026-10-23')

  test('a normal day has 48 half-hour steps', () => {
    expect(stepCount(friday)).toBe(48)
  })

  test('the long Saturday has 50 steps', () => {
    expect(stepCount(festivalDay('2026-10-24'))).toBe(50)
  })

  test('step and moment round-trip', () => {
    const moment = momentAtStep(friday, 34)
    expect(new Date(moment).toISOString()).toBe('2026-10-23T21:00:00.000Z') // 23:00
    expect(stepAt(friday, moment)).toBe(34)
  })

  test('a moment between steps snaps to the nearest step', () => {
    expect(stepAt(friday, at('2026-10-23T21:20:00Z'))).toBe(35)
  })

  test('moments outside the day are clamped', () => {
    expect(stepAt(friday, at('2026-10-20T00:00:00Z'))).toBe(0)
    expect(stepAt(friday, at('2026-10-30T00:00:00Z'))).toBe(47)
  })
})
