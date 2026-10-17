import { describe, expect, test } from 'vitest'
import { formatMoment, formatTime } from './format.ts'

describe('formatTime', () => {
  test('shows 24-hour Amsterdam time', () => {
    expect(formatTime(Date.parse('2026-10-23T21:00:00Z'))).toBe('23:00')
  })

  test('shows winter time after the clocks go back', () => {
    expect(formatTime(Date.parse('2026-10-25T17:00:00Z'))).toBe('18:00')
  })
})

describe('formatMoment', () => {
  test('shows weekday, date and time', () => {
    expect(formatMoment(Date.parse('2026-10-23T21:00:00Z'))).toBe('Fri 23 Oct, 23:00')
  })
})
