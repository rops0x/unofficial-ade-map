import { z } from 'zod'
import { AMSTERDAM_BOUNDS } from '../../src/events/schema.ts'

export const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'

const NominatimResultSchema = z.array(z.object({ lat: z.coerce.number(), lon: z.coerce.number() }))

export interface Coordinates {
  readonly lat: number
  readonly lng: number
}

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

/** The address as listed, then without notes like "(upstairs)" and unit letters like "12 A-K". */
export function addressVariants(address: string): readonly string[] {
  const cleaned = address
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(\d+)\s+[A-Z](?:\s*-\s*[A-Z])?\b/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned === address ? [address] : [address, cleaned]
}

export function parseNominatimResult(body: unknown): Coordinates | null {
  const parsed = NominatimResultSchema.safeParse(body)
  const first = parsed.success ? parsed.data[0] : undefined
  return first ? { lat: first.lat, lng: first.lon } : null
}
