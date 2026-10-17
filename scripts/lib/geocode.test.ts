import { describe, expect, test } from 'vitest'
import { addressVariants, nominatimSearchUrl, parseNominatimResult } from './geocode.ts'

describe('parseNominatimResult', () => {
  test('reads the first match', () => {
    const body = [{ lat: '52.3647', lon: '4.8812', display_name: 'Melkweg' }]

    expect(parseNominatimResult(body)).toEqual({ lat: 52.3647, lng: 4.8812 })
  })

  test('is null when nothing matched', () => {
    expect(parseNominatimResult([])).toBeNull()
  })

  test('is null for an unexpected response shape', () => {
    expect(parseNominatimResult({ error: 'rate limited' })).toBeNull()
  })
})

describe('addressVariants', () => {
  test('tries the address as listed first, then without notes and unit letters', () => {
    expect(addressVariants('Prinses Irenestraat 19 (upstairs), Amsterdam')).toEqual([
      'Prinses Irenestraat 19 (upstairs), Amsterdam',
      'Prinses Irenestraat 19, Amsterdam',
    ])
    expect(addressVariants('Dr. J.A. Ringersstraat 12 A-K, Amsterdam')).toEqual([
      'Dr. J.A. Ringersstraat 12 A-K, Amsterdam',
      'Dr. J.A. Ringersstraat 12, Amsterdam',
    ])
  })

  test('drops the building note in a corridor-style address', () => {
    expect(addressVariants('Corridor 15 (THV P6), Amsterdam')).toEqual(['Corridor 15 (THV P6), Amsterdam', 'Corridor 15, Amsterdam'])
  })

  test('returns a clean address once', () => {
    expect(addressVariants('Dam 1, Amsterdam')).toEqual(['Dam 1, Amsterdam'])
  })
})

describe('nominatimSearchUrl', () => {
  test('restricts the search to the Amsterdam area', () => {
    const url = new URL(nominatimSearchUrl('Dam 1, Amsterdam'))

    expect(url.searchParams.get('q')).toBe('Dam 1, Amsterdam')
    expect(url.searchParams.get('bounded')).toBe('1')
    expect(url.searchParams.get('viewbox')).toBe('4.7,52.5,5.1,52.25')
  })
})
