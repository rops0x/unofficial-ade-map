import { type FestivalDay, festivalDayKey, momentAtStep, sameClockTimeOn, stepAt, stepCount } from '../time/days.ts'
import { formatDayLabel, formatMoment, formatTime } from '../time/format.ts'
import type { Status } from './status.ts'

export interface TimeControlOptions {
  readonly days: readonly FestivalDay[]
  readonly onMomentChange: (moment: number) => void
  readonly onNow: () => void
  readonly onLocate: () => void
}

export interface TimeControlView {
  readonly moment: number
  readonly canGoToNow: boolean
  readonly isEnded: boolean
  readonly status: Status
  readonly locateLabel?: string
  readonly notice?: string
}

export interface TimeControl {
  update(view: TimeControlView): void
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, role?: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag)
  created.className = className
  if (role) created.dataset.role = role
  return created
}

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const created = make('button', className)
  created.type = 'button'
  created.textContent = label
  created.addEventListener('click', onClick)
  return created
}

function dayFor(days: readonly FestivalDay[], moment: number): FestivalDay {
  const key = festivalDayKey(moment)
  const match = days.find((day) => day.key === key)
  if (match) return match
  return moment < (days[0]?.start ?? 0) ? days[0]! : days[days.length - 1]!
}

export function createTimeControl(root: HTMLElement, options: TimeControlOptions): TimeControl {
  const { days } = options
  let moment = days[0]?.start ?? 0

  const dayText = make('p', 'readout__day', 'day')
  const timeText = make('p', 'readout__time', 'time')
  const readout = make('div', 'readout')
  readout.append(dayText, timeText)

  const statusText = make('span', 'status__text')
  let statusMoment: number | null = null
  const statusAction = button('status__action', '', () => {
    if (statusMoment !== null) options.onMomentChange(statusMoment)
  })
  const status = make('p', 'status')
  status.setAttribute('role', 'status')
  status.append(statusText, statusAction)

  const slider = make('input', 'slider')
  slider.type = 'range'
  slider.min = '0'
  slider.step = '1'
  slider.setAttribute('aria-label', 'Time')
  slider.addEventListener('input', () => options.onMomentChange(momentAtStep(dayFor(days, moment), Number(slider.value))))

  const dayButtons = days.map((day) =>
    button('day', day.label, () => options.onMomentChange(sameClockTimeOn(day, moment))),
  )
  const dayRow = make('div', 'days')
  dayRow.setAttribute('role', 'group')
  dayRow.setAttribute('aria-label', 'Day')
  dayRow.append(...dayButtons)

  const controls = make('div', 'controls', 'controls')
  controls.append(slider, dayRow)

  const nowButton = button('action action--now', 'Back to now', options.onNow)
  const locateButton = button('action', 'Show my location', options.onLocate)
  const actions = make('div', 'actions')
  actions.append(nowButton, locateButton)

  const notice = make('p', 'notice', 'notice')
  notice.setAttribute('role', 'alert')

  root.append(readout, status, controls, actions, notice)

  return {
    update(view) {
      moment = view.moment
      const day = dayFor(days, moment)

      dayText.textContent = view.isEnded ? 'ADE 2026' : formatDayLabel(moment)
      timeText.textContent = view.isEnded ? 'See you in 2027!' : formatTime(moment)
      controls.hidden = view.isEnded

      slider.max = String(stepCount(day) - 1)
      slider.value = String(stepAt(day, moment))
      slider.setAttribute('aria-valuetext', formatMoment(moment))
      dayButtons.forEach((dayButton, index) => dayButton.setAttribute('aria-pressed', String(days[index]?.key === day.key)))

      statusText.textContent = view.status.text
      statusMoment = view.status.action?.moment ?? null
      statusAction.textContent = view.status.action?.label ?? ''
      statusAction.hidden = view.status.action === null

      nowButton.hidden = !view.canGoToNow
      locateButton.textContent = view.locateLabel ?? 'Show my location'
      notice.textContent = view.notice ?? ''
      notice.hidden = !view.notice
    },
  }
}
