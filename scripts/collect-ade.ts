// Collects every ADE festival event and venue from the public program API.
// Safe to run repeatedly during the festival; each run replaces the raw files.
// Usage: npm run data:collect [-- --force]
import type { z } from 'zod'
import { AdeEventPageSchema, AdeVenuePageSchema } from './lib/ade.ts'
import { politeGetJson } from './lib/http.ts'
import { log, PATHS, RawEventsFileSchema, readJson, writeJson } from './lib/store.ts'

const ADE_FILTER_API = 'https://www.amsterdam-dance-event.nl/api/program/filter/'
// The festival program as shown on amsterdam-dance-event.nl/en/program (day and night events).
const FESTIVAL = { type: '8262,8263', from: '2026-10-21', to: '2026-10-25' } as const
const MAX_PAGES = 200
/** Refuse to replace the data if a run returns far fewer events than the last one (API change, outage). */
const MIN_SHARE_OF_PREVIOUS = 0.5

async function collectPages<T>(section: 'events' | 'venues', schema: z.ZodType<{ data: T[] }>): Promise<T[]> {
  const pages: T[][] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ section, ...FESTIVAL, page: String(page) })
    const body = await politeGetJson(`${ADE_FILTER_API}?${params.toString()}`, { 'Content-Type': 'application/json' })
    const parsed = schema.safeParse(body)
    if (!parsed.success) throw new Error(`ADE ${section} page ${page} has an unexpected format — the API may have changed.`)
    if (parsed.data.data.length === 0) return pages.flat()
    pages.push(parsed.data.data)
    log(`  ${section}: page ${page}, ${pages.flat().length} so far`)
  }
  throw new Error(`ADE ${section}: more than ${MAX_PAGES} pages, stopping to be safe.`)
}

/** Pages can overlap if the listing changes mid-collection; keep one copy of each. */
function uniqueById<T extends { id: number }>(items: readonly T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

async function previousEventCount(): Promise<number> {
  const previous = await readJson(PATHS.rawEvents, RawEventsFileSchema, { collectedAt: new Date(0).toISOString(), events: [] })
  return previous.events.length
}

async function main(): Promise<void> {
  const isForced = process.argv.includes('--force')
  const collectedAt = new Date().toISOString()
  log('Collecting ADE events…')
  const events = uniqueById(await collectPages('events', AdeEventPageSchema))
  log('Collecting ADE venues…')
  const venues = uniqueById(await collectPages('venues', AdeVenuePageSchema))

  const previous = await previousEventCount()
  if (events.length === 0 || (!isForced && events.length < previous * MIN_SHARE_OF_PREVIOUS)) {
    throw new Error(`Got ${events.length} events (last run: ${previous}). Not replacing data; check the site, or re-run with --force.`)
  }

  await writeJson(PATHS.rawEvents, { collectedAt, events })
  await writeJson(PATHS.rawVenues, { collectedAt, venues })
  log(`Collected ${events.length} events and ${venues.length} venues (previous run: ${previous} events).`)
}

main().catch((error: unknown) => {
  process.stderr.write(`collect-ade failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
