import { AMSTERDAM_TZ } from './zone.ts'

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: AMSTERDAM_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: AMSTERDAM_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export function formatTime(instant: number): string {
  return timeFormat.format(instant)
}

export function formatDayLabel(instant: number): string {
  return dayFormat.format(instant).replace(',', '')
}

export function formatMoment(instant: number): string {
  return `${formatDayLabel(instant)}, ${formatTime(instant)}`
}
