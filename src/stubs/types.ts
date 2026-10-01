export type StubField = {
  key: string
  label: string
  type: 'text' | 'number' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export type StubDefinition = {
  id: string
  label: string
  fields: StubField[]
}
