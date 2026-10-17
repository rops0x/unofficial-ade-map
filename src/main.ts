import '@fontsource-variable/inter/wght.css'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import rawData from './data/events.json'
import { groupByVenue, type LoadedData, loadEventData } from './events/data.ts'
import type { EventData } from './events/schema.ts'
import { type Coordinates, findAddress } from './map/geocode.ts'
import { watchLocation } from './map/location.ts'
import { createEventMap } from './map/map.ts'
import { festivalDays } from './time/days.ts'
import { formatMoment } from './time/format.ts'
import { eventsAt, type FestivalRange, festivalRange, initialView, nextStartAfter } from './time/moments.ts'
import { describeStatus } from './ui/status.ts'
import { createTimeControl } from './ui/timeControl.ts'

const FOLLOW_NOW_INTERVAL_MS = 60_000
// A typed address is a single point, not a GPS fix with a margin of error.
const TYPED_ADDRESS_ACCURACY = 0
const ADDRESS_NOT_FOUND = 'Couldn’t find that address in Amsterdam. Check the spelling or add the house number.'
const ADDRESS_LOOKUP_FAILED = 'Couldn’t look up that address right now. Check your connection or try again in a minute.'

interface AppState {
  readonly moment: number
  readonly isFollowingNow: boolean
  readonly isLocating: boolean
  readonly isAddressOpen: boolean
  readonly isFindingAddress: boolean
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
  let state: AppState = {
    moment: initialView(Date.now(), range).moment,
    isFollowingNow: true,
    isLocating: false,
    isAddressOpen: false,
    isFindingAddress: false,
    notice: null,
  }
  let stopLocating: (() => void) | null = null

  const setState = (changes: Partial<AppState>): void => {
    state = { ...state, ...changes }
    render()
  }

  const stopFollowingDevice = (): void => {
    stopLocating?.()
    stopLocating = null
  }

  async function showAddress(address: string): Promise<void> {
    if (state.isFindingAddress) return
    setState({ isFindingAddress: true, notice: null })
    let found: Coordinates | null
    try {
      found = await findAddress(address)
    } catch {
      // Offline, timed out or rate limited: the visitor can only retry, so say that.
      setState({ isFindingAddress: false, notice: ADDRESS_LOOKUP_FAILED })
      return
    }
    if (!found) {
      setState({ isFindingAddress: false, notice: ADDRESS_NOT_FOUND })
      return
    }
    map.showUser({ ...found, accuracy: TYPED_ADDRESS_ACCURACY })
    map.focusUser()
    // The typed address replaces the device's position, so stop the device moving the marker.
    stopFollowingDevice()
    setState({ isFindingAddress: false, isLocating: false, isAddressOpen: false })
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
          stopFollowingDevice()
          // No device location: offer the address field straight away.
          setState({ isLocating: false, isAddressOpen: true, notice: message })
        },
      })
      // onError can fire before watchLocation returns (no geolocation at all); then stay retryable.
      if (!hasFailed) {
        stopLocating = stop
        setState({ isLocating: true })
      }
    },
    // Closing the form also clears its messages, so none is left pointing at a hidden field.
    onAddressToggle: () => setState(state.isAddressOpen ? { isAddressOpen: false, notice: null } : { isAddressOpen: true }),
    onAddress: (address) => void showAddress(address),
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
      isAddressOpen: state.isAddressOpen,
      isFindingAddress: state.isFindingAddress,
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
