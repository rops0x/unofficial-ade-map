// Finds coordinates for every venue that has events, once per venue.
// Reads the address from the ADE venue page, then geocodes it with Nominatim.
// Results are cached in data/venue-locations.json; only new venues are looked up.
// Usage: npm run data:venues [-- --retry]   (--retry looks up venues that failed before)
import { isHiddenVenueName } from '../src/events/hidden.ts'
import { extractVenueAddress } from './lib/ade.ts'
import { addressVariants, type Coordinates, nominatimSearchUrl, parseNominatimResult } from './lib/geocode.ts'
import { isAllowedUrl } from './lib/hosts.ts'
import { decodeEntities } from './lib/html.ts'
import { politeGet, politeGetJson } from './lib/http.ts'
import {
  log,
  PATHS,
  RawEventsFileSchema,
  RawVenuesFileSchema,
  readJson,
  type VenueLocationsFile,
  VenueLocationsFileSchema,
  VenueOverridesFileSchema,
  writeJson,
} from './lib/store.ts'

const venueName = (title: string): string => decodeEntities(title).trim()

async function geocode(address: string, name: string): Promise<Coordinates | null> {
  for (const query of [...addressVariants(address), `${name}, Amsterdam`]) {
    const found = parseNominatimResult(await politeGetJson(nominatimSearchUrl(query)))
    if (found) return found
  }
  return null
}

async function locate(name: string, adeId: number, pageUrl: string): Promise<VenueLocationsFile[string]> {
  const checkedAt = new Date().toISOString()
  const address = extractVenueAddress(await politeGet(pageUrl))
  if (!address) return { adeId, pageUrl, address: null, lat: null, lng: null, status: 'no-address', checkedAt }
  const coordinates = await geocode(address, name)
  return coordinates
    ? { adeId, pageUrl, address, ...coordinates, status: 'located', checkedAt }
    : { adeId, pageUrl, address, lat: null, lng: null, status: 'not-found', checkedAt }
}

async function main(): Promise<void> {
  const shouldRetry = process.argv.includes('--retry')
  const { events } = await readJson(PATHS.rawEvents, RawEventsFileSchema)
  const { venues } = await readJson(PATHS.rawVenues, RawVenuesFileSchema)
  const cache = await readJson(PATHS.venueLocations, VenueLocationsFileSchema, {})
  const overrides = await readJson(PATHS.venueOverrides, VenueOverridesFileSchema, {})

  const listed = new Map(venues.map((venue) => [venueName(venue.title), venue]))
  const needed = [...new Set(events.map((event) => venueName(event.venue?.title ?? '')))]
    .filter((name) => name && !isHiddenVenueName(name) && !Object.hasOwn(overrides, name))
  const cached = (name: string) => (Object.hasOwn(cache, name) ? cache[name] : undefined)
  const todo = needed.filter((name) => !cached(name) || (shouldRetry && cached(name)?.status !== 'located'))
  log(`${needed.length} venues with events, ${todo.length} to look up.`)

  let current = cache
  for (const [index, name] of todo.entries()) {
    const listing = listed.get(name)
    if (!listing || !isAllowedUrl(listing.url)) {
      log(`  [${index + 1}/${todo.length}] ${name}: no usable ADE venue page, skipped`)
      continue
    }
    let location: VenueLocationsFile[string]
    try {
      location = await locate(name, listing.id, listing.url)
    } catch (error: unknown) {
      // One broken venue page must not stop the rest; it is retried on the next run.
      log(`  [${index + 1}/${todo.length}] ${name}: lookup failed (${error instanceof Error ? error.message : String(error)})`)
      continue
    }
    current = { ...current, [name]: location }
    await writeJson(PATHS.venueLocations, current) // save as we go so an interrupted run keeps its progress
    log(`  [${index + 1}/${todo.length}] ${name}: ${location.status}${location.address ? ` (${location.address})` : ''}`)
  }

  const located = needed.filter((name) => Object.hasOwn(current, name) && current[name]?.status === 'located').length
  log(`Located ${located} of ${needed.length} venues. Fix the rest by hand in data/venue-overrides.json.`)
}

main().catch((error: unknown) => {
  process.stderr.write(`locate-venues failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
