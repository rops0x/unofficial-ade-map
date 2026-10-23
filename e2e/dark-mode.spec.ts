import { expect, type Locator, type Page, test } from '@playwright/test'

// What a phone does when it switches to dark mode (often automatically, at night): it prefers dark,
// and Chrome and Samsung Internet darken pages that don't say they are dark already. Samsung Internet
// only checks the page's color-scheme meta tag, so that is what has to be there.
// Launch options force a new browser, so this lives in its own file.
test.use({ colorScheme: 'dark', launchOptions: { args: ['--blink-settings=forceDarkModeEnabled=true'] } })

// Fixture data (e2e/fixtures/events.json): two venues are on at this moment.
const SATURDAY_0030 = new Date('2026-10-23T22:30:00Z')
// Low enough on a pill button to miss its label.
const ABOVE_LABEL = 0.15
const CENTRE = 0.5

/** The colour actually painted inside an element, read back from a screenshot. */
async function paintedColour(page: Page, element: Locator, heightFraction: number): Promise<readonly number[]> {
  const box = await element.boundingBox()
  if (!box) throw new Error('Element is not on screen')
  const png = await page.screenshot({ clip: { x: box.x + box.width / 2, y: box.y + box.height * heightFraction, width: 1, height: 1 } })
  return page.evaluate(async (base64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const context = document.createElement('canvas').getContext('2d')
    if (!context) throw new Error('No 2d canvas')
    context.drawImage(image, 0, 0)
    return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]
  }, png.toString('base64'))
}

const isYellow = ([red = 0, green = 0, blue = 0]: readonly number[]): boolean => red > 200 && green > 200 && blue < 100

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
  // Chrome would also take the stylesheet's color-scheme; Samsung Internet reads only the meta tag, so test that alone.
  await page.route('**/*.css', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()).replace(/color-scheme:[^;}]*;?/g, '') })
  })
  await page.clock.setFixedTime(SATURDAY_0030)
  await page.goto('/')
})

test('tells the browser the page is already dark, so it is never darkened', async ({ page }) => {
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'only dark')
})

test('venues and the chosen day stay yellow', async ({ page }) => {
  const venues = page.locator('.leaflet-overlay-pane path.leaflet-interactive:not(.user-marker)')
  await expect(venues).toHaveCount(2)

  expect(isYellow(await paintedColour(page, venues.first(), CENTRE))).toBe(true)
  expect(isYellow(await paintedColour(page, page.locator('.day[aria-pressed="true"]').first(), ABOVE_LABEL))).toBe(true)
})
