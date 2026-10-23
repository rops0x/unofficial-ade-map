import { festivalDayKey } from '../time/days.ts'
import { formatMoment, formatTime } from '../time/format.ts'
import type { FestivalRange } from '../time/moments.ts'

export interface StatusAction {
  readonly label: string
  readonly moment: number
}

export interface Status {
  readonly text: string
  readonly action: StatusAction | null
}

export interface StatusInput {
  readonly moment: number
  readonly now: number
  readonly range: FestivalRange
  readonly onCount: number
  readonly nextStart: number | null
  /** What is being counted: every event, only the picks, or the events (or picks) that match the chosen filters. */
  readonly noun?: StatusNoun
}

export type StatusNoun = 'event' | 'pick' | 'matching event' | 'matching pick'

const jumpLabel = (moment: number, next: number): string =>
  festivalDayKey(moment) === festivalDayKey(next) ? formatTime(next) : formatMoment(next)

const plural = (count: number, noun: StatusNoun): string => `${count} ${noun}${count === 1 ? '' : 's'}`

function nothingOn(moment: number, noun: StatusNoun, isLast: boolean): string {
  const at = formatTime(moment)
  if (noun !== 'event') return isLast ? `No ${noun}s on at ${at}, and none later.` : `No ${noun}s on at ${at}.`
  return isLast ? `Nothing on at ${at}, and nothing later.` : `Nothing on at ${at}.`
}

export function describeStatus({ moment, now, range, onCount, nextStart, noun = 'event' }: StatusInput): Status {
  if (now >= range.end) return { text: 'ADE 2026 has ended.', action: null }

  if (onCount === 0) {
    return nextStart === null
      ? { text: nothingOn(moment, noun, true), action: null }
      : { text: nothingOn(moment, noun, false), action: { label: `Jump to ${jumpLabel(moment, nextStart)}`, moment: nextStart } }
  }

  if (now < range.start) {
    return { text: `ADE starts ${formatMoment(range.start)}. Here’s what’s on first: ${plural(onCount, noun)}.`, action: null }
  }
  return { text: `${plural(onCount, noun)} on`, action: null }
}
