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
}

const jumpLabel = (moment: number, next: number): string =>
  festivalDayKey(moment) === festivalDayKey(next) ? formatTime(next) : formatMoment(next)

const plural = (count: number): string => `${count} event${count === 1 ? '' : 's'}`

export function describeStatus({ moment, now, range, onCount, nextStart }: StatusInput): Status {
  if (now >= range.end) return { text: 'ADE 2026 has ended.', action: null }

  if (onCount === 0) {
    return nextStart === null
      ? { text: `Nothing on at ${formatTime(moment)}, and nothing later.`, action: null }
      : { text: `Nothing on at ${formatTime(moment)}.`, action: { label: `Jump to ${jumpLabel(moment, nextStart)}`, moment: nextStart } }
  }

  if (now < range.start) {
    return { text: `ADE starts ${formatMoment(range.start)}. Here’s what’s on first: ${plural(onCount)}.`, action: null }
  }
  return { text: `${plural(onCount)} on`, action: null }
}
