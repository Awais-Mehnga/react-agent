// ADAPT: system prompt from vendored gpt.txt + runtime workspace listing

import gptPrompt from '../vendor/opencode/prompts/gpt.txt?raw'
import { currentModelId, useApplyPatchOnly } from '../tools/model-tools'

export function buildSystemPrompt(filePaths: string[]): string {
  const listing = filePaths.length === 0 ? '(empty workspace)' : filePaths.map((p) => `- ${p}`).join('\n')
  const patchHint = useApplyPatchOnly(currentModelId())
    ? '\n- For file edits use `apply_patch` (not edit/write).\n'
    : '\n- For file edits prefer `edit`; use `write` only for new/full files.\n'

  return `${gptPrompt.trim()}
${patchHint}
- Use \`webfetch\` / \`websearch\` for external docs and web research.
- For multi-step research or exploration, use the \`task\` tool (explore or general subagent).
- MCP tools (if connected) appear as \`mcp__server__tool\` names.

## Current workspace files

${listing}
`
}
