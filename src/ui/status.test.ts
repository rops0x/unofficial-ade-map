import { describe, expect, test } from 'vitest'
import { describeStatus } from './status.ts'

const at = (iso: string): number => Date.parse(iso)
const range = { start: at('2026-10-21T10:00:00Z'), end: at('2026-10-26T04:00:00Z') }

describe('describeStatus', () => {
  test('counts what is on', () => {
    const status = describeStatus({ moment: at('2026-10-23T21:00:00Z'), now: at('2026-10-23T21:00:00Z'), range, onCount: 142, nextStart: null })

    expect(status).toEqual({ text: '142 events on', action: null })
  })

  test('uses the singular for one event', () => {
    const status = describeStatus({ moment: at('2026-10-23T21:00:00Z'), now: at('2026-10-23T21:00:00Z'), range, onCount: 1, nextStart: null })

    expect(status.text).toBe('1 event on')
  })

  test('before ADE, says when it starts', () => {
    const status = describeStatus({ moment: range.start, now: at('2026-10-17T10:00:00Z'), range, onCount: 3, nextStart: null })

    expect(status.text).toBe('ADE starts Wed 21 Oct, 12:00. Here’s what’s on first: 3 events.')
  })

  test('when nothing is on, offers to jump to the next start', () => {
    const status = describeStatus({
      moment: at('2026-10-22T05:30:00Z'),
      now: at('2026-10-22T05:30:00Z'),
      range,
      onCount: 0,
      nextStart: at('2026-10-22T06:00:00Z'),
    })

    expect(status).toEqual({ text: 'Nothing on at 07:30.', action: { label: 'Jump to 08:00', moment: at('2026-10-22T06:00:00Z') } })
  })

  test('names the day when the next event is on another day', () => {
    const status = describeStatus({
      moment: at('2026-10-22T05:30:00Z'),
      now: at('2026-10-22T05:30:00Z'),
      range,
      onCount: 0,
      nextStart: at('2026-10-23T16:00:00Z'),
    })

    expect(status.action?.label).toBe('Jump to Fri 23 Oct, 18:00')
  })

  test('when nothing is on and nothing follows, says so', () => {
    const status = describeStatus({ moment: at('2026-10-26T03:59:00Z'), now: at('2026-10-23T10:00:00Z'), range, onCount: 0, nextStart: null })

    expect(status).toEqual({ text: 'Nothing on at 04:59, and nothing later.', action: null })
  })

  test('after ADE, says goodbye', () => {
    const status = describeStatus({ moment: range.end, now: at('2026-10-27T10:00:00Z'), range, onCount: 0, nextStart: null })

    expect(status).toEqual({ text: 'ADE 2026 has ended.', action: null })
  })
})
