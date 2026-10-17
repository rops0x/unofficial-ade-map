import { describe, expect, test } from 'vitest'
import { addressVariants } from './geocode.ts'

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
