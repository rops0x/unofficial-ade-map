import type { Venue } from '../events/schema.ts'
import type { EventPick, LoadedEvent, VenueGroup } from '../events/data.ts'
import { formatTime } from '../time/format.ts'

// Event text comes from scraped websites: build DOM with textContent only, never innerHTML.

const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/'

function isWebLink(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const created = doc.createElement(tag)
  created.className = className
  if (text !== undefined) created.textContent = text
  return created
}

function newTabLink(doc: Document, className: string, text: string, href: string): HTMLAnchorElement {
  const link = element(doc, 'a', className, text)
  link.href = href
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  return link
}

/** Searches by the marker's coordinates, so Maps lands exactly where the map shows the venue. */
function googleMapsUrl(venue: Venue): string {
  const url = new URL(GOOGLE_MAPS_SEARCH_URL)
  url.searchParams.set('api', '1')
  url.searchParams.set('query', `${venue.lat},${venue.lng}`)
  return url.toString()
}

function describeWhen(event: LoadedEvent): string {
  if (event.isEndEstimated) return `From ${formatTime(event.startMs)}, end time not listed`
  const hours = `${formatTime(event.startMs)}–${formatTime(event.endMs)}`
  return event.isDaily ? `${hours} daily` : hours
}

/** The pick's note and a credit linking to the post it came from. */
function pickLines(doc: Document, pick: EventPick): HTMLElement[] {
  const note = element(doc, 'span', 'popup__pick', pick.note === undefined ? 'Pick' : `Pick: ${pick.note}`)
  const credit = `${pick.source.name} · ${pick.source.title}`
  return [note, isWebLink(pick.source.url) ? newTabLink(doc, 'popup__source', credit, pick.source.url) : element(doc, 'span', 'popup__source', credit)]
}

function eventItem(doc: Document, event: LoadedEvent): HTMLLIElement {
  const item = element(doc, 'li', event.pick ? 'popup__event popup__event--pick' : 'popup__event')
  if (isWebLink(event.sourceUrl)) {
    item.append(newTabLink(doc, 'popup__name', event.name, event.sourceUrl))
  } else {
    item.append(element(doc, 'span', 'popup__name', event.name))
  }
  item.append(element(doc, 'span', 'popup__when', describeWhen(event)))
  if (event.pick) item.append(...pickLines(doc, event.pick))
  return item
}

export function buildVenuePopup(group: VenueGroup, doc: Document): HTMLElement {
  const root = element(doc, 'div', 'popup')
  const list = element(doc, 'ul', 'popup__events')
  list.append(...group.events.map((event) => eventItem(doc, event)))
  root.append(
    element(doc, 'h2', 'popup__venue', group.venue.name),
    element(doc, 'p', 'popup__address', group.venue.address),
    newTabLink(doc, 'popup__maps', 'Open in Google Maps', googleMapsUrl(group.venue)),
    list,
  )
  return root
}
