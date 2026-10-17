// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { festivalDay } from '../time/days.ts'
import { createTimeControl, type TimeControlView } from './timeControl.ts'

const at = (iso: string): number => Date.parse(iso)
const days = [festivalDay('2026-10-23'), festivalDay('2026-10-24')]
const fridayAt2300 = at('2026-10-23T21:00:00Z')

function view(overrides: Partial<TimeControlView> = {}): TimeControlView {
  return { moment: fridayAt2300, canGoToNow: false, isEnded: false, status: { text: '12 events on', action: null }, ...overrides }
}

function setup() {
  const root = document.createElement('section')
  const handlers = { onMomentChange: vi.fn(), onNow: vi.fn(), onLocate: vi.fn(), onAddressToggle: vi.fn(), onAddress: vi.fn() }
  const control = createTimeControl(root, { days, ...handlers })
  control.update(view())
  return { root, handlers, control }
}

const button = (root: HTMLElement, label: string): HTMLButtonElement | undefined =>
  [...root.querySelectorAll('button')].find((element) => element.textContent === label)

function required<T extends Element>(found: T | null, what: string): T {
  if (!found) throw new Error(`Missing ${what}`)
  return found
}

const collapseToggle = (root: HTMLElement): HTMLButtonElement =>
  required(root.querySelector<HTMLButtonElement>('button[aria-label="Time controls"]'), 'collapse toggle')

const collapsible = (root: HTMLElement, toggle: HTMLButtonElement): HTMLElement => {
  const id = toggle.getAttribute('aria-controls')
  if (!id) throw new Error('Collapse toggle has no aria-controls')
  return required(root.querySelector<HTMLElement>(`#${id}`), `#${id}`)
}

