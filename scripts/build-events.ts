// Turns the collected ADE data into src/data/events.json, the file the map loads.
// Usage: npm run data:build
import { buildEventData } from './lib/build.ts'
import {
  log,
  PATHS,
  RawEventsFileSchema,
  readJson,
  VenueLocationsFileSchema,
  VenueOverridesFileSchema,
  writeJson,
} from './lib/store.ts'

async function main(): Promise<void> {
  const raw = await readJson(PATHS.rawEvents, RawEventsFileSchema)
  const locations = await readJson(PATHS.venueLocations, VenueLocationsFileSchema, {})
  const overrides = await readJson(PATHS.venueOverrides, VenueOverridesFileSchema, {})

  const { data, report } = buildEventData({ rawEvents: raw.events, locations, overrides, collectedAt: raw.collectedAt })
  if (data.events.length === 0) throw new Error('No events left after building; not writing an empty map.')

  await writeJson(PATHS.eventData, data)
  log(`Listings: ${report.listings}`)
  log(`Map events: ${report.events} at ${report.venues} venues`)
  log(`  end time estimated (+8 h): ${report.estimatedEnds}`)
  log(`  daily windows from multi-day listings: ${report.dailyWindows}`)
  log(`Skipped: ${JSON.stringify(report.skipped)}`)
  report.skippedExamples.forEach((example) => log(`  - ${example}`))
}

main().catch((error: unknown) => {
  process.stderr.write(`build-events failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
