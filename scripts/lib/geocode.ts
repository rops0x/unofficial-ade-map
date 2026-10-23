import { z } from 'zod'
import { type Coordinates, MAX_ADDRESS_LENGTH, nominatimSearchUrl, parseNominatimResult } from '../../src/map/geocode.ts'

/** The street and house number(s) a venue lists; `from` and `to` are equal unless it spans a range. */
export interface ListedAddress {
  readonly street: string
  readonly from: number
  readonly to: number
}

// "Kerkstraat 136-138", "Laurierstraat 59/61", "1e Helmersstraat 20": a street of at least three letters
// (after an optional ordinal), then the number.
const STREET_THEN_NUMBER = /^((?:\d+e\s+)?\D*[a-z]{3}\D*?)\s+(\d+)(?:\s*[-–/]\s*(\d+))?/i
// "2 Linnaeusstraat", "72H De clercqstraat"; not an ordinal like "1e Helmersstraat".
const NUMBER_THEN_STREET = /^(\d+)[a-df-z]?\s+(\D*[a-z]{3}\D*)$/i
// "Rhoneweg, 6" or "55, Danzigerkade": the number as its own comma-separated part.
const NUMBER_ONLY = /^(\d+)(?:\s*[a-z])?$/i
// Dutch postcodes ("1013 AP") are dropped first so they are never read as a house number.
const POSTCODE = /\b\d{4}\s?[A-Z]{2}\b/g
// Parts that come after the street, never instead of it.
const PLACE = /^(?:amsterdam|(?:the )?netherlands|nederland|noord-holland|north holland)$/i
// Where Nominatim puts the street name, depending on what kind of way it is.
const STREET_KEYS = ['road', 'pedestrian', 'square', 'footway', 'place'] as const
// Written with or without these in front: "tt. Neveritaweg", "Dr. Jan van Breemenstraat".
const OPTIONAL_PREFIXES: ReadonlySet<string> = new Set(['tt', 'ms', 'dr', 'doctor'])
// ADE writes "Tweede Hugo de Grootstraat" where OpenStreetMap has "2e Hugo de Grootstraat".
const ORDINALS: Readonly<Record<string, string>> = { eerste: '1e', tweede: '2e', derde: '3e', vierde: '4e', vijfde: '5e' }

const NominatimAddressSchema = z.array(z.object({ address: z.record(z.string(), z.string()) }))

/** The address as listed, then without notes like "(upstairs)", unit letters like "12 A-K" and the end of a range. */
export function addressVariants(address: string): readonly string[] {
  const cleaned = address
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(\d+)\s+[A-Z](?:\s*-\s*[A-Z])?\b/g, '$1')
    .replace(/\b(\d+)\s*[-–/]\s*\d+\b/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned === address ? [address] : [address, cleaned]
}

/** Nominatim search that also says which street and house number it matched. */
export const addressSearchUrl = (query: string): string => `${nominatimSearchUrl(query)}&addressdetails=1`

function listed(street: string, from: string, to?: string): ListedAddress {
  const first = Number(from)
  const last = to === undefined ? first : Number(to)
  // "Rembrandtplein 17-1" is unit 1 at number 17, not a range.
  return { street: street.trim(), from: first, to: last > first ? last : first }
}

/** The street and house number in a venue's address, however it is written. Null when it lists no number. */
export function listedStreetAndNumber(address: string): ListedAddress | null {
  // Capped like a typed address: real ones are far shorter, and the patterns slow down on very long text.
  const parts = address
    .slice(0, MAX_ADDRESS_LENGTH)
    .replace(/\([^)]*\)/g, '')
    .replace(POSTCODE, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  for (const [index, part] of parts.entries()) {
    const streetFirst = STREET_THEN_NUMBER.exec(part)
    if (streetFirst?.[1] && streetFirst[2]) return listed(streetFirst[1], streetFirst[2], streetFirst[3])
    const numberFirst = NUMBER_THEN_STREET.exec(part)
    if (numberFirst?.[1] && numberFirst[2]) return listed(numberFirst[2], numberFirst[1])
    // A lone number follows its street ("Rhoneweg, 6, Amsterdam") or comes first ("55, Danzigerkade, …").
    const next = parts[index + 1]
    const street = next && !PLACE.test(next) ? next : parts[index - 1]
    const numberOnly = NUMBER_ONLY.exec(part)
    if (numberOnly?.[1] && street) return listed(street, numberOnly[1])
  }
  return null
}

function streetKey(street: string): string {
  const words = street
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => ORDINALS[word] ?? word)
  return (OPTIONAL_PREFIXES.has(words[0] ?? '') ? words.slice(1) : words).join('')
}

function isListedAddress(address: ListedAddress, matched: Readonly<Record<string, string>>): boolean {
  const number = Number.parseInt(matched.house_number ?? '', 10)
  const streets = STREET_KEYS.flatMap((key) => (matched[key] ? [streetKey(matched[key])] : []))
  return number >= address.from && number <= address.to && streets.includes(streetKey(address.street))
}

/**
 * Where Nominatim's first match is, but only if it is the listed street and house number. Otherwise it can be
 * the same number on a namesake street ("Nieuwe Keizersgracht 440"), or just the street, somewhere along it.
 * An address without a house number can't be checked, so any match in Amsterdam is taken.
 */
export function parseListedMatch(body: unknown, address: string): Coordinates | null {
  const found = parseNominatimResult(body)
  const listedAddress = listedStreetAndNumber(address)
  if (!found || !listedAddress) return found
  const details = NominatimAddressSchema.safeParse(body)
  const matched = details.success ? details.data[0]?.address : undefined
  return matched && isListedAddress(listedAddress, matched) ? found : null
}
