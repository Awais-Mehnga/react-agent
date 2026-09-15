// GREENFIELD: OpenAI client via Vite /api/openai proxy (key stays server-side)

import { createOpenAI } from '@ai-sdk/openai'

export function createAgentModel(modelId = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini') {
  const openai = createOpenAI({
    // PORT: browser talks to Vite proxy; Authorization injected in vite.config.ts
    baseURL: '/api/openai',
    apiKey: 'proxy', // required by SDK; real key never sent from the browser
  })
  return openai(modelId)
}
