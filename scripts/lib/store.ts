import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import { FilterGroupsSchema } from '../../src/filters/schema.ts'
import { AdeEventSchema, AdeVenueSchema } from './ade.ts'

const ROOT = resolve(import.meta.dirname, '../..')

export const PATHS = {
  rawEvents: resolve(ROOT, 'data/raw/ade-events.json'),
  rawVenues: resolve(ROOT, 'data/raw/ade-venues.json'),
  rawFilters: resolve(ROOT, 'data/raw/ade-filters.json'),
  venueLocations: resolve(ROOT, 'data/venue-locations.json'),
  venueOverrides: resolve(ROOT, 'data/venue-overrides.json'),
  eventData: resolve(ROOT, 'src/data/events.json'),
  picks: resolve(ROOT, 'src/data/picks.json'),
} as const

export const RawEventsFileSchema = z.object({ collectedAt: z.iso.datetime(), events: z.array(AdeEventSchema) })
export const RawVenuesFileSchema = z.object({ collectedAt: z.iso.datetime(), venues: z.array(AdeVenueSchema) })
export const RawFiltersFileSchema = z.object({
  collectedAt: z.iso.datetime(),
  groups: FilterGroupsSchema,
  members: z.record(z.string(), z.array(z.number().int())),
})

export const VenueLocationsFileSchema = z.record(
  z.string(),
  z.object({
    adeId: z.number().int(),
    pageUrl: z.string(),
    address: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    status: z.enum(['located', 'no-address', 'not-found']),
    checkedAt: z.iso.datetime(),
  }),
)

export const VenueOverridesFileSchema = z.record(
  z.string(),
  z.union([
    z.object({ hidden: z.literal(true) }),
    z.object({ address: z.string().min(1), lat: z.number(), lng: z.number() }),
  ]),
)

export type VenueLocationsFile = z.infer<typeof VenueLocationsFileSchema>

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/** Reads and validates a JSON file. Returns `fallback` only when the file does not exist. */
export async function readJson<T>(path: string, schema: z.ZodType<T>, fallback?: T): Promise<T> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error: unknown) {
    if (isMissingFile(error) && fallback !== undefined) return fallback
    throw new Error(`Cannot read ${path}${isMissingFile(error) ? ' (missing — run the earlier data step first)' : ''}`)
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${path} is not valid JSON`)
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw new Error(`${path} is not in the expected format:\n${z.prettifyError(parsed.error)}`)
  return parsed.data
}

/** Writes JSON atomically so an interrupted run never leaves a half-written file. */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 1)}\n`, 'utf8')
  await rename(temporary, path)
}

export function log(line: string): void {
  process.stdout.write(`${line}\n`)
}
