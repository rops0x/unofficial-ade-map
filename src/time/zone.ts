export const AMSTERDAM_TZ = 'Europe/Amsterdam'

export interface LocalDateTime {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone)
  if (cached) return cached
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
  formatters.set(timeZone, created)
  return created
}

/** Wall-clock date and time in `timeZone` at the given instant (epoch ms). */
export function localParts(instant: number, timeZone: string): LocalDateTime {
  const parts = formatterFor(timeZone).formatToParts(instant)
  const pick = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: pick('year'), month: pick('month'), day: pick('day'), hour: pick('hour'), minute: pick('minute') }
}

function asUtc(local: LocalDateTime): number {
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
}

function offsetAt(instant: number, timeZone: string): number {
  return asUtc(localParts(instant, timeZone)) - Math.floor(instant / 60_000) * 60_000
}

/**
 * Instant (epoch ms) for a wall-clock time in `timeZone`.
 * A repeated time (clocks going back) resolves to its first occurrence;
 * a skipped time (clocks going forward) is moved forward by the gap.
 */
export function zonedToInstant(local: LocalDateTime, timeZone: string): number {
  const wall = asUtc(local)
  const offsetBefore = offsetAt(wall - DAY_MS, timeZone)
  const offsetAfter = offsetAt(wall + DAY_MS, timeZone)
  const matches = [wall - offsetBefore, wall - offsetAfter]
    .filter((candidate) => asUtc(localParts(candidate, timeZone)) === wall)
    .sort((a, b) => a - b)
  return matches[0] ?? wall - offsetBefore
}
