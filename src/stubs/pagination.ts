import type { StubDefinition } from './types'

export const pagination: StubDefinition = {
  id: 'pagination',
  label: 'Pagination',
  fields: [
    { key: 'data-source', label: 'Source', type: 'text', placeholder: 'posts' },
    { key: 'data-per-page', label: 'Per page', type: 'number', placeholder: '10' },
  ],
}
