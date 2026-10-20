import { sanitizeHtml } from './sanitize'

const EID_ATTR = 'data-eid'

export { EID_ATTR }

/** Strip only script/event handlers for live stream previews (DOMPurify is too aggressive on partial HTML). */
function lightStrip(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<script[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
}

/** Parse HTML fragment into a document body, assign temporary data-eid ids. */
export function parseHtml(
  html: string,
  opts?: { sanitize?: boolean },
): { doc: Document; bodyHtml: string } {
  const clean = opts?.sanitize === false ? lightStrip(html) : sanitizeHtml(html)
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
