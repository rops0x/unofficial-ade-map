import { expect, type Page, test } from '@playwright/test'

// Fixture data (e2e/fixtures/events.json): ADE runs Wed 21 Oct 12:00 to Mon 26 Oct 04:00 (Amsterdam time).
const BEFORE_ADE = new Date('2026-10-17T10:00:00Z')
const SATURDAY_0030 = new Date('2026-10-23T22:30:00Z')
const AFTER_ADE = new Date('2026-10-27T10:00:00Z')
const DAM_SQUARE = { latitude: 52.373, longitude: 4.8925 }

const venueMarkers = (page: Page) => page.locator('.leaflet-overlay-pane path.leaflet-interactive:not(.user-marker)')
const time = (page: Page) => page.locator('[data-role="time"]')
const status = (page: Page) => page.getByRole('status')
const userMarker = (page: Page) => page.locator('path.user-marker')
const addressField = (page: Page) => page.getByRole('textbox', { name: 'Your address' })

/** Answers address lookups like Nominatim would, without calling it. Returns the queries it saw. */
async function fakeNominatim(page: Page, results: readonly object[]): Promise<string[]> {
  const queries: string[] = []
  await page.route('https://nominatim.openstreetmap.org/search?**', (route) => {
    queries.push(new URL(route.request().url()).searchParams.get('q') ?? '')
    return route.fulfill({ json: results, headers: { 'Access-Control-Allow-Origin': '*' } })
  })
  return queries
}

async function openAt(page: Page, now: Date): Promise<void> {
  // Keep tests off the real tile servers.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
  await page.clock.setFixedTime(now)
  await page.goto('/')
}

test('before ADE, opens on the first event', async ({ page }) => {
  await openAt(page, BEFORE_ADE)

  await expect(time(page)).toHaveText('12:00')
  await expect(status(page)).toContainText('ADE starts Wed 21 Oct, 12:00')
  await expect(venueMarkers(page)).toHaveCount(1)
})

test('during ADE, opens on what is on now', async ({ page }) => {
  await openAt(page, SATURDAY_0030)

  await expect(time(page)).toHaveText('00:30')
  await expect(status(page)).toContainText('2 events on')
  await expect(venueMarkers(page)).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Back to now' })).toBeHidden()
})

test('moving the slider changes what is shown, and "Back to now" returns', async ({ page }) => {
  await openAt(page, SATURDAY_0030)

  await page.getByRole('slider', { name: 'Time' }).fill('34') // Fri 23:00

  await expect(time(page)).toHaveText('23:00')
  await expect(venueMarkers(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Back to now' }).click()
  await expect(time(page)).toHaveText('00:30')
})

test('picking a day with nothing on offers to jump to the next event', async ({ page }) => {
  await openAt(page, SATURDAY_0030)

  await page.getByRole('button', { name: 'Thu 22 Oct' }).click()

  await expect(status(page)).toContainText('Nothing on at 00:30.')
  await page.getByRole('button', { name: 'Jump to Fri 23 Oct, 23:00' }).click()
  await expect(venueMarkers(page)).toHaveCount(1)
})

test('a venue popup links to the event page in a new tab', async ({ page }) => {
  await openAt(page, SATURDAY_0030)

  await page.getByRole('slider', { name: 'Time' }).fill('34')
  await venueMarkers(page).first().click()

  const link = page.getByRole('link', { name: 'Friday Night' })
  await expect(link).toHaveAttribute('href', 'https://example.org/events/friday')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(page.locator('.leaflet-popup')).toContainText('23:00–05:00')
})

test('a venue popup links to the venue in Google Maps', async ({ page }) => {
  await openAt(page, SATURDAY_0030)

  await page.getByRole('slider', { name: 'Time' }).fill('34')
  await venueMarkers(page).first().click()

  const link = page.getByRole('link', { name: 'Open in Google Maps' })
  await expect(link).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/)
  await expect(link).toHaveAttribute('target', '_blank')
})

test('an event without a listed end time says so', async ({ page }) => {
  await openAt(page, SATURDAY_0030)

  await page.getByRole('slider', { name: 'Time' }).fill('47') // Sat 05:30: Friday Night has ended, only Late Friday is on
  await expect(venueMarkers(page)).toHaveCount(1)
  await venueMarkers(page).click()

  await expect(page.locator('.leaflet-popup')).toContainText('From 00:00, end time not listed')
})

test.describe('with location allowed', () => {
  test.use({ geolocation: DAM_SQUARE, permissions: ['geolocation'] })

  test('shows where the visitor is', async ({ page }) => {
    await openAt(page, SATURDAY_0030)

    await page.getByRole('button', { name: 'Show my location' }).click()

    await expect(userMarker(page)).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Centre on me' })).toBeVisible()
  })
})

test('with location blocked, explains and keeps the map working', async ({ page, context }) => {
  await context.clearPermissions()
  await openAt(page, SATURDAY_0030)

  await page.getByRole('button', { name: 'Show my location' }).click()

  await expect(page.getByRole('alert')).toContainText('Location is off for this site')
  await expect(venueMarkers(page)).toHaveCount(2)
})

test('with location blocked, offers to enter an address and shows it on the map', async ({ page, context }) => {
  await context.clearPermissions()
  const queries = await fakeNominatim(page, [{ lat: '52.3731', lon: '4.8926', display_name: 'Dam, Amsterdam' }])
  await openAt(page, SATURDAY_0030)

  await page.getByRole('button', { name: 'Show my location' }).click()
  await expect(addressField(page)).toBeVisible()
  await addressField(page).fill('Dam 1')
  await addressField(page).press('Enter')

  await expect(userMarker(page)).toHaveCount(1)
  await expect(addressField(page)).toBeHidden()
  await expect(page.getByRole('alert')).toBeHidden()
  expect(queries).toEqual(['Dam 1'])
})

test('an address can be entered without asking for location first', async ({ page }) => {
  await fakeNominatim(page, [{ lat: '52.3731', lon: '4.8926', display_name: 'Dam, Amsterdam' }])
  await openAt(page, SATURDAY_0030)

  await page.getByRole('button', { name: 'Enter an address' }).click()
  await addressField(page).fill('Dam 1')
  await page.getByRole('button', { name: 'Find' }).click()

  await expect(userMarker(page)).toHaveCount(1)
})

test('when the address lookup fails, says so and lets the visitor try again', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/search?**', (route) => route.abort())
  await openAt(page, SATURDAY_0030)

  await page.getByRole('button', { name: 'Enter an address' }).click()
  await addressField(page).fill('Dam 1')
  await addressField(page).press('Enter')

  await expect(page.getByRole('alert')).toContainText('Couldn’t look up that address right now')
  await expect(page.getByRole('button', { name: 'Find' })).toHaveAttribute('aria-disabled', 'false')
  await expect(addressField(page)).toBeVisible()
})

