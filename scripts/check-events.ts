// Runs before every site build: refuses to ship src/data/events.json unless it passes
// the schema (event-page links, public venues only, valid times).
import { EventDataSchema } from '../src/events/schema.ts'
import { log, PATHS, readJson } from './lib/store.ts'

readJson(PATHS.eventData, EventDataSchema)
  .then((data) => log(`events.json OK: ${data.events.length} events at ${data.venues.length} venues.`))
  .catch((error: unknown) => {
    process.stderr.write(`check-events failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
