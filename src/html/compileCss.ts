import themeCss from '../styles/theme.css?raw'
import { extractClassCandidates } from './serializer'

export type SavedPage = {
  html: string
  css: string
  theme: string
}

/** Compile used Tailwind utilities via Vite endpoint; return theme.css raw + css. */
export async function compilePageCss(html: string): Promise<SavedPage> {
  const candidates = extractClassCandidates(html)
  const res = await fetch('/api/compile-css', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidates, theme: themeCss }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `compile failed (${res.status})`)
  }
  const data = (await res.json()) as { css: string }
  return {
    html,
    css: data.css,
    theme: themeCss,
  }
}
