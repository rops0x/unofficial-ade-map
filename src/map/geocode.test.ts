import { describe, expect, test, vi } from 'vitest'
import { findAddress, MAX_ADDRESS_LENGTH, nominatimSearchUrl, parseNominatimResult } from './geocode.ts'

const DAM_SQUARE = [{ lat: '52.3731', lon: '4.8926', display_name: 'Dam, Amsterdam' }]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('parseNominatimResult', () => {
  test('reads the first match', () => {
    const body = [{ lat: '52.3647', lon: '4.8812', display_name: 'Melkweg' }]

    expect(parseNominatimResult(body)).toEqual({ lat: 52.3647, lng: 4.8812 })
  })

  test('is null when nothing matched', () => {
    expect(parseNominatimResult([])).toBeNull()
  })

  test('is null for an unexpected response shape', () => {
    expect(parseNominatimResult({ error: 'rate limited' })).toBeNull()
  })

  test('is null for missing coordinates rather than placing a pin at 0,0', () => {
    expect(parseNominatimResult([{ lat: null, lon: '' }])).toBeNull()
  })

  test('is null for a place outside Amsterdam, which typed coordinates can still return', () => {
    expect(parseNominatimResult([{ lat: '48.8566', lon: '2.3522' }])).toBeNull()
  })
})

describe('nominatimSearchUrl', () => {
  test('restricts the search to the Amsterdam area', () => {
    const url = new URL(nominatimSearchUrl('Dam 1, Amsterdam'))

    expect(url.searchParams.get('q')).toBe('Dam 1, Amsterdam')
    expect(url.searchParams.get('bounded')).toBe('1')
    expect(url.searchParams.get('viewbox')).toBe('4.7,52.5,5.1,52.25')
  })
})

describe('findAddress', () => {
  test('looks the address up in the Amsterdam area and returns where it is', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(DAM_SQUARE))

    const found = await findAddress('  Dam 1 ', fetchFn)

    expect(found).toEqual({ lat: 52.3731, lng: 4.8926 })
    expect(fetchFn).toHaveBeenCalledWith(nominatimSearchUrl('Dam 1'), expect.objectContaining({ headers: { Accept: 'application/json' } }))
  })

  test('is null when nothing in Amsterdam matches', async () => {
    const found = await findAddress('Nowhere 999', async () => jsonResponse([]))

    expect(found).toBeNull()
  })

  test('does not look up a blank address', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(DAM_SQUARE))

    await expect(findAddress('   ', fetchFn)).resolves.toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('sends at most the maximum address length', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(DAM_SQUARE))

    await findAddress('a'.repeat(MAX_ADDRESS_LENGTH + 50), fetchFn)

    expect(fetchFn).toHaveBeenCalledWith(nominatimSearchUrl('a'.repeat(MAX_ADDRESS_LENGTH)), expect.anything())
  })

  test('gives up on a lookup that takes too long', async () => {
    const fetchFn = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse(DAM_SQUARE))

    await findAddress('Dam 1', fetchFn)

    expect(fetchFn.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal)
  })

  test('fails when the lookup service answers with an error', async () => {
    await expect(findAddress('Dam 1', async () => jsonResponse({}, 503))).rejects.toThrow('503')
  })
})
