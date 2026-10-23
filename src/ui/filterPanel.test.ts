// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { EMPTY_SELECTION, type FilterSelection, toggleOption } from '../filters/filters.ts'
import type { FilterGroup } from '../filters/schema.ts'
import { createFilterPanel } from './filterPanel.ts'

const groups: readonly FilterGroup[] = [
  { id: 'program', label: 'Program', options: [{ id: '1485951', label: 'Festival' }] },
  {
    id: 'genre',
    label: 'Genre',
    options: [
      { id: '450', label: 'House', children: [{ id: '449', label: 'Deep House' }] },
      { id: '37', label: 'Techno' },
    ],
  },
  { id: 'type', label: 'Type', options: [{ id: '2592403', label: 'Warehouses' }] },
]

function setup(selection: FilterSelection = EMPTY_SELECTION, matchCount = 12) {
  const handlers = { onToggle: vi.fn(), onSoldOutToggle: vi.fn(), onClear: vi.fn() }
  const panel = createFilterPanel({ groups, ...handlers })
  document.body.append(panel.element)
  panel.update({ selection, matchCount })
  return { panel, handlers, dialog: panel.element }
}

function required<T extends Element>(found: T | null | undefined, what: string): T {
  if (!found) throw new Error(`Missing ${what}`)
  return found
}

const buttonIn = (root: Element, label: string): HTMLButtonElement =>
  required([...root.querySelectorAll('button')].find((element) => element.textContent === label), `button "${label}"`)

const group = (root: Element, label: string): HTMLElement =>
  required(root.querySelector<HTMLElement>(`[role="group"][aria-label="${label}"]`), `group "${label}"`)

describe('createFilterPanel', () => {
  beforeAll(() => {
    // jsdom has no modal dialogs; Playwright covers the real one.
    HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
      this.open = true
    }
    HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
      this.open = false
    }
  })

  beforeEach(() => {
    document.body.replaceChildren()
  })

  test('is a titled dialog with one labelled group of options per ADE filter group', () => {
    const { dialog } = setup()

    expect(dialog.tagName).toBe('DIALOG')
    const titleId = dialog.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(titleId)?.textContent).toBe('Filter events')
    expect(buttonIn(group(dialog, 'Program'), 'Festival')).toBeDefined()
    expect(buttonIn(group(dialog, 'Genre'), 'House')).toBeDefined()
    expect(buttonIn(group(dialog, 'Type'), 'Warehouses')).toBeDefined()
  })

  test('choosing an option asks to toggle it, and a chosen option shows as pressed', () => {
    const { panel, handlers, dialog } = setup()
    const techno = buttonIn(group(dialog, 'Genre'), 'Techno')
    expect(techno.getAttribute('aria-pressed')).toBe('false')

    techno.click()
    panel.update({ selection: toggleOption(EMPTY_SELECTION, 'genre', '37'), matchCount: 3 })

    expect(handlers.onToggle).toHaveBeenCalledWith('genre', '37')
    expect(techno.getAttribute('aria-pressed')).toBe('true')
  })

  test('genre styles sit behind a disclosure, grouped by family', () => {
    const { handlers, dialog } = setup()
    const styles = required(dialog.querySelector('details'), 'styles disclosure')
    expect(styles.querySelector('summary')?.textContent).toBe('Specific styles')

    buttonIn(group(styles, 'House styles'), 'Deep House').click()

    expect(handlers.onToggle).toHaveBeenCalledWith('genre', '449')
    expect(styles.textContent).not.toContain('Techno')
  })

  test('the sold-out switch shows its state and asks to flip it', () => {
    const { panel, handlers, dialog } = setup()
    const soldOut = required(dialog.querySelector<HTMLInputElement>('input[type="checkbox"]'), 'sold-out switch')
    expect(soldOut.labels?.[0]?.textContent).toBe('Hide sold-out events')

    soldOut.click()
    panel.update({ selection: { ...EMPTY_SELECTION, isHidingSoldOut: true }, matchCount: 3 })

    expect(handlers.onSoldOutToggle).toHaveBeenCalled()
    expect(soldOut.checked).toBe(true)
  })

  test('"Clear all" is only on offer when a filter is on', () => {
    const { panel, handlers, dialog } = setup()
    const clear = buttonIn(dialog, 'Clear all')
    expect(clear.disabled).toBe(true)

    panel.update({ selection: toggleOption(EMPTY_SELECTION, 'type', '2592403'), matchCount: 1 })
    clear.click()

    expect(clear.disabled).toBe(false)
    expect(handlers.onClear).toHaveBeenCalled()
  })

  test('the close button says how many events match now and closes the dialog', () => {
    const { panel, dialog } = setup(EMPTY_SELECTION, 1)
    panel.open()
    expect(dialog.open).toBe(true)

    buttonIn(dialog, 'Show 1 event').click()

    expect(dialog.open).toBe(false)
  })

  test('a tap on the backdrop closes the dialog', () => {
    const { panel, dialog } = setup()
    panel.open()

    dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(dialog.open).toBe(false)
  })

  test('a press that starts on a chip and slides off onto the backdrop leaves the dialog open', () => {
    const { panel, dialog } = setup()
    panel.open()

    buttonIn(group(dialog, 'Genre'), 'Techno').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(dialog.open).toBe(true)
  })

  test('the close icon is labelled for screen readers and closes the dialog', () => {
    const { panel, dialog } = setup()
    panel.open()

    required(dialog.querySelector<HTMLButtonElement>('button[aria-label="Close filters"]'), 'close icon').click()

    expect(dialog.open).toBe(false)
  })

  test('any group with nested options gets the styles disclosure, whatever ADE calls it', () => {
    const renamed: readonly FilterGroup[] = [
      { id: 'music', label: 'Music', options: [{ id: '450', label: 'House', children: [{ id: '449', label: 'Deep House' }] }] },
    ]
    const panel = createFilterPanel({ groups: renamed, onToggle: vi.fn(), onSoldOutToggle: vi.fn(), onClear: vi.fn() })

    expect(buttonIn(group(panel.element, 'House styles'), 'Deep House')).toBeDefined()
  })
})
