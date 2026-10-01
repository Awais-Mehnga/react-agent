import type { StubDefinition } from './types'

export const collection: StubDefinition = {
  id: 'collection',
  label: 'Collection',
  fields: [
    { key: 'data-source', label: 'Source', type: 'text', placeholder: 'items' },
    { key: 'data-limit', label: 'Limit', type: 'number', placeholder: '12' },
  ],
}
