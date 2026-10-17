// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import type { LoadedEvent } from '../events/data.ts'
import { buildVenuePopup } from './popup.ts'

const venue = { id: 'v1', name: 'Melkweg', address: 'Lijnbaansgracht 234A, Amsterdam', lat: 52.3647, lng: 4.8812 }

function event(overrides: Partial<LoadedEvent> = {}): LoadedEvent {
  return {
    id: 'e1',
    name: 'Night One',
    venueId: 'v1',
    venue,
    start: '2026-10-23T21:00:00.000Z',
    end: '2026-10-24T03:00:00.000Z',
    startMs: Date.parse('2026-10-23T21:00:00.000Z'),
    endMs: Date.parse('2026-10-24T03:00:00.000Z'),
    isEndEstimated: false,
    isDaily: false,
    sourceUrl: 'https://www.amsterdam-dance-event.nl/en/program/2026/night-one/1/',
    ...overrides,
  }
}

describe('buildVenuePopup', () => {
  test('shows the venue, address, and each event with its times', () => {
    const popup = buildVenuePopup({ venue, events: [event()] }, document)

    expect(popup.querySelector('h2')?.textContent).toBe('Melkweg')
    expect(popup.textContent).toContain('Lijnbaansgracht 234A, Amsterdam')
    expect(popup.textContent).toContain('23:00–05:00')
  })

  test('links each event to its event page in a new tab', () => {
    const link = buildVenuePopup({ venue, events: [event()] }, document).querySelector('.popup__events a')

    expect(link?.getAttribute('href')).toBe('https://www.amsterdam-dance-event.nl/en/program/2026/night-one/1/')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('says when the end time is not listed', () => {
    const popup = buildVenuePopup({ venue, events: [event({ isEndEstimated: true })] }, document)

    expect(popup.textContent).toContain('end time not listed')
  })

  test('says when an event repeats daily', () => {
    const popup = buildVenuePopup({ venue, events: [event({ isDaily: true })] }, document)

    expect(popup.textContent).toContain('daily')
  })

  test('renders names as text, never as HTML', () => {
    const popup = buildVenuePopup({ venue, events: [event({ name: '<img src=x onerror=alert(1)>' })] }, document)

    expect(popup.querySelector('img')).toBeNull()
    expect(popup.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  test('does not link to a non-web address', () => {
    const popup = buildVenuePopup({ venue, events: [event({ sourceUrl: 'javascript:alert(1)' })] }, document)

    expect(popup.querySelector('.popup__events a')).toBeNull()
  })

  test('links the venue to Google Maps at its map position in a new tab', () => {
    const popup = buildVenuePopup({ venue, events: [event()] }, document)

    const link = popup.querySelector<HTMLAnchorElement>('a.popup__maps')

    expect(link?.textContent).toBe('Open in Google Maps')
    expect(link?.getAttribute('href')).toBe('https://www.google.com/maps/search/?api=1&query=52.3647%2C4.8812')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
