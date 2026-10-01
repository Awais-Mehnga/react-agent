import type { StubDefinition } from './types'

export const form: StubDefinition = {
  id: 'form',
  label: 'Form',
  fields: [
    { key: 'data-form-id', label: 'Form', type: 'text', placeholder: 'contact' },
    { key: 'data-success', label: 'Success', type: 'text', placeholder: '/thank-you' },
  ],
}