test('an address outside Amsterdam explains that it was not found', async ({ page }) => {
  await fakeNominatim(page, [])
  await openAt(page, SATURDAY_0030)

  await page.getByRole('button', { name: 'Enter an address' }).click()
  await addressField(page).fill('Nowhere 999')
  await addressField(page).press('Enter')

  await expect(page.getByRole('alert')).toContainText('Couldn’t find that address in Amsterdam')
  await expect(addressField(page)).toBeVisible()
  await expect(userMarker(page)).toHaveCount(0)
})

// Leaflet draws venues on an SVG that is the map size it knows about plus 10% padding on every side.
const LEAFLET_SVG_PADDING = 0.1

async function heightOf(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`${selector} is not on screen`)
  return box.height
}

/** Leaflet must know the map's real size, or the centre sits behind the panel and new strips stay blank. */
async function expectLeafletToFitMap(page: Page): Promise<void> {
  await expect(async () => {
    const sizeLeafletKnows = (await heightOf(page, '.leaflet-overlay-pane svg')) / (1 + 2 * LEAFLET_SVG_PADDING)
    expect(Math.abs(sizeLeafletKnows - (await heightOf(page, '#map')))).toBeLessThan(2)
  }).toPass({ timeout: 5_000 })
}

test('the map knows its real size once the panel is laid out', async ({ page }) => {
  await openAt(page, SATURDAY_0030)

  await expectLeafletToFitMap(page)
})

test('on a phone, the time controls collapse to give the map more room', async ({ page }) => {
  await openAt(page, SATURDAY_0030)
  const toggle = page.getByRole('button', { name: 'Time controls' })
  const slider = page.getByRole('slider', { name: 'Time' })
  await expect(slider).toBeVisible()
  const expandedHeight = await heightOf(page, '#map')

  await toggle.click()

  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(slider).toBeHidden()
  await expect(page.getByRole('button', { name: 'Thu 22 Oct' })).toBeHidden()
  await expect(time(page)).toHaveText('00:30')
  await expect(status(page)).toContainText('2 events on')
  await expect.poll(() => heightOf(page, '#map')).toBeGreaterThan(expandedHeight)
  await expectLeafletToFitMap(page)

  await toggle.click()

  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(slider).toBeVisible()
})

test('a panel collapsed on a phone opens up again as a wide-screen side column', async ({ page }) => {
  await openAt(page, SATURDAY_0030)
  await page.getByRole('button', { name: 'Time controls' }).click()
  await expect(page.getByRole('slider', { name: 'Time' })).toBeHidden()

  await page.setViewportSize({ width: 1200, height: 800 })

  await expect(page.getByRole('button', { name: 'Time controls' })).toBeHidden()
  await expect(page.getByRole('slider', { name: 'Time' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show my location' })).toBeVisible()
})

test('after ADE, says see you in 2027', async ({ page }) => {
  await openAt(page, AFTER_ADE)

  await expect(time(page)).toHaveText('See you in 2027!')
  await expect(page.getByRole('slider', { name: 'Time' })).toBeHidden()
  await expect(venueMarkers(page)).toHaveCount(0)
})

test('the page runs under its content security policy without violations', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  await openAt(page, SATURDAY_0030)

  await expect(venueMarkers(page)).toHaveCount(2)
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1)
  expect(violations).toEqual([])
})

test('the page is clearly unofficial and fits a phone screen', async ({ page }) => {
  await openAt(page, SATURDAY_0030)

  await expect(page.getByRole('heading', { name: 'Unofficial ADE map' })).toBeVisible()
  await expect(page.getByText('Not affiliated with ADE')).toBeVisible()
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflows).toBe(false)
})
