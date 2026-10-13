// ADAPT: system prompt for HTML/CSS page builder workspace

import gptPrompt from '../vendor/opencode/prompts/gpt.txt?raw'
import pageDesignSkill from '../skills/page-design.md?raw'
import { currentModelId, useApplyPatchOnly } from '../tools/model-tools'
import type { CanvasSelection } from '../../editor/Canvas'

export function buildSystemPrompt(filePaths: string[], selectedElement?: CanvasSelection | null): string {
  const listing = filePaths.length === 0 ? '(empty workspace)' : filePaths.map((p) => `- ${p}`).join('\n')
  const patchHint = useApplyPatchOnly(currentModelId())
    ? '\n- For file edits use `apply_patch` (not edit/write).\n'
    : '\n- CRITICAL FILE EDITING RULE: Always `read` first, then use `edit` to make surgical, targeted text replacements. NEVER rewrite an entire file from scratch using `write` when updating existing code. Use `write` only when creating an entirely new file for the first time.\n'

  const selectionBlock = selectedElement
    ? `\n## Active visual element selection
The user has currently selected this specific element in the visual canvas:
<selected_element>
Tag: <${selectedElement.tagName}>
Classes: "${selectedElement.className}"
HTML:
${selectedElement.outerHtml.slice(0, 800)}
${selectedElement.stubId ? `Stub: ${selectedElement.stubId}\n` : ''}</selected_element>
IMPORTANT: When the user's prompt says "this", "it", "the selected element", "the button", "the headline", or requests to edit/style/modify an element, they are referring to this selected element. Use \`read\` and surgical \`edit\` to target this element in \`page.html\` or its classes directly.\n`
    : ''

  return `${gptPrompt.trim()}
${patchHint}
${selectionBlock}
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

