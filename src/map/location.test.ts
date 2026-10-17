import { describe, expect, test, vi } from 'vitest'
import { locationErrorMessage, watchLocation } from './location.ts'

const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2
const TIMEOUT = 3

function fakeGeolocation() {
  let success: PositionCallback = () => {}
  let failure: PositionErrorCallback | null | undefined = null
  const geolocation = {
    watchPosition: vi.fn((onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => {
      success = onSuccess
      failure = onError
      return 7
    }),
    clearWatch: vi.fn(),
  }
  return {
    geolocation,
    emit: (lat: number, lng: number, accuracy: number) =>
      success({ coords: { latitude: lat, longitude: lng, accuracy } } as GeolocationPosition),
    fail: (code: number) => failure?.({ code } as GeolocationPositionError),
  }
}

describe('watchLocation', () => {
  test('reports positions', () => {
    const fake = fakeGeolocation()
    const onPosition = vi.fn()

    watchLocation(fake.geolocation, { onPosition, onError: vi.fn() })
    fake.emit(52.37, 4.89, 25)

    expect(onPosition).toHaveBeenCalledWith({ lat: 52.37, lng: 4.89, accuracy: 25 })
  })

  test('reports a friendly message when permission is denied', () => {
    const fake = fakeGeolocation()
    const onError = vi.fn()

    watchLocation(fake.geolocation, { onPosition: vi.fn(), onError })
    fake.fail(PERMISSION_DENIED)

    expect(onError).toHaveBeenCalledWith(locationErrorMessage(PERMISSION_DENIED))
  })

  test('stop clears the watch', () => {
    const fake = fakeGeolocation()

    const stop = watchLocation(fake.geolocation, { onPosition: vi.fn(), onError: vi.fn() })
    stop()

    expect(fake.geolocation.clearWatch).toHaveBeenCalledWith(7)
  })

  test('without geolocation support, reports an error instead of failing', () => {
    const onError = vi.fn()

    watchLocation(undefined, { onPosition: vi.fn(), onError })

    expect(onError).toHaveBeenCalledWith('This browser can’t share your location. The map works without it.')
  })
})

describe('locationErrorMessage', () => {
  test.each([
    [PERMISSION_DENIED, 'Location is off for this site. Allow it in your browser settings to see where you are.'],
    [POSITION_UNAVAILABLE, 'Couldn’t find your location. The map works without it.'],
    [TIMEOUT, 'Finding your location took too long. Try again in a moment.'],
  ])('code %i', (code, message) => {
    expect(locationErrorMessage(code)).toBe(message)
  })
})
