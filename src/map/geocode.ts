import { z } from 'zod'
import { AMSTERDAM_BOUNDS } from '../events/schema.ts'

export const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
// Longer than any real street address; stops a pasted paragraph going to the lookup service.
export const MAX_ADDRESS_LENGTH = 200
// Festival mobile data can stall; after this the visitor gets an error and can try again.
const LOOKUP_TIMEOUT_MS = 10_000

// Nominatim sends coordinates as strings. Empty or missing ones must not become 0,0.
const coordinate = z.string().trim().min(1).pipe(z.coerce.number())
const NominatimResultSchema = z.array(z.object({ lat: coordinate, lon: coordinate }))

export interface Coordinates {
  readonly lat: number
  readonly lng: number
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** Search URL bounded to the Amsterdam area, so a same-named street elsewhere can't match. */
export function nominatimSearchUrl(query: string): string {
  const { west, north, east, south } = AMSTERDAM_BOUNDS
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'nl',
    viewbox: `${west},${north},${east},${south}`,
    bounded: '1',
  })
  return `${NOMINATIM_SEARCH}?${params.toString()}`
}

const isInAmsterdam = ({ lat, lng }: Coordinates): boolean =>
  lat >= AMSTERDAM_BOUNDS.south && lat <= AMSTERDAM_BOUNDS.north && lng >= AMSTERDAM_BOUNDS.west && lng <= AMSTERDAM_BOUNDS.east

/** The first match, if it is in the Amsterdam area. `bounded` doesn't stop typed coordinates matching elsewhere. */
export function parseNominatimResult(body: unknown): Coordinates | null {
  const parsed = NominatimResultSchema.safeParse(body)
  const first = parsed.success ? parsed.data[0] : undefined
  if (!first) return null
  const found = { lat: first.lat, lng: first.lon }
  return isInAmsterdam(found) ? found : null
}

/**
 * Finds a typed address in the Amsterdam area. Null when nothing matches;
 * throws when the lookup service can't be reached or answers with an error.
 */
export async function findAddress(address: string, fetchFn: FetchLike = (url, init) => fetch(url, init)): Promise<Coordinates | null> {
  const query = address.trim().slice(0, MAX_ADDRESS_LENGTH)
  if (!query) return null
  const response = await fetchFn(nominatimSearchUrl(query), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Address lookup failed with HTTP ${response.status}`)
  return parseNominatimResult(await response.json())
}
