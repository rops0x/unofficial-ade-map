import L from 'leaflet'
import type { VenueGroup } from '../events/data.ts'
import type { UserPosition } from './location.ts'
import { buildVenuePopup } from './popup.ts'

const AMSTERDAM_CENTER: L.LatLngTuple = [52.3676, 4.8952]
// Opens on the centre, where most venues are; outlying venues are a pinch away.
const START_ZOOM = 14
const USER_ZOOM = 15
const BASE_RADIUS = 6
const RADIUS_PER_EVENT = 1.5
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export interface EventMap {
  showVenues(groups: readonly VenueGroup[]): void
  showUser(position: UserPosition): void
  focusUser(): void
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Leaflet renders string tooltips as HTML; scraped names must go in as text. */
function textElement(text: string): HTMLElement {
  const span = document.createElement('span')
  span.textContent = text
  return span
}

const prefersReducedMotion =(): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function createEventMap(element: HTMLElement): EventMap {
  // No fade: tiles appear at once, which is cheaper on a phone battery.
  const map = L.map(element, { zoomControl: false, fadeAnimation: false }).setView(AMSTERDAM_CENTER, START_ZOOM)
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19, className: 'night-tiles' }).addTo(map)

  const venueLayer = L.layerGroup().addTo(map)
  const colors = { venue: token('--accent'), venueEdge: token('--black'), user: token('--you'), userEdge: token('--text') }
  let userMarker: L.CircleMarker | null = null
  let accuracyCircle: L.Circle | null = null
  let lastSignature: string | null = null

  return {
    showVenues(groups) {
      // The clock ticks every minute; only redraw when what's on actually changed,
      // because redrawing closes an open popup.
      const signature = groups.map((group) => `${group.venue.id}:${group.events.map((event) => event.id).join(',')}`).join('|')
      if (signature === lastSignature) return
      lastSignature = signature
      venueLayer.clearLayers()
      groups.forEach((group) => {
        L.circleMarker([group.venue.lat, group.venue.lng], {
          radius: BASE_RADIUS + Math.sqrt(group.events.length) * RADIUS_PER_EVENT,
          color: colors.venueEdge,
          weight: 2,
          fillColor: colors.venue,
          fillOpacity: 0.9,
        })
          .bindPopup(() => buildVenuePopup(group, document), { className: 'venue-popup', maxWidth: 300 })
          .bindTooltip(textElement(group.venue.name), { direction: 'top', offset: [0, -8] })
          .addTo(venueLayer)
      })
    },

    showUser(position) {
      const latLng: L.LatLngTuple = [position.lat, position.lng]
      accuracyCircle?.remove()
      accuracyCircle = L.circle(latLng, { radius: position.accuracy, color: colors.user, weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map)
      if (userMarker) {
        userMarker.setLatLng(latLng)
      } else {
        userMarker = L.circleMarker(latLng, { radius: 8, color: colors.userEdge, weight: 3, fillColor: colors.user, fillOpacity: 1 })
          .bindTooltip('You are here')
          .addTo(map)
        userMarker.getElement()?.classList.add('user-marker')
      }
    },

    focusUser() {
      if (!userMarker) return
      map.setView(userMarker.getLatLng(), Math.max(map.getZoom(), USER_ZOOM), { animate: !prefersReducedMotion() })
    },
  }
}
