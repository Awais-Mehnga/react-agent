// GREENFIELD: LLM client via Vite proxy (keys stay server-side)
// DeepSeek is OpenAI-compatible — use @ai-sdk/openai against /api/deepseek

import { createOpenAI } from '@ai-sdk/openai'

export type LlmProvider = 'deepseek' | 'openai'
export type ModelPurpose = 'code' | 'reading' | 'small' | 'title' | 'compaction' | 'explore'

export function currentProvider(): LlmProvider {
  const raw = (import.meta.env.VITE_LLM_PROVIDER || 'deepseek').toLowerCase()
  return raw === 'openai' ? 'openai' : 'deepseek'
}

/** OpenCode-style small model resolver for auxiliary tasks (titles, summaries, compaction, exploration) */
export function getSmallModelId(): string {
  const provider = currentProvider()
  if (provider === 'deepseek') {
    return (
      import.meta.env.VITE_DEEPSEEK_SMALL_MODEL ||
      import.meta.env.VITE_DEEPSEEK_READING_MODEL ||
      'deepseek-chat'
    )
  }
  return import.meta.env.VITE_OPENAI_SMALL_MODEL || 'gpt-4o-mini'
}

export function currentModelId(purpose: ModelPurpose = 'code'): string {
  const provider = currentProvider()
  const isAuxiliary =
    purpose === 'reading' ||
    purpose === 'small' ||
    purpose === 'title' ||
    purpose === 'compaction' ||
    purpose === 'explore'

  if (isAuxiliary) {
    return getSmallModelId()
  }

  if (provider === 'deepseek') {
    return import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat'
  }
  return import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'
}

export function createAgentModel(purpose: ModelPurpose = 'code', modelId?: string) {
  const provider = currentProvider()
  const targetModelId = modelId ?? currentModelId(purpose)
  const openai = createOpenAI({
    baseURL: provider === 'deepseek' ? '/api/deepseek' : '/api/openai',
    apiKey: 'proxy', // required by SDK; real key injected by Vite proxy
  })
  return openai(targetModelId)
}
