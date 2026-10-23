import { activeFilterCount, type FilterSelection, isOptionChosen } from '../filters/filters.ts'
import type { FilterChoice, FilterGroup } from '../filters/schema.ts'

const TITLE_ID = 'filters-title'
const SOLD_OUT_ID = 'filters-sold-out'

export interface FilterPanelOptions {
  readonly groups: readonly FilterGroup[]
  readonly onToggle: (groupId: string, optionId: string) => void
  readonly onSoldOutToggle: () => void
  readonly onClear: () => void
}

export interface FilterPanelView {
  readonly selection: FilterSelection
  /** Events on at the chosen moment that match, shown on the close button. */
  readonly matchCount: number
}

export interface FilterPanel {
  readonly element: HTMLDialogElement
  open(): void
  update(view: FilterPanelView): void
}

interface Chip {
  readonly element: HTMLButtonElement
  readonly groupId: string
  readonly optionId: string
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag)
  created.className = className
  if (text !== undefined) created.textContent = text
  return created
}

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const created = make('button', className, label)
  created.type = 'button'
  created.addEventListener('click', onClick)
  return created
}

/** A row of pill buttons, labelled for screen readers like the day buttons are. */
function chipRow(label: string, groupId: string, choices: readonly FilterChoice[], onToggle: FilterPanelOptions['onToggle']) {
  const row = make('div', 'chips')
  row.setAttribute('role', 'group')
  row.setAttribute('aria-label', label)
  const chips = choices.map((choice) => ({
    element: button('day chip', choice.label, () => onToggle(groupId, choice.id)),
    groupId,
    optionId: choice.id,
  }))
  row.append(...chips.map((chip) => chip.element))
  return { row, chips }
}

/** Genre families are one tap; their ~90 styles fold away so the phone view stays short. */
function genreStyles(group: FilterGroup, onToggle: FilterPanelOptions['onToggle']) {
  const details = make('details', 'filters__styles')
  details.append(make('summary', 'filters__summary', 'Specific styles'))
  const rows = group.options
    .filter((option) => option.children !== undefined)
    .map((family) => {
      const { row, chips } = chipRow(`${family.label} styles`, group.id, family.children ?? [], onToggle)
      details.append(make('h4', 'filters__family', family.label), row)
      return chips
    })
  return { details, chips: rows.flat() }
}

function groupSection(group: FilterGroup, onToggle: FilterPanelOptions['onToggle']) {
  const section = make('section', 'filters__group')
  const { row, chips } = chipRow(group.label, group.id, group.options, onToggle)
  section.append(make('h3', 'filters__heading', group.label), row)
  const hasStyles = group.options.some((option) => option.children !== undefined)
  if (!hasStyles) return { section, chips }
  const styles = genreStyles(group, onToggle)
  section.append(styles.details)
  return { section, chips: [...chips, ...styles.chips] }
}

function soldOutSwitch(onChange: () => void) {
  const input = make('input', 'switch__input')
  input.type = 'checkbox'
  input.id = SOLD_OUT_ID
  input.setAttribute('role', 'switch')
  input.addEventListener('change', onChange)
  const label = make('label', 'switch__label', 'Hide sold-out events')
  label.htmlFor = SOLD_OUT_ID
  const row = make('div', 'switch')
  row.append(input, label)
  return { row, input }
}

/** ADE's program filters (Program, Genre, Type, sold out) in a modal dialog. */
export function createFilterPanel(options: FilterPanelOptions): FilterPanel {
  const dialog = make('dialog', 'filters')
  dialog.setAttribute('aria-labelledby', TITLE_ID)

  const title = make('h2', 'filters__title', 'Filter events')
  title.id = TITLE_ID
  const closeIcon = button('filters__close', '', () => dialog.close())
  closeIcon.setAttribute('aria-label', 'Close filters')
  const header = make('header', 'filters__header')
  header.append(title, closeIcon)

  const sections = options.groups.map((group) => groupSection(group, options.onToggle))
  const chips: readonly Chip[] = sections.flatMap((section) => section.chips)
  const soldOut = soldOutSwitch(options.onSoldOutToggle)
  const body = make('div', 'filters__body')
  body.append(...sections.map((section) => section.section), soldOut.row)

  const clear = button('action', 'Clear all', options.onClear)
  const show = button('action action--now', '', () => dialog.close())
  const footer = make('footer', 'filters__footer')
  footer.append(clear, show)

  dialog.append(header, body, footer)
  // A tap on the dimmed backdrop lands on the dialog itself, not its content: close, like ADE's panel.
  // Only when the press also started there: a drag from a chip ends with a click on the dialog too.
  let isPressOnBackdrop = false
  dialog.addEventListener('mousedown', (event) => {
    isPressOnBackdrop = event.target === dialog
  })
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && isPressOnBackdrop) dialog.close()
  })

  return {
    element: dialog,
    open() {
      if (!dialog.open) dialog.showModal()
    },
    update({ selection, matchCount }) {
      chips.forEach((chip) => chip.element.setAttribute('aria-pressed', String(isOptionChosen(selection, chip.groupId, chip.optionId))))
      soldOut.input.checked = selection.isHidingSoldOut
      clear.disabled = activeFilterCount(selection) === 0
      show.textContent = `Show ${matchCount} event${matchCount === 1 ? '' : 's'}`
    },
  }
}
