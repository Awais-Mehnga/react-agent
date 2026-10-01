import { sanitizeHtml } from './sanitize'

const EID_ATTR = 'data-eid'

export { EID_ATTR }

/** Parse HTML fragment into a document body, assign temporary data-eid ids. */
export function parseHtml(html: string): { doc: Document; bodyHtml: string } {
  const clean = sanitizeHtml(html)
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html')
  let i = 0
  doc.body.querySelectorAll('*').forEach((el) => {
    el.setAttribute(EID_ATTR, String(++i))
  })
  return { doc, bodyHtml: doc.body.innerHTML }
}

export function findByEid(doc: Document, eid: string): Element | null {
  return doc.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`)
}
