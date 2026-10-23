// Runs before every site build: refuses to ship src/data/events.json unless it passes
// the schema (event-page links, public venues only, valid times), or src/data/picks.json
// unless every pick credits a known source.
// A pick whose event has dropped out of the data only warns: re-collecting ADE mid-festival
// must never block a deploy, and the map simply doesn't show that pick.
import { EventDataSchema } from '../src/events/schema.ts'
import { unmatchedPicks } from '../src/picks/picks.ts'
import { PicksDataSchema } from '../src/picks/schema.ts'
import { log, PATHS, readJson } from './lib/store.ts'

Promise.all([readJson(PATHS.eventData, EventDataSchema), readJson(PATHS.picks, PicksDataSchema)])
  .then(([data, picks]) => {
    log(`events.json OK: ${data.events.length} events at ${data.venues.length} venues.`)
    const unmatched = unmatchedPicks(picks, new Set(data.events.map((event) => event.id)))
    log(`picks.json OK: ${picks.picks.length - unmatched.length} of ${picks.picks.length} picks are on the map.`)
    unmatched.forEach((pick) =>
      process.stderr.write(`warning: pick ${pick.eventId} (${pick.sourceId}) matches no event in events.json, so the map skips it.\n`),
    )
  })
  .catch((error: unknown) => {
    process.stderr.write(`check-events failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
