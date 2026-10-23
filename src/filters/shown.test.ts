import { describe, expect, test } from 'vitest'
import { EMPTY_SELECTION, toggleOption } from './filters.ts'
import { shownEvents, shownNoun } from './shown.ts'

interface TestEvent {
  readonly id: string
  readonly tags?: readonly string[]
  readonly isSoldOut?: boolean
  readonly pick?: { readonly note: string }
}

const events: readonly TestEvent[] = [
  { id: 'techno-pick', tags: ['37'], isSoldOut: false, pick: { note: 'Go' } },
  { id: 'house-sold-out', tags: ['450'], isSoldOut: true },
  { id: 'untagged' },
]

const techno = toggleOption(EMPTY_SELECTION, 'genre', '37')
const ids = (shown: readonly { readonly id: string }[]): readonly string[] => shown.map((event) => event.id)

describe('shownEvents', () => {
  test('with nothing chosen, shows every event', () => {
    expect(ids(shownEvents(events, { isPicksOnly: false, selection: EMPTY_SELECTION }))).toEqual(['techno-pick', 'house-sold-out', 'untagged'])
  })

  test('with filters on, shows only the events that match them', () => {
    expect(ids(shownEvents(events, { isPicksOnly: false, selection: techno }))).toEqual(['techno-pick'])
    expect(ids(shownEvents(events, { isPicksOnly: false, selection: { ...EMPTY_SELECTION, isHidingSoldOut: true } }))).toEqual([
      'techno-pick',
      'untagged',
    ])
  })

  test('"Picks only" and the filters both apply', () => {
    const house = toggleOption(EMPTY_SELECTION, 'genre', '450')

    expect(ids(shownEvents(events, { isPicksOnly: true, selection: EMPTY_SELECTION }))).toEqual(['techno-pick'])
    expect(ids(shownEvents(events, { isPicksOnly: true, selection: house }))).toEqual([])
  })
})

describe('shownNoun', () => {
  test('names what the status counts: events, picks, or the ones that match the filters', () => {
    expect(shownNoun({ isPicksOnly: false, selection: EMPTY_SELECTION })).toBe('event')
    expect(shownNoun({ isPicksOnly: true, selection: EMPTY_SELECTION })).toBe('pick')
    expect(shownNoun({ isPicksOnly: false, selection: techno })).toBe('matching event')
    expect(shownNoun({ isPicksOnly: true, selection: techno })).toBe('matching pick')
  })

  test('a group whose options were all toggled off again counts as no filter', () => {
    expect(shownNoun({ isPicksOnly: false, selection: toggleOption(techno, 'genre', '37') })).toBe('event')
  })
})
