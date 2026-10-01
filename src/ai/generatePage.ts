import { generateText } from 'ai'
import { createAgentModel } from '../agent/llm'
import { sanitizeHtml } from '../html/sanitize'
import themeCss from '../styles/theme.css?raw'

const SYSTEM = `You generate HTML pages for a visual page builder.

Rules:
- Output ONLY HTML markup. No markdown fences, no explanations, no JSON.
- Use Tailwind utility classes for styling.
- Use semantic HTML (section, header, nav, main, article, footer, h1–h6, p, etc.).
- Do NOT generate JavaScript, <script> tags, or event handlers.
- Do NOT use inline style attributes.
- Do NOT create custom React/Vue components or JSON schemas.
- Prefer theme tokens when relevant (bg-brand, text-ink, bg-surface, rounded-card, etc.).
- Use existing media URLs when provided; otherwise use plausible https image URLs.
- You may use functional stubs as HTML with data-stub attributes:
  data-stub="blog-grid" | "form" | "collection" | "navigation" | "search" | "pagination"
  plus the related data-* fields (data-source, data-limit, data-form-id, etc.) and data-slot / data-field for slots.
- Keep markup clean and production-ready.

Theme CSS (for reference):
${themeCss.slice(0, 2000)}
`

export type GeneratePageOptions = {
  prompt: string
  /** Current full page HTML for context */
  currentHtml?: string
  /** When set, regenerate only this element's outerHTML */
  selectedHtml?: string
  mode?: 'page' | 'section'
}

/** Strict HTML + Tailwind generation. Sanitizes before return. */
export async function generatePage(options: GeneratePageOptions): Promise<string> {
  const mode = options.mode ?? (options.selectedHtml ? 'section' : 'page')
  const userParts: string[] = []

  if (mode === 'section' && options.selectedHtml) {
    userParts.push(
      `Regenerate ONLY the following HTML fragment. Return the replacement fragment only (same root tag if possible).`,
      `Current fragment:\n${options.selectedHtml}`,
      `Instruction: ${options.prompt}`,
    )
  } else {
    userParts.push(`Generate a full page body HTML for: ${options.prompt}`)
    if (options.currentHtml?.trim()) {
      userParts.push(`Current page HTML (for reference / iteration):\n${options.currentHtml}`)
    }
  }

  const { text } = await generateText({
    model: createAgentModel(),
    system: SYSTEM,
    prompt: userParts.join('\n\n'),
  })

  const stripped = text
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  return sanitizeHtml(stripped)
}
