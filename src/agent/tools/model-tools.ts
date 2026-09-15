// GREENFIELD: model → edit strategy (OpenCode registry.ts gating)

export function useApplyPatchOnly(modelId: string): boolean {
  return modelId.includes('gpt-') && !modelId.includes('oss') && !modelId.includes('gpt-4')
}

export function currentModelId(): string {
  return import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'
}
