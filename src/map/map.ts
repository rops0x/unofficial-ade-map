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
// A picked venue gets a thick white ring and a little extra size, so it reads as "recommended" without a new colour.
const PICK_EXTRA_RADIUS = 2
const PICK_EDGE_WEIGHT = 3
const EDGE_WEIGHT = 2
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

const isPicked = (group: VenueGroup): boolean => group.events.some((event) => event.pick !== undefined)

export function createEventMap(element: HTMLElement): EventMap {
  // No fade: tiles appear at once, which is cheaper on a phone battery.
  const map = L.map(element, { zoomControl: false, fadeAnimation: false }).setView(AMSTERDAM_CENTER, START_ZOOM)
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19, className: 'night-tiles' }).addTo(map)
  // Leaflet only watches the window, but the panel below is laid out after the map and can collapse.
  // Keep the same centre, debouncing moveend like Leaflet's own resize handler so toolbar animations stay cheap.
  new ResizeObserver(() => map.invalidateSize({ debounceMoveend: true })).observe(element)

  const venueLayer = L.layerGroup().addTo(map)
  const colors = { venue: token('--accent'), venueEdge: token('--black'), pickEdge: token('--text'), user: token('--you'), userEdge: token('--text') }
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
      // Picked venues go last, so they are drawn on top of the venues around them.
      const ordered = [...groups.filter((group) => !isPicked(group)), ...groups.filter(isPicked)]
      ordered.forEach((group) => {
        const picked = isPicked(group)
        const marker = L.circleMarker([group.venue.lat, group.venue.lng], {
          radius: BASE_RADIUS + Math.sqrt(group.events.length) * RADIUS_PER_EVENT + (picked ? PICK_EXTRA_RADIUS : 0),
          color: picked ? colors.pickEdge : colors.venueEdge,
          weight: picked ? PICK_EDGE_WEIGHT : EDGE_WEIGHT,
          fillColor: colors.venue,
          fillOpacity: 0.9,
        })
          .bindPopup(() => buildVenuePopup(group, document), { className: 'venue-popup', maxWidth: 300 })
          .bindTooltip(textElement(picked ? `${group.venue.name} · pick` : group.venue.name), { direction: 'top', offset: [0, -8] })
          .addTo(venueLayer)
        if (picked) marker.getElement()?.classList.add('pick-marker')
      })
    },

    showUser(position) {
      const latLng: L.LatLngTuple = [position.lat, position.lng]
      accuracyCircle?.remove()
      // A typed address has no accuracy radius to draw.
      accuracyCircle =
        position.accuracy > 0
          ? L.circle(latLng, { radius: position.accuracy, color: colors.user, weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map)
          : null
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
