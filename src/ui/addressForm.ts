import { MAX_ADDRESS_LENGTH } from '../map/geocode.ts'

export const ADDRESS_FORM_ID = 'address-form'
const INPUT_ID = 'address-input'
const SUBMIT_LABEL = 'Find'
const BUSY_LABEL = 'Finding…'

export interface AddressFormOptions {
  readonly onSubmit: (address: string) => void
}

export interface AddressFormView {
  readonly isOpen: boolean
  readonly isFinding: boolean
}

export interface AddressForm {
  readonly element: HTMLFormElement
  update(view: AddressFormView): void
  focus(): void
}

/** Lets visitors who keep their location off type where they are instead. */
export function createAddressForm(options: AddressFormOptions): AddressForm {
  const label = document.createElement('label')
  label.className = 'address__label'
  label.htmlFor = INPUT_ID
  label.textContent = 'Your address'

  const input = document.createElement('input')
  input.className = 'address__input'
  input.id = INPUT_ID
  input.name = 'address'
  input.type = 'text'
  // Where you are now, not a saved home address (often abroad, which can't match in Amsterdam).
  input.autocomplete = 'off'
  // Some spellcheckers send what you type to a server; an address should only go to the lookup.
  input.spellcheck = false
  input.autocapitalize = 'off'
  input.enterKeyHint = 'search'
  input.maxLength = MAX_ADDRESS_LENGTH
  input.placeholder = 'e.g. Dam 1 or your hotel’s street'

  const submit = document.createElement('button')
  submit.className = 'action action--now'
  submit.type = 'submit'
  submit.textContent = SUBMIT_LABEL

  const row = document.createElement('div')
  row.className = 'address__row'
  row.append(input, submit)

  const hint = document.createElement('p')
  hint.className = 'address__hint'
  hint.textContent = 'Your address is sent to OpenStreetMap to find it on the map. It isn’t saved here.'

  const element = document.createElement('form')
  element.className = 'address'
  element.id = ADDRESS_FORM_ID
  element.noValidate = true
  element.hidden = true
  element.append(label, row, hint)

  let isFinding = false
  element.addEventListener('submit', (event) => {
    event.preventDefault()
    const address = input.value.trim()
    if (isFinding) return
    if (!address) {
      input.focus()
      return
    }
    options.onSubmit(address)
  })

  return {
    element,
    update(view) {
      isFinding = view.isFinding
      element.hidden = !view.isOpen
      // aria-disabled, not disabled: disabling the focused button would drop a keyboard user's focus.
      submit.setAttribute('aria-disabled', String(view.isFinding))
      submit.textContent = view.isFinding ? BUSY_LABEL : SUBMIT_LABEL
    },
    focus() {
      input.focus()
    },
  }
}
