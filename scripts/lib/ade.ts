import { z } from 'zod'
import { isHiddenVenueName } from '../../src/events/hidden.ts'
import { type LocalDateTime, zonedToInstant } from '../../src/time/zone.ts'
import { decodeEntities, safeDecodeUri } from './html.ts'

const HOUR_MS = 60 * 60 * 1000
/** Founder decision: an event without an end time is assumed to last at most 8 hours. */
export const ESTIMATED_DURATION_MS = 8 * HOUR_MS
/** Listings longer than this (pop-up stores, exhibitions) are split into one window per day. */
const MAX_SINGLE_WINDOW_MS = 24 * HOUR_MS
/** A guessed end (listed date was before the start) longer than this is not trusted; use the 8 h rule. */
const MAX_CORRECTED_SPAN_MS = 12 * HOUR_MS

const AdeDateSchema = z.object({ date: z.string(), timezone: z.string() })

export const AdeEventSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  start_date_time: AdeDateSchema,
  end_date_time: AdeDateSchema.nullable(),
  show_end_date_time: z.boolean(),
  url: z.string(),
  venue: z.object({ title: z.string() }).nullable(),
})

export const AdeVenueSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  url: z.string(),
})

export const AdeEventPageSchema = z.object({ data: z.array(AdeEventSchema) })
export const AdeVenuePageSchema = z.object({ data: z.array(AdeVenueSchema) })

export type AdeEvent = z.infer<typeof AdeEventSchema>
export type AdeVenue = z.infer<typeof AdeVenueSchema>
type AdeDate = z.infer<typeof AdeDateSchema>

export type NormalizeSkipReason = 'no-venue' | 'hidden-venue' | 'no-event-page' | 'invalid-time'

export interface Occurrence {
  readonly id: string
  readonly name: string
  readonly venueName: string
  readonly start: string
  readonly end: string
  readonly isEndEstimated: boolean
  readonly isDaily: boolean
  readonly sourceUrl: string
}

export type Normalized =
  | { readonly ok: true; readonly occurrences: readonly Occurrence[] }
  | { readonly ok: false; readonly reason: NormalizeSkipReason }

const ADE_DATE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/

function parseAdeDate(value: AdeDate): LocalDateTime | null {
  const match = ADE_DATE.exec(value.date)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number]
  return { year, month, day, hour, minute }
}

function toInstant(local: LocalDateTime, timeZone: string): number | null {
  try {
    return zonedToInstant(local, timeZone)
  } catch {
    return null // unknown time zone
  }
}

function isEventPageUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function wallClock(local: LocalDateTime): number {
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
}

function plusDays(local: LocalDateTime, days: number): LocalDateTime {
  return { ...local, day: local.day + days }
}

function dateKey(local: LocalDateTime): string {
  return new Date(Date.UTC(local.year, local.month - 1, local.day)).toISOString().slice(0, 10)
}

interface Window {
  readonly start: number
  readonly end: number
  readonly isEndEstimated: boolean
}

interface ResolvedEnd extends Window {
  /** The listed end date was used as-is, so a long span is a real multi-day listing. */
  readonly isAsListed: boolean
}

function resolveEnd(raw: AdeEvent, startLocal: LocalDateTime, start: number, timeZone: string): ResolvedEnd {
  const estimated = { start, end: start + ESTIMATED_DURATION_MS, isEndEstimated: true, isAsListed: false }
  const endLocal = raw.show_end_date_time && raw.end_date_time ? parseAdeDate(raw.end_date_time) : null
  if (!endLocal || !raw.end_date_time) return estimated
  const end = toInstant(endLocal, raw.end_date_time.timezone)
  if (end === null || end === start) return estimated
  if (end > start) return { start, end, isEndEstimated: false, isAsListed: true }
  // An end listed before the start has an unreliable date (often the start date for overnight
  // events, sometimes months off). Keep its time of day: later that day, or the next morning.
  const endTime = { hour: endLocal.hour, minute: endLocal.minute }
  const sameDay = toInstant({ ...startLocal, ...endTime }, timeZone)
  const nextMorning = toInstant({ ...nextDayOf(startLocal), ...endTime }, timeZone)
  const corrected = [sameDay, nextMorning].find((candidate) => candidate !== null && candidate > start)
  return corrected === undefined || corrected === null || corrected - start > MAX_CORRECTED_SPAN_MS
    ? estimated
    : { start, end: corrected, isEndEstimated: false, isAsListed: false }
}

