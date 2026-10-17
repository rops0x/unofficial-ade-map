// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { MAX_ADDRESS_LENGTH } from '../map/geocode.ts'
import { createAddressForm } from './addressForm.ts'

function setup() {
  const onSubmit = vi.fn()
  const form = createAddressForm({ onSubmit })
  document.body.append(form.element)
  form.update({ isOpen: true, isFinding: false })
  const input = form.element.querySelector('input')!
  const submit = form.element.querySelector<HTMLButtonElement>('button[type="submit"]')!
  return { form, onSubmit, input, submit }
}

describe('createAddressForm', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  test('has a labelled address field', () => {
    const { input } = setup()

    expect(input.labels?.[0]?.textContent).toBe('Your address')
    expect(input.maxLength).toBe(MAX_ADDRESS_LENGTH)
  })

  test('does not offer a saved home address or send typing to a spellchecker', () => {
    const { input } = setup()

    expect(input.autocomplete).toBe('off')
    expect(input.spellcheck).toBe(false)
  })

  test('submits the trimmed address', () => {
    const { onSubmit, input, submit } = setup()

    input.value = '  Dam 1  '
    submit.click()

    expect(onSubmit).toHaveBeenCalledWith('Dam 1')
  })

  test('does not submit a blank address', () => {
    const { onSubmit, input, submit } = setup()

    input.value = '   '
    submit.click()

    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('while finding, shows it is busy and does not submit again', () => {
    const { form, onSubmit, input, submit } = setup()

    form.update({ isOpen: true, isFinding: true })
    input.value = 'Dam 1'
    form.element.requestSubmit()

    // aria-disabled rather than disabled, so a keyboard user's focus stays on the button.
    expect(submit.getAttribute('aria-disabled')).toBe('true')
    expect(submit.textContent).toBe('Finding…')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('is hidden when closed, without taking focus when it opens', () => {
    const { form, input } = setup()

    form.update({ isOpen: false, isFinding: false })
    expect(form.element.hidden).toBe(true)

    form.update({ isOpen: true, isFinding: false })
    expect(form.element.hidden).toBe(false)
    expect(document.activeElement).not.toBe(input)
  })

  test('focus puts the cursor in the field', () => {
    const { form, input } = setup()

    form.focus()

    expect(document.activeElement).toBe(input)
  })

  test('says where the address is sent', () => {
    const { form } = setup()

    expect(form.element.textContent).toContain('sent to OpenStreetMap')
  })
})
