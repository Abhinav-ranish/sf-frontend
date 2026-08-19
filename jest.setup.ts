import '@testing-library/jest-dom'

/**
 * `jest-fixed-jsdom` keeps Node's undici globals (so MSW can intercept), and
 * undici's `FormData` refuses to be constructed from a `<form>` element:
 *
 *     new FormData(form)  ->  TypeError: Argument 1 could not be converted
 *
 * React 19 does exactly that when a form `action` fires, which would make every
 * form test throw. Bridge the gap by reading the form's controls ourselves.
 */
const NativeFormData = globalThis.FormData

class FormAwareFormData extends NativeFormData {
  constructor(form?: HTMLFormElement) {
    super()
    if (!form) return

    for (const element of Array.from(form.elements)) {
      const control = element as HTMLInputElement & {
        selectedOptions?: HTMLCollectionOf<HTMLOptionElement>
      }
      if (!control.name || control.disabled) continue

      switch (control.type) {
        case 'button':
        case 'submit':
        case 'reset':
          break
        case 'checkbox':
        case 'radio':
          if (control.checked) this.append(control.name, control.value || 'on')
          break
        case 'file':
          for (const file of Array.from(control.files ?? [])) {
            this.append(control.name, file)
          }
          break
        case 'select-multiple':
          for (const option of Array.from(control.selectedOptions ?? [])) {
            this.append(control.name, option.value)
          }
          break
        default:
          this.append(control.name, control.value)
      }
    }
  }
}

globalThis.FormData = FormAwareFormData as unknown as typeof FormData