function nextDayOf(local: LocalDateTime): Pick<LocalDateTime, 'year' | 'month' | 'day'> {
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

function dailyWindows(startLocal: LocalDateTime, endLocal: LocalDateTime, last: number, timeZone: string): readonly (Window & { key: string })[] {
  const startMinutes = startLocal.hour * 60 + startLocal.minute
  const endMinutes = endLocal.hour * 60 + endLocal.minute
  const endsNextDay = endMinutes <= startMinutes
  const dayCount = Math.round(
    (Date.UTC(endLocal.year, endLocal.month - 1, endLocal.day) - Date.UTC(startLocal.year, startLocal.month - 1, startLocal.day)) /
      (24 * HOUR_MS),
  )
  return Array.from({ length: dayCount + 1 }, (_, offset) => {
    const day = plusDays(startLocal, offset)
    const start = toInstant(day, timeZone)
    const end = toInstant({ ...plusDays(day, endsNextDay ? 1 : 0), hour: endLocal.hour, minute: endLocal.minute }, timeZone)
    return { key: dateKey(day), start: start ?? NaN, end: end ?? NaN, isEndEstimated: false }
  }).filter((window) => window.end <= last && window.end > window.start)
}

export function normalizeAdeEvent(raw: AdeEvent): Normalized {
  const venueName = decodeEntities(raw.venue?.title ?? '').trim()
  if (!venueName) return { ok: false, reason: 'no-venue' }
  if (isHiddenVenueName(venueName)) return { ok: false, reason: 'hidden-venue' }
  if (!isEventPageUrl(raw.url)) return { ok: false, reason: 'no-event-page' }

  const timeZone = raw.start_date_time.timezone
  const startLocal = parseAdeDate(raw.start_date_time)
  const start = startLocal ? toInstant(startLocal, timeZone) : null
  if (!startLocal || start === null) return { ok: false, reason: 'invalid-time' }

  const base = { name: decodeEntities(raw.title).trim(), venueName, sourceUrl: raw.url }
  const window = resolveEnd(raw, startLocal, start, timeZone)
  const endLocal = raw.end_date_time ? parseAdeDate(raw.end_date_time) : null

  // Compare wall-clock times: noon to noon across the clock change is 25 h but still one day.
  const wallClockSpan = endLocal ? wallClock(endLocal) - wallClock(startLocal) : 0
  if (window.isAsListed && endLocal && wallClockSpan > MAX_SINGLE_WINDOW_MS) {
    const windows = dailyWindows(startLocal, endLocal, window.end, timeZone)
    if (windows.length === 0) return { ok: false, reason: 'invalid-time' }
    return {
      ok: true,
      occurrences: windows.map((daily) => ({
        ...base,
        id: `ade-${raw.id}-${daily.key}`,
        start: new Date(daily.start).toISOString(),
        end: new Date(daily.end).toISOString(),
        isEndEstimated: false,
        isDaily: true,
      })),
    }
  }

  return {
    ok: true,
    occurrences: [
      {
        ...base,
        id: `ade-${raw.id}`,
        start: new Date(window.start).toISOString(),
        end: new Date(window.end).toISOString(),
        isEndEstimated: window.isEndEstimated,
        isDaily: false,
      },
    ],
  }
}

const MAP_LINK_QUERY = /google\.com\/maps\/search\/\?api=1&(?:amp;)?query=([^"'<>]+)["']/i

/** The venue page links its address to Google Maps; that link is the most reliable address source. */
export function extractVenueAddress(html: string): string | null {
  const match = MAP_LINK_QUERY.exec(html)
  if (!match?.[1]) return null
  const address = safeDecodeUri(decodeEntities(match[1])).trim()
  return address || null
}
