import { sanitizeHtml } from './sanitize'

/** Strip document chrome / fences without DOMPurify — safe for partial stream fragments. */
export function stripPageChrome(raw: string): string {
  let html = raw.trim()

  html = html
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  // Live streams often open <body> long before </body> — take everything after <body …>
  const bodyOpen = html.match(/<body\b[^>]*>/i)
  if (bodyOpen) {
    const start = html.indexOf(bodyOpen[0]) + bodyOpen[0].length
    const closeIdx = html.search(/<\/body>/i)
    html = (closeIdx >= 0 ? html.slice(start, closeIdx) : html.slice(start)).trim()
    return html.replace(/<link\b[^>]*>/gi, '')
  }

  // Still inside <head> of a full document — nothing paintable yet (caller should keep prior preview)
  if (/<(?:!DOCTYPE|html|head)\b/i.test(html) && !/<(?:section|main|header|footer|article|div|h1|nav)\b/i.test(html)) {
    return ''
  }

  html = html
    .replace(/<!DOCTYPE[\s\S]*?>/i, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim()

  return html.replace(/<link\b[^>]*>/gi, '')
}

/** Normalize agent output into a canvas-safe body fragment. */
export function normalizePageHtml(raw: string, opts?: { sanitize?: boolean }): string {
  const html = stripPageChrome(raw)
  if (opts?.sanitize === false) return html
  return sanitizeHtml(html)
}
