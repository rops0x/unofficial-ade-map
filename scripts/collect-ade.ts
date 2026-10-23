// Collects every ADE festival event and venue from the public program API.
// Safe to run repeatedly during the festival; each run replaces the raw files.
// Usage: npm run data:collect [-- --force]
import type { z } from 'zod'
import { type FilterGroup, FilterGroupsSchema } from '../src/filters/schema.ts'
import { AdeEventPageSchema, AdeVenuePageSchema } from './lib/ade.ts'
import { listedOptions, parseAdeFilters } from './lib/filters.ts'
import { politeGet, politeGetJson } from './lib/http.ts'
import { log, PATHS, RawEventsFileSchema, RawFiltersFileSchema, readJson, writeJson } from './lib/store.ts'

const ADE_FILTER_API = 'https://www.amsterdam-dance-event.nl/api/program/filter/'
// The festival program as shown on amsterdam-dance-event.nl/en/program (day and night events).
const FESTIVAL = { type: '8262,8263', from: '2026-10-21', to: '2026-10-25' } as const
// The same program's filter panel, read for its Program, Genre and Type options.
const ADE_FILTER_PAGE = `https://www.amsterdam-dance-event.nl/en/program/filter/?${new URLSearchParams({ section: 'events', ...FESTIVAL }).toString()}`
const MAX_PAGES = 200
/** Refuse to replace the data if a run returns far fewer events than the last one (API change, outage). */
const MIN_SHARE_OF_PREVIOUS = 0.5

async function collectPages<T>(
  section: 'events' | 'venues',
  schema: z.ZodType<{ data: T[] }>,
  extra: Readonly<Record<string, string>> = {},
): Promise<T[]> {
  const pages: T[][] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ section, ...FESTIVAL, ...extra, page: String(page) })
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

/** The ADE event ids listed under each Program option, which the event listing itself doesn't name. */
async function collectMembers(groups: readonly FilterGroup[]): Promise<Record<string, number[]>> {
  const members: [string, number[]][] = []
  // One option at a time on purpose, like collectPages: the polite throttle spaces out sequential requests.
  for (const option of listedOptions(groups)) {
    const events = uniqueById(await collectPages('events', AdeEventPageSchema, { category: option.id }))
    members.push([option.id, events.map((event) => event.id)])
    log(`  ${option.label}: ${events.length} events`)
  }
  return Object.fromEntries(members)
}

/** Filters are a nice-to-have: if ADE's page changed, keep the last filters rather than block fresh events. */
async function collectFilters(collectedAt: string): Promise<void> {
  try {
    log('Collecting ADE filters…')
    // Checked before the crawl, which sends option ids back to ADE, and again before saving.
    const groups = FilterGroupsSchema.parse(parseAdeFilters(await politeGet(ADE_FILTER_PAGE)))
    const members = await collectMembers(groups)
    await writeJson(PATHS.rawFilters, RawFiltersFileSchema.parse({ collectedAt, groups, members }))
    log(`Collected ${groups.length} filter groups: ${groups.map((group) => `${group.label} (${group.options.length})`).join(', ')}.`)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`warning: filters not updated, keeping the previous ones: ${message}\n`)
  }
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
  await collectFilters(collectedAt)
}

main().catch((error: unknown) => {
  process.stderr.write(`collect-ade failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
