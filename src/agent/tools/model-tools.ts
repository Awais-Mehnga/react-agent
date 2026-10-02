// GREENFIELD: model → edit strategy (OpenCode registry.ts gating)

import { currentModelId as llmModelId } from '../llm'

export function useApplyPatchOnly(modelId: string): boolean {
  // Codex-style apply_patch only for certain OpenAI GPT ids — not DeepSeek
  return modelId.includes('gpt-') && !modelId.includes('oss') && !modelId.includes('gpt-4')
}

export function currentModelId(): string {
  return llmModelId()
}
