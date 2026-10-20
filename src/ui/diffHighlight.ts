// PORT: lightweight Shiki highlighter for unified diffs (OpenCode uses shiki in UI)

import { createHighlighter, type Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: ['html', 'css', 'diff', 'plaintext'],
    })
  }
  return highlighterPromise
}

function langForPath(path: string): string {
  if (/\.css$/i.test(path)) return 'css'
  if (/\.html?$/i.test(path)) return 'html'
  return 'diff'
}

/** Render a unified diff string with Shiki; falls back to escaped plain text. */
export async function highlightDiff(patch: string, path = ''): Promise<string> {
  try {
    const highlighter = await getHighlighter()
    return highlighter.codeToHtml(patch, {
      lang: patch.startsWith('---') || patch.startsWith('diff') ? 'diff' : langForPath(path),
      theme: 'github-dark',
    })
  } catch {
    return `<pre class="diff-fallback">${escapeHtml(patch)}</pre>`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Sync-friendly React-ready line coloring without waiting for Shiki. */
export function colorizeDiffLines(patch: string): Array<{ type: 'add' | 'del' | 'meta' | 'ctx'; text: string }> {
  return patch.split('\n').map((line) => {
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'add' as const, text: line }
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'del' as const, text: line }
    if (line.startsWith('@@') || line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      return { type: 'meta' as const, text: line }
    }
    return { type: 'ctx' as const, text: line }
  })
}
