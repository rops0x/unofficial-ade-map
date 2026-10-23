import { describe, expect, test } from 'vitest'
import { addressSearchUrl, addressVariants, listedStreetAndNumber, parseListedMatch } from './geocode.ts'

/** A Nominatim search answer (with addressdetails) for one place. */
const answer = (address: Record<string, string>, lat = '52.3678', lon = '4.884') => [{ lat, lon, address }]

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

  test('also tries the first number of a range, which OpenStreetMap usually lists on its own', () => {
    expect(addressVariants('Kerkstraat 136-138, Amsterdam')).toEqual(['Kerkstraat 136-138, Amsterdam', 'Kerkstraat 136, Amsterdam'])
  })
})

describe('addressSearchUrl', () => {
  test('asks for the matched street and house number, still within Amsterdam', () => {
    const url = new URL(addressSearchUrl('Dam 1, Amsterdam'))

    expect(url.searchParams.get('addressdetails')).toBe('1')
    expect(url.searchParams.get('q')).toBe('Dam 1, Amsterdam')
    expect(url.searchParams.get('bounded')).toBe('1')
  })
})

describe('listedStreetAndNumber', () => {
  test('reads street and number, with unit letters and suffixes ignored', () => {
    expect(listedStreetAndNumber('Keizersgracht 440, Amsterdam')).toEqual({ street: 'Keizersgracht', from: 440, to: 440 })
    expect(listedStreetAndNumber('Plantage Middenlaan 4 A, Amsterdam')).toEqual({ street: 'Plantage Middenlaan', from: 4, to: 4 })
    expect(listedStreetAndNumber('Europaboulevard 2b, Amsterdam')).toEqual({ street: 'Europaboulevard', from: 2, to: 2 })
  })

  test('reads a range of numbers, but not a number with a floor or unit after it', () => {
    expect(listedStreetAndNumber('Kerkstraat 136-138, Amsterdam')).toEqual({ street: 'Kerkstraat', from: 136, to: 138 })
    expect(listedStreetAndNumber('Rembrandtplein 17-1, Amsterdam')).toEqual({ street: 'Rembrandtplein', from: 17, to: 17 })
  })

  test('reads a postcode-style address without taking the postcode as the number', () => {
    expect(listedStreetAndNumber('Haarlemmerweg 8-10 1014 BE Amsterdam The Netherlands, Amsterdam')).toEqual({
      street: 'Haarlemmerweg',
      from: 8,
      to: 10,
    })
  })

  test('reads the number written first', () => {
    expect(listedStreetAndNumber('2 Linnaeusstraat, Amsterdam')).toEqual({ street: 'Linnaeusstraat', from: 2, to: 2 })
    expect(listedStreetAndNumber('72H De clercqstraat, Amsterdam')).toEqual({ street: 'De clercqstraat', from: 72, to: 72 })
  })

  test('reads the number from its own comma-separated part, either side of the street', () => {
    expect(listedStreetAndNumber('Rhoneweg, 6, Amsterdam')).toEqual({ street: 'Rhoneweg', from: 6, to: 6 })
    expect(listedStreetAndNumber('Camperstraat, 26 h, Amsterdam')).toEqual({ street: 'Camperstraat', from: 26, to: 26 })
    expect(listedStreetAndNumber('55, Danzigerkade, Minervahaven, Westpoort, Amsterdam')).toEqual({ street: 'Danzigerkade', from: 55, to: 55 })
    expect(listedStreetAndNumber('YUSU, 2, Andreas Bonnstraat, Oosterparkbuurt, Amsterdam')).toEqual({ street: 'Andreas Bonnstraat', from: 2, to: 2 })
  })

  test('finds the street next to a lone number when town, country or postcode follow', () => {
    expect(listedStreetAndNumber('Rhoneweg, 6, Amsterdam, Nederland')).toEqual({ street: 'Rhoneweg', from: 6, to: 6 })
    expect(listedStreetAndNumber('Camperstraat, 26 h, Amsterdam, Netherlands')).toEqual({ street: 'Camperstraat', from: 26, to: 26 })
    expect(listedStreetAndNumber('Rhoneweg, 6, 1014 AB, Amsterdam')).toEqual({ street: 'Rhoneweg', from: 6, to: 6 })
  })

  test('does not take a postcode for a house number', () => {
    expect(listedStreetAndNumber('Westerpark, 1013 AP Amsterdam')).toBeNull()
    expect(listedStreetAndNumber('Westerpark 1013 AP Amsterdam')).toBeNull()
  })

  test('reads ranges written with a dash or a slash', () => {
    expect(listedStreetAndNumber('Kerkstraat 136–138, Amsterdam')).toEqual({ street: 'Kerkstraat', from: 136, to: 138 })
    expect(listedStreetAndNumber('Laurierstraat 59/61, Amsterdam')).toEqual({ street: 'Laurierstraat', from: 59, to: 61 })
  })

  test('keeps an ordinal like "1e" as part of the street name', () => {
    expect(listedStreetAndNumber('1e Helmersstraat 20, Amsterdam')).toEqual({ street: '1e Helmersstraat', from: 20, to: 20 })
    expect(listedStreetAndNumber('1e Helmersstraat, Amsterdam')).toBeNull()
  })

  test('stays fast on a very long malformed address', () => {
    const started = performance.now()

    listedStreetAndNumber(`${'a'.repeat(4000)}${' '.repeat(4000)}x`)

    expect(performance.now() - started).toBeLessThan(100)
  })

  test('is null when no house number is listed', () => {
    expect(listedStreetAndNumber('Westerpark, Amsterdam')).toBeNull()
    expect(listedStreetAndNumber('Singel, Amsterdam')).toBeNull()
  })
})

