import '@fontsource-variable/inter/wght.css'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import rawData from './data/events.json'
import { groupByVenue, type LoadedData, loadEventData } from './events/data.ts'
import type { EventData } from './events/schema.ts'
import { watchLocation } from './map/location.ts'
import { createEventMap } from './map/map.ts'
import { festivalDays } from './time/days.ts'
import { formatMoment } from './time/format.ts'
import { eventsAt, type FestivalRange, festivalRange, initialView, nextStartAfter } from './time/moments.ts'
import { describeStatus } from './ui/status.ts'
import { createTimeControl } from './ui/timeControl.ts'

const FOLLOW_NOW_INTERVAL_MS = 60_000

interface AppState {
  readonly moment: number
  readonly isFollowingNow: boolean
  readonly isLocating: boolean
  readonly notice: string | null
}

function requireElement(id: string): HTMLElement {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing #${id} in index.html`)
  return found
}

function showFatal(panel: HTMLElement, message: string): void {
  const text = document.createElement('p')
  text.className = 'status'
  text.textContent = message
  panel.replaceChildren(text)
}

function run(data: LoadedData, range: FestivalRange, mapElement: HTMLElement, panel: HTMLElement): void {
  const map = createEventMap(mapElement)
  let state: AppState = { moment: initialView(Date.now(), range).moment, isFollowingNow: true, isLocating: false, notice: null }
  let stopLocating: (() => void) | null = null

  const setState = (changes: Partial<AppState>): void => {
    state = { ...state, ...changes }
    render()
  }

  const control = createTimeControl(panel, {
    days: festivalDays(range),
    onMomentChange: (moment) => setState({ moment, isFollowingNow: false }),
    onNow: () => setState({ moment: initialView(Date.now(), range).moment, isFollowingNow: true }),
    onLocate: () => {
      if (stopLocating) {
        map.focusUser()
        return
      }
      let isFirstFix = true
      let hasFailed = false
      const stop = watchLocation(navigator.geolocation, {
        onPosition: (position) => {
          map.showUser(position)
          if (isFirstFix) map.focusUser()
          isFirstFix = false
          if (state.notice) setState({ notice: null })
        },
        onError: (message) => {
          hasFailed = true
          stopLocating?.()
          stopLocating = null
          setState({ isLocating: false, notice: message })
        },
      })
      // onError can fire before watchLocation returns (no geolocation at all); then stay retryable.
      if (!hasFailed) {
        stopLocating = stop
        setState({ isLocating: true })
      }
    },
  })

  const credit = document.createElement('p')
  credit.className = 'credit'
  credit.textContent = `Events from amsterdam-dance-event.nl, updated ${formatMoment(data.collectedAt)}. Times can change, so check the event page.`
  panel.append(credit)

  function render(): void {
    const now = Date.now()
    const view = initialView(now, range)
    const onNow = eventsAt(state.moment, data.events)
    map.showVenues(view.kind === 'ended' ? [] : groupByVenue(onNow))
    control.update({
      moment: state.moment,
      canGoToNow: view.kind === 'live' && !state.isFollowingNow,
      isEnded: view.kind === 'ended',
      status: describeStatus({ moment: state.moment, now, range, onCount: onNow.length, nextStart: nextStartAfter(state.moment, data.events) }),
      locateLabel: state.isLocating ? 'Centre on me' : 'Show my location',
      ...(state.notice ? { notice: state.notice } : {}),
    })
  }

  // While following now, keep the map current if the page stays open.
  setInterval(() => {
    if (state.isFollowingNow) setState({ moment: initialView(Date.now(), range).moment })
  }, FOLLOW_NOW_INTERVAL_MS)

  render()
}

function main(): void {
  const panel = requireElement('panel')
  const data = loadEventData(rawData as EventData)
  const range = festivalRange(data.events)
  if (!range) {
    showFatal(panel, 'No events are loaded yet. Check back soon.')
    return
  }
  run(data, range, requireElement('map'), panel)
}

main()
