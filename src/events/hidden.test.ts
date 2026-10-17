import { describe, expect, test } from 'vitest'
import { isHiddenVenueName } from './hidden.ts'

describe('isHiddenVenueName', () => {
  test.each([
    'Secret Location',
    'secret location (Amsterdam Noord)',
    'TBA',
    'Location TBA',
    'Venue tbc',
    'To be announced',
    'Location announced on the day',
    'Location revealed after ticket purchase',
    'Undisclosed location',
    'Sec​ret Location',
    'S3cret spot',
    'T.B.A.',
    'Secrets',
    'Surprise location',
    'Mystery venue',
    'Location: DM us',
    'Geheime locatie',
    'Locatie volgt',
    'Locatie wordt bekendgemaakt',
    'To be confirmed',
    'Location to be revealed',
    'Hidden location',
    'Unknown location',
    'Private location',
    'Address upon request',
  ])('hides "%s"', (name) => {
    expect(isHiddenVenueName(name)).toBe(true)
  })

  test.each(['Melkweg', 'Coco’s Outback', 'Lotti’s Bar @ The Hoxton', 'De School', 'Secretariaat'])(
    'keeps public venue "%s"',
    (name) => {
      expect(isHiddenVenueName(name)).toBe(false)
    },
  )
})
