import { generateText } from 'ai'
import { createAgentModel } from '../agent/llm'
import { normalizePageHtml } from '../html/normalizePageHtml'
import themeCss from '../styles/theme.css?raw'
import pageDesignSkill from '../agent/skills/page-design.md?raw'

const SYSTEM = `You generate HTML fragments for a visual page builder canvas.

${pageDesignSkill.trim()}

Additional generator rules:
- Output ONLY a body HTML fragment. No markdown fences, no explanations, no JSON.
- Never output <!DOCTYPE>, <html>, <head>, <body>, <link>, or style.css references.
- Use Tailwind utilities + theme tokens from the theme CSS below.
- No JavaScript, scripts, event handlers, or inline style attributes.

Theme CSS (for reference):
${themeCss.slice(0, 2500)}
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
    userParts.push(
      `Generate a full page BODY FRAGMENT (sections only) for: ${options.prompt}`,
      `Remember: no DOCTYPE/html/head/body/link. No FunZone templates. No 3-feature card kits. Update-worthy creative direction.`,
    )
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

  return normalizePageHtml(stripped)
}
