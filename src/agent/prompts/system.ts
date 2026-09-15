// ADAPT: system prompt from vendored gpt.txt + runtime workspace listing

import gptPrompt from '../vendor/opencode/prompts/gpt.txt?raw'

export function buildSystemPrompt(filePaths: string[]): string {
  const listing = filePaths.length === 0 ? '(empty workspace)' : filePaths.map((p) => `- ${p}`).join('\n')
  return `${gptPrompt.trim()}

## Current workspace files

${listing}
`
}
