import { formatDayLabel } from './format.ts'
import type { FestivalRange } from './moments.ts'
import { AMSTERDAM_TZ, localParts, zonedToInstant } from './zone.ts'

/** Festival days run 06:00 to 06:00, so a 01:00 set belongs to the night before. */
export const DAY_START_HOUR = 6
export const SLIDER_STEP_MS = 30 * 60 * 1000
const MIDDAY_HOUR = 12

export interface FestivalDay {
  readonly key: string
  readonly label: string
  readonly start: number
  readonly end: number
}

function parseKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number)
  return { year: year ?? NaN, month: month ?? NaN, day: day ?? NaN }
}

function shiftKey(key: string, days: number): string {
  const { year, month, day } = parseKey(key)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function instantOn(key: string, hour: number): number {
  return zonedToInstant({ ...parseKey(key), hour, minute: 0 }, AMSTERDAM_TZ)
}

export function festivalDayKey(instant: number): string {
  const { year, month, day, hour } = localParts(instant, AMSTERDAM_TZ)
  const calendarKey = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
  return hour < DAY_START_HOUR ? shiftKey(calendarKey, -1) : calendarKey
}

export function festivalDay(key: string): FestivalDay {
  return {
    key,
    label: formatDayLabel(instantOn(key, MIDDAY_HOUR)),
    start: instantOn(key, DAY_START_HOUR),
    end: instantOn(shiftKey(key, 1), DAY_START_HOUR),
  }
}

function calendarKey(instant: number): string {
  const { year, month, day } = localParts(instant, AMSTERDAM_TZ)
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

export function festivalDays(range: FestivalRange): readonly FestivalDay[] {
  const lastKey = festivalDayKey(range.end - 1)
  // A first listing at 00:00 Wednesday starts the festival on Wednesday, not Tuesday night.
  const firstKey = [festivalDayKey(range.start), calendarKey(range.start)].sort()[1]!
  const keys: string[] = []
  for (let key = firstKey; key <= lastKey; key = shiftKey(key, 1)) {
    keys.push(key)
  }
  return keys.map(festivalDay)
}

/** The same wall-clock time on another festival day (01:00 stays in that day's night). */
export function sameClockTimeOn(day: FestivalDay, moment: number): number {
  const { hour, minute } = localParts(moment, AMSTERDAM_TZ)
  const dateKey = hour < DAY_START_HOUR ? shiftKey(day.key, 1) : day.key
  return zonedToInstant({ ...parseKey(dateKey), hour, minute }, AMSTERDAM_TZ)
}

export function stepCount(day: FestivalDay): number {
  return Math.round((day.end - day.start) / SLIDER_STEP_MS)
}

export function momentAtStep(day: FestivalDay, step: number): number {
  return day.start + step * SLIDER_STEP_MS
}

export function stepAt(day: FestivalDay, moment: number): number {
  const step = Math.round((moment - day.start) / SLIDER_STEP_MS)
  return Math.min(Math.max(step, 0), stepCount(day) - 1)
}
