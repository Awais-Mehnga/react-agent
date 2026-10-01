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
## Page builder contract

- Workspace files: **only** \`page.html\` and \`theme.css\`. Never create other paths.
- Apply all page/theme changes with tools. The canvas updates live from those files.
- **Never** paste HTML or CSS into the chat reply. No markdown code fences with markup.
- Chat replies are short status only (what you changed and why).
- Follow the design skill below on every visual change.

## Design skill

${pageDesignSkill.trim()}

## Current workspace files

${listing}
`
}
