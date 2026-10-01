import type { StubDefinition } from './types'

export const search: StubDefinition = {
  id: 'search',
  label: 'Search',
  fields: [
    { key: 'data-scope', label: 'Scope', type: 'text', placeholder: 'site' },
    { key: 'data-placeholder', label: 'Placeholder', type: 'text', placeholder: 'Search…' },
  ],
}
