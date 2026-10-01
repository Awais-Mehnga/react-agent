import { blogGrid } from './blogGrid'
import { collection } from './collection'
import { form } from './form'
import { navigation } from './navigation'
import { pagination } from './pagination'
import { search } from './search'
import type { StubDefinition } from './types'

export type { StubDefinition, StubField } from './types'

export const stubRegistry: Record<string, StubDefinition> = {
  [blogGrid.id]: blogGrid,
  [form.id]: form,
  [collection.id]: collection,
  [navigation.id]: navigation,
  [search.id]: search,
  [pagination.id]: pagination,
}

export function getStubDefinition(stubId: string | null | undefined): StubDefinition | null {
  if (!stubId) return null
  return stubRegistry[stubId] ?? null
}

export function findStubRoot(el: Element | null): Element | null {
  if (!el) return null
  return el.closest('[data-stub]')
}
