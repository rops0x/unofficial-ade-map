// Turns the collected ADE data into src/data/events.json, the file the map loads.
// Usage: npm run data:build
import { buildEventData } from './lib/build.ts'
import type { FilterSource } from './lib/filters.ts'
import {
  log,
  PATHS,
  RawEventsFileSchema,
  RawFiltersFileSchema,
  readJson,
  VenueLocationsFileSchema,
  VenueOverridesFileSchema,
  writeJson,
} from './lib/store.ts'

const warn = (message: string): void => {
  process.stderr.write(`warning: ${message}\n`)
}

/** Filters are a nice-to-have: an unreadable filters file only warns, so fresh events still ship. */
async function readFilters(eventsCollectedAt: string): Promise<FilterSource | null> {
  try {
    const filters = await readJson(PATHS.rawFilters, RawFiltersFileSchema.nullable(), null)
    if (filters && filters.collectedAt !== eventsCollectedAt) {
      warn(`filters are from ${filters.collectedAt}, events from ${eventsCollectedAt}; newer events have no Program until data:collect succeeds.`)
    }
    return filters
  } catch (error: unknown) {
    warn(`building without filters: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

async function main(): Promise<void> {
  const raw = await readJson(PATHS.rawEvents, RawEventsFileSchema)
  const locations = await readJson(PATHS.venueLocations, VenueLocationsFileSchema, {})
  const overrides = await readJson(PATHS.venueOverrides, VenueOverridesFileSchema, {})
  const filters = await readFilters(raw.collectedAt)

  const { data, report } = buildEventData({
    rawEvents: raw.events,
    locations,
    overrides,
    collectedAt: raw.collectedAt,
    ...(filters ? { filters } : {}),
  })
  if (data.events.length === 0) throw new Error('No events left after building; not writing an empty map.')

  await writeJson(PATHS.eventData, data)
  log(`Listings: ${report.listings}`)
  log(`Map events: ${report.events} at ${report.venues} venues`)
  log(`  end time estimated (+8 h): ${report.estimatedEnds}`)
  log(`  daily windows from multi-day listings: ${report.dailyWindows}`)
  log(filters ? `  matching at least one filter: ${report.taggedEvents}` : '  no filters collected yet (run data:collect)')
  log(`Skipped: ${JSON.stringify(report.skipped)}`)
  report.skippedExamples.forEach((example) => log(`  - ${example}`))
}

main().catch((error: unknown) => {
  process.stderr.write(`build-events failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
