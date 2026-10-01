import { EID_ATTR } from './parser'

/** Serialize body HTML, stripping editor-only attributes. */
export function serializeHtml(root: ParentNode): string {
  const clone = (root instanceof Document ? root.body : root).cloneNode(true) as HTMLElement
  clone.querySelectorAll(`[${EID_ATTR}]`).forEach((el) => {
    el.removeAttribute(EID_ATTR)
    el.removeAttribute('data-pb-hover')
    el.removeAttribute('data-pb-selected')
    el.removeAttribute('contenteditable')
  })
  return clone.innerHTML.trim()
}

/** Extract unique Tailwind class candidates from HTML for compile-on-save. */
export function extractClassCandidates(html: string): string[] {
  const set = new Set<string>()
  const re = /\bclass\s*=\s*["']([^"']*)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    for (const token of m[1].split(/\s+/)) {
      if (token) set.add(token)
    }
  }
  return [...set]
}
