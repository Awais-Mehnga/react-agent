// ADAPT: system prompt for HTML/CSS page builder workspace

import gptPrompt from '../vendor/opencode/prompts/gpt.txt?raw'
import pageDesignSkill from '../skills/page-design.md?raw'
import { currentModelId, useApplyPatchOnly } from '../tools/model-tools'

export function buildSystemPrompt(filePaths: string[]): string {
  const listing = filePaths.length === 0 ? '(empty workspace)' : filePaths.map((p) => `- ${p}`).join('\n')
  const patchHint = useApplyPatchOnly(currentModelId())
    ? '\n- For file edits use `apply_patch` (not edit/write).\n'
    : '\n- For file edits prefer `edit` after `read`; use `write` only for intentional full-file replacement of `page.html` or `theme.css`.\n'

  return `${gptPrompt.trim()}
${patchHint}
## Page builder contract (read carefully)

You are building pages inside a **visual HTML/Tailwind editor**, not a static site scaffold.

- Workspace files: **only** \`page.html\` and \`theme.css\`. Never create \`style.css\`, \`index.html\`, or other paths.
- \`page.html\` must be a **body fragment** (\`<section>\` / \`<main>\` …). Never emit \`<!DOCTYPE>\`, \`<html>\`, \`<head>\`, \`<body>\`, \`<link>\`, or external CSS files.
- Apply changes with tools only. The canvas previews \`page.html\` live.
- **Never** paste HTML or CSS into the chat. No markdown code fences with markup.
- Chat replies: short status only (direction + what changed).
- On any landing / redesign / “make a page” request: follow the design skill **exactly**. Reject FunZone-style templates, 3-feature grids, and bounce animations.
- When the brief is vague (“fun”, “cool”, “animated”), invent a **specific** product/world and commit to a palette in \`theme.css\` before writing HTML.

## Design skill

${pageDesignSkill.trim()}

## Current workspace files

${listing}
`
}
