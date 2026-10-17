export interface UserPosition {
  readonly lat: number
  readonly lng: number
  readonly accuracy: number
}

export interface LocationHandlers {
  readonly onPosition: (position: UserPosition) => void
  readonly onError: (message: string) => void
}

type GeolocationLike = Pick<Geolocation, 'watchPosition' | 'clearWatch'>

const PERMISSION_DENIED = 1
const TIMEOUT = 3
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }

export function locationErrorMessage(code: number): string {
  if (code === PERMISSION_DENIED) return 'Location is off for this site. Allow it in your browser settings, or enter an address instead.'
  if (code === TIMEOUT) return 'Finding your location took too long. Try again in a moment.'
  return 'Couldn’t find your location. The map works without it.'
}

/** Follows the visitor's position. Returns a function that stops following. */
export function watchLocation(geolocation: GeolocationLike | undefined, handlers: LocationHandlers): () => void {
  if (!geolocation) {
    handlers.onError('This browser can’t share your location. The map works without it.')
    return () => {}
  }
  const id = geolocation.watchPosition(
    ({ coords }) => handlers.onPosition({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
    (error) => handlers.onError(locationErrorMessage(error.code)),
    WATCH_OPTIONS,
  )
  return () => geolocation.clearWatch(id)
}
