export interface Timed {
  readonly startMs: number
  readonly endMs: number
}

export interface FestivalRange {
  readonly start: number
  readonly end: number
}

export type ViewKind = 'preview' | 'live' | 'ended'

export interface InitialView {
  readonly kind: ViewKind
  readonly moment: number
}

export function festivalRange(events: readonly Timed[]): FestivalRange | null {
  if (events.length === 0) return null
  return {
    start: Math.min(...events.map((event) => event.startMs)),
    end: Math.max(...events.map((event) => event.endMs)),
  }
}

/** What the map opens on: the first event before ADE, now during ADE, a goodbye after. */
export function initialView(now: number, range: FestivalRange): InitialView {
  if (now < range.start) return { kind: 'preview', moment: range.start }
  if (now >= range.end) return { kind: 'ended', moment: range.end }
  return { kind: 'live', moment: now }
}

export function isOnAt(moment: number, event: Timed): boolean {
  return event.startMs <= moment && moment < event.endMs
}

export function eventsAt<T extends Timed>(moment: number, events: readonly T[]): readonly T[] {
  return events.filter((event) => isOnAt(moment, event))
}

export function nextStartAfter(moment: number, events: readonly Timed[]): number | null {
  const upcoming = events.map((event) => event.startMs).filter((start) => start > moment)
  return upcoming.length === 0 ? null : Math.min(...upcoming)
}
