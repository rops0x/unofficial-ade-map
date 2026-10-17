import type { LoadedEvent, VenueGroup } from '../events/data.ts'
import { formatTime } from '../time/format.ts'

// Event text comes from scraped websites: build DOM with textContent only, never innerHTML.

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

function describeWhen(event: LoadedEvent): string {
  if (event.isEndEstimated) return `From ${formatTime(event.startMs)}, end time not listed`
  const hours = `${formatTime(event.startMs)}–${formatTime(event.endMs)}`
  return event.isDaily ? `${hours} daily` : hours
}

function eventItem(doc: Document, event: LoadedEvent): HTMLLIElement {
  const item = element(doc, 'li', 'popup__event')
  if (isWebLink(event.sourceUrl)) {
    const link = element(doc, 'a', 'popup__name', event.name)
    link.href = event.sourceUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    item.append(link)
  } else {
    item.append(element(doc, 'span', 'popup__name', event.name))
  }
  item.append(element(doc, 'span', 'popup__when', describeWhen(event)))
  return item
}

export function buildVenuePopup(group: VenueGroup, doc: Document): HTMLElement {
  const root = element(doc, 'div', 'popup')
  const list = element(doc, 'ul', 'popup__events')
  list.append(...group.events.map((event) => eventItem(doc, event)))
  root.append(
    element(doc, 'h2', 'popup__venue', group.venue.name),
    element(doc, 'p', 'popup__address', group.venue.address),
    list,
  )
  return root
}
