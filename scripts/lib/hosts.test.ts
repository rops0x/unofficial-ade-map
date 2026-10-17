import { describe, expect, test } from 'vitest'
import { isAllowedUrl } from './hosts.ts'

describe('isAllowedUrl', () => {
  test.each([
    'https://www.amsterdam-dance-event.nl/api/program/filter/?section=events',
    'https://www.amsterdam-dance-event.nl/en/venues/melkweg/1/',
    'https://nominatim.openstreetmap.org/search?q=Dam',
  ])('allows %s', (url) => {
    expect(isAllowedUrl(url)).toBe(true)
  })

  test.each([
    'http://www.amsterdam-dance-event.nl/en/venues/melkweg/1/',
    'https://localhost/admin',
    'http://169.254.169.254/latest/meta-data/',
    'https://amsterdam-dance-event.nl.evil.example/',
    'not a url',
  ])('refuses %s', (url) => {
    expect(isAllowedUrl(url)).toBe(false)
  })
})
