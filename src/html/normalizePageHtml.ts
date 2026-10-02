import { sanitizeHtml } from './sanitize'

/** Normalize agent output into a canvas-safe body fragment. */
export function normalizePageHtml(raw: string): string {
  let html = raw.trim()

  html = html
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  // Drop full documents down to body contents when present
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch?.[1]) {
    html = bodyMatch[1].trim()
  } else {
    html = html
      .replace(/<!DOCTYPE[\s\S]*?>/i, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      .trim()
  }

  // External stylesheets are never part of this builder
  html = html.replace(/<link\b[^>]*>/gi, '')

  return sanitizeHtml(html)
}
