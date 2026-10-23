import { describe, expect, test } from 'vitest'
import { activeFilterCount, EMPTY_SELECTION, isOptionChosen, matchesFilters, toggleOption } from './filters.ts'

const techno = { tags: ['37', '2528651'], isSoldOut: false }
const houseSoldOut = { tags: ['450', '2592403'], isSoldOut: true }
const untagged = {}

describe('toggleOption', () => {
  test('chooses an option, and a second toggle removes it again', () => {
    const chosen = toggleOption(EMPTY_SELECTION, 'genre', '37')

    expect(isOptionChosen(chosen, 'genre', '37')).toBe(true)
    expect(isOptionChosen(toggleOption(chosen, 'genre', '37'), 'genre', '37')).toBe(false)
  })

  test('returns a new selection and leaves the old one as it was', () => {
    const before = toggleOption(EMPTY_SELECTION, 'genre', '37')

    toggleOption(before, 'genre', '450')

    expect(before.chosen).toEqual({ genre: ['37'] })
  })
})

describe('activeFilterCount', () => {
  test('counts chosen options plus the sold-out switch', () => {
    const selection = { ...toggleOption(toggleOption(EMPTY_SELECTION, 'genre', '37'), 'type', '2528651'), isHidingSoldOut: true }

    expect(activeFilterCount(selection)).toBe(3)
    expect(activeFilterCount(EMPTY_SELECTION)).toBe(0)
  })
})

describe('matchesFilters', () => {
  test('with nothing chosen, every event matches', () => {
    expect([techno, houseSoldOut, untagged].every((event) => matchesFilters(event, EMPTY_SELECTION))).toBe(true)
  })

  test('within a group, any chosen option matches', () => {
    const selection = toggleOption(toggleOption(EMPTY_SELECTION, 'genre', '37'), 'genre', '450')

    expect(matchesFilters(techno, selection)).toBe(true)
    expect(matchesFilters(houseSoldOut, selection)).toBe(true)
    expect(matchesFilters(untagged, selection)).toBe(false)
  })

  test('across groups, every group must match', () => {
    const selection = toggleOption(toggleOption(EMPTY_SELECTION, 'genre', '37'), 'type', '2592403')

    expect(matchesFilters(techno, selection)).toBe(false)
  })

  test('hiding sold-out events keeps events without a sold-out flag', () => {
    const selection = { ...EMPTY_SELECTION, isHidingSoldOut: true }

    expect(matchesFilters(houseSoldOut, selection)).toBe(false)
    expect(matchesFilters(techno, selection)).toBe(true)
    expect(matchesFilters(untagged, selection)).toBe(true)
  })
})
