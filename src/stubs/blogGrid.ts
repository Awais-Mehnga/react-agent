import type { StubDefinition } from './types'

export const blogGrid: StubDefinition = {
  id: 'blog-grid',
  label: 'Blog Grid',
  fields: [
    { key: 'data-source', label: 'Source', type: 'text', placeholder: 'posts' },
    { key: 'data-limit', label: 'Limit', type: 'number', placeholder: '6' },
    { key: 'data-category', label: 'Category', type: 'text', placeholder: 'all' },
  ],
}
