/** Text tags that support double-click contentEditable editing. */
export const TEXT_EDITABLE_TAGS = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'P',
  'SPAN',
  'A',
  'BUTTON',
  'LI',
  'LABEL',
  'FIGCAPTION',
  'BLOCKQUOTE',
  'STRONG',
  'EM',
  'SMALL',
])

export function isTextEditable(el: Element): boolean {
  return TEXT_EDITABLE_TAGS.has(el.tagName)
}