describe('createTimeControl', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  test('shows the chosen day and time', () => {
    const { root } = setup()

    expect(root.querySelector('[data-role="time"]')?.textContent).toBe('23:00')
    expect(root.querySelector('[data-role="day"]')?.textContent).toBe('Fri 23 Oct')
    expect(root.textContent).toContain('12 events on')
  })

  test('marks the current day button as pressed', () => {
    const { root } = setup()

    expect(button(root, 'Fri 23 Oct')?.getAttribute('aria-pressed')).toBe('true')
    expect(button(root, 'Sat 24 Oct')?.getAttribute('aria-pressed')).toBe('false')
  })

  test('picking another day keeps the time of night', () => {
    const { root, handlers } = setup()

    button(root, 'Sat 24 Oct')?.click()

    expect(handlers.onMomentChange).toHaveBeenCalledWith(at('2026-10-24T21:00:00Z'))
  })

  test('moving the slider picks a time on the chosen day', () => {
    const { root, handlers } = setup()
    const slider = root.querySelector<HTMLInputElement>('input[type="range"]')!

    slider.value = '36'
    slider.dispatchEvent(new Event('input'))

    expect(handlers.onMomentChange).toHaveBeenCalledWith(at('2026-10-23T22:00:00Z'))
  })

  test('the slider describes its value for screen readers', () => {
    const { root } = setup()

    expect(root.querySelector('input[type="range"]')?.getAttribute('aria-valuetext')).toBe('Fri 23 Oct, 23:00')
  })

  test('"Back to now" appears only when the map has moved away from now', () => {
    const { root, control, handlers } = setup()
    expect(button(root, 'Back to now')?.hidden).toBe(true)

    control.update(view({ canGoToNow: true }))
    button(root, 'Back to now')?.click()

    expect(button(root, 'Back to now')?.hidden).toBe(false)
    expect(handlers.onNow).toHaveBeenCalled()
  })

  test('a status action jumps to its moment', () => {
    const { root, control, handlers } = setup()
    control.update(view({ status: { text: 'Nothing on at 07:30.', action: { label: 'Jump to 08:00', moment: 123 } } }))

    button(root, 'Jump to 08:00')?.click()

    expect(handlers.onMomentChange).toHaveBeenCalledWith(123)
  })

  test('after ADE, says goodbye and hides the time controls', () => {
    const { root, control } = setup()

    control.update(view({ isEnded: true, status: { text: 'ADE 2026 has ended.', action: null } }))

    expect(root.querySelector('[data-role="time"]')?.textContent).toBe('See you in 2027!')
    expect(root.querySelector<HTMLElement>('[data-role="controls"]')?.hidden).toBe(true)
  })

  test('starts expanded, with a toggle that controls the slider and day buttons', () => {
    const { root } = setup()
    const toggle = collapseToggle(root)

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(collapsible(root, toggle).contains(root.querySelector('input[type="range"]'))).toBe(true)
    expect(root.hasAttribute('data-collapsed')).toBe(false)
  })

  test('the toggle collapses and re-expands the time controls', () => {
    const { root } = setup()
    const toggle = collapseToggle(root)

    toggle.click()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(root.hasAttribute('data-collapsed')).toBe(true)

    toggle.click()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(root.hasAttribute('data-collapsed')).toBe(false)
  })

  test('keeps the time, status and notice outside the collapsible part', () => {
    const { root } = setup()
    const body = collapsible(root, collapseToggle(root))

    expect(body.contains(required(root.querySelector('[data-role="time"]'), 'time'))).toBe(false)
    expect(body.contains(required(root.querySelector('[role="status"]'), 'status'))).toBe(false)
    expect(body.contains(required(root.querySelector('[role="alert"]'), 'notice'))).toBe(false)
  })

  test('the location button asks for the location', () => {
    const { root, handlers } = setup()

    button(root, 'Show my location')?.click()

    expect(handlers.onLocate).toHaveBeenCalled()
  })

  test('offers to enter an address instead, with the form closed at first', () => {
    const { root, handlers } = setup()
    const addressButton = required(button(root, 'Enter an address') ?? null, 'address button')
    const form = required(root.querySelector<HTMLFormElement>(`#${addressButton.getAttribute('aria-controls')}`), 'address form')

    expect(addressButton.getAttribute('aria-expanded')).toBe('false')
    expect(form.hidden).toBe(true)
    addressButton.click()
    expect(handlers.onAddressToggle).toHaveBeenCalled()
  })

  test('shows the address form when open and passes on the address typed', () => {
    const { root, handlers, control } = setup()

    control.update(view({ isAddressOpen: true }))
    const input = required(root.querySelector<HTMLInputElement>('input[name="address"]'), 'address field')
    input.value = 'Dam 1'
    input.form?.requestSubmit()

    expect(button(root, 'Enter an address')?.getAttribute('aria-expanded')).toBe('true')
    expect(input.form?.hidden).toBe(false)
    expect(handlers.onAddress).toHaveBeenCalledWith('Dam 1')
  })

  test('opening the address form by its button puts the cursor in the field', () => {
    const { root, handlers, control } = setup()
    const addressButton = required(button(root, 'Enter an address') ?? null, 'address button')
    document.body.append(root)
    handlers.onAddressToggle.mockImplementation(() => control.update(view({ isAddressOpen: true })))

    addressButton.click()

    expect(document.activeElement).toBe(root.querySelector('input[name="address"]'))
  })

  test('closing the form while typing in it returns focus to its button', () => {
    const { root, control } = setup()
    document.body.append(root)
    control.update(view({ isAddressOpen: true }))
    required(root.querySelector<HTMLInputElement>('input[name="address"]'), 'address field').focus()

    control.update(view({ isAddressOpen: false }))

    expect(document.activeElement).toBe(button(root, 'Enter an address'))
  })

  test('the address form folds away with the rest of the controls', () => {
    const { root } = setup()
    const body = collapsible(root, collapseToggle(root))

    expect(body.contains(root.querySelector('form'))).toBe(true)
  })
})