describe('parseListedMatch', () => {
  test('accepts the listed street and number', () => {
    const body = answer({ house_number: '440A', road: 'Keizersgracht', city: 'Amsterdam' })

    expect(parseListedMatch(body, 'Keizersgracht 440, Amsterdam')).toEqual({ lat: 52.3678, lng: 4.884 })
  })

  test('rejects the same number on a street with a longer name', () => {
    const body = answer({ house_number: '440', road: 'Nieuwe Keizersgracht' })

    expect(parseListedMatch(body, 'Keizersgracht 440, Amsterdam')).toBeNull()
  })

  test('rejects the same number on another street', () => {
    const body = answer({ house_number: '22', road: 'Ina van Faassenhof' })

    expect(parseListedMatch(body, 'Asterweg 22, Amsterdam')).toBeNull()
  })

  test('rejects another number on the listed street', () => {
    const body = answer({ house_number: '94', road: 'Dapperstraat' })

    expect(parseListedMatch(body, 'Dapperstraat 1, Amsterdam, Nederland')).toBeNull()
  })

  test('rejects the street alone, which puts the pin somewhere along it', () => {
    const body = answer({ road: 'Amstel', suburb: 'Centrum' })

    expect(parseListedMatch(body, 'Amstel 1, Amsterdam')).toBeNull()
  })

  test('accepts any number in a listed range', () => {
    const body = answer({ house_number: '138', road: 'Kerkstraat' })

    expect(parseListedMatch(body, 'Kerkstraat 136-138, Amsterdam')).toEqual({ lat: 52.3678, lng: 4.884 })
  })

  test('ignores accents, case and prefixes like "tt." that are written either way', () => {
    expect(parseListedMatch(answer({ house_number: '6', road: 'Rhôneweg' }), 'Rhoneweg, 6, Amsterdam')).not.toBeNull()
    expect(parseListedMatch(answer({ house_number: '59', road: 'tt. Neveritaweg' }), 'Neveritaweg 59, Amsterdam')).not.toBeNull()
    expect(parseListedMatch(answer({ house_number: '1', road: 'Dr. Jan van Breemenstraat' }), 'Doctor Jan van Breemenstraat 1, Amsterdam')).not.toBeNull()
  })

  test('treats "Tweede" and "2e" in a street name as the same', () => {
    expect(parseListedMatch(answer({ house_number: '27', road: '2e Hugo de Grootstraat' }), 'Tweede Hugo de Grootstraat 27, Amsterdam')).not.toBeNull()
    expect(parseListedMatch(answer({ house_number: '11', road: 'Eerste Sweelinckstraat' }), '1e Sweelinckstraat 11H, Amsterdam')).not.toBeNull()
    expect(parseListedMatch(answer({ house_number: '27', road: '3e Hugo de Grootstraat' }), 'Tweede Hugo de Grootstraat 27, Amsterdam')).toBeNull()
  })

  test('accepts a square or pedestrian street as the street', () => {
    expect(parseListedMatch(answer({ house_number: '17', pedestrian: 'Rembrandtplein' }), 'Rembrandtplein 17, Amsterdam')).not.toBeNull()
  })

  test('accepts whatever was found when the listed address has no house number to check', () => {
    expect(parseListedMatch(answer({ park: 'Westerpark' }), 'Westerpark, Amsterdam')).toEqual({ lat: 52.3678, lng: 4.884 })
  })

  test('is null when nothing in Amsterdam matched', () => {
    expect(parseListedMatch([], 'Keizersgracht 440, Amsterdam')).toBeNull()
    expect(parseListedMatch(answer({ house_number: '440', road: 'Keizersgracht' }, '48.85', '2.35'), 'Keizersgracht 440, Amsterdam')).toBeNull()
  })
})
