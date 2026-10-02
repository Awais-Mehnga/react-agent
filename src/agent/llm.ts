// GREENFIELD: LLM client via Vite proxy (keys stay server-side)
// DeepSeek is OpenAI-compatible — use @ai-sdk/openai against /api/deepseek

import { createOpenAI } from '@ai-sdk/openai'

export type LlmProvider = 'deepseek' | 'openai'

export function currentProvider(): LlmProvider {
  const raw = (import.meta.env.VITE_LLM_PROVIDER || 'deepseek').toLowerCase()
  return raw === 'openai' ? 'openai' : 'deepseek'
}

export function currentModelId(): string {
  const provider = currentProvider()
  if (provider === 'deepseek') {
    return import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-v4-pro'
  }
  return import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'
}

export function createAgentModel(modelId = currentModelId()) {
  const provider = currentProvider()
  const openai = createOpenAI({
    baseURL: provider === 'deepseek' ? '/api/deepseek' : '/api/openai',
    apiKey: 'proxy', // required by SDK; real key injected by Vite proxy
  })
  return openai(modelId)
}
