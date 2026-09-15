// ADAPT: nested subagent (no recursive task tool)

import { z } from 'zod'
import { isStepCount, streamText } from 'ai'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/task.txt?raw'
import explorePrompt from '../vendor/opencode/agent/explore.txt?raw'
import { createAgentModel } from '../llm'
import { buildSystemPrompt } from '../prompts/system'

export const taskTool: AgentToolDef = {
  id: 'task',
  description: description.trim(),
  parameters: z.object({
    prompt: z.string().describe('Detailed task for the subagent'),
    subagent_type: z.enum(['explore', 'general']).describe('Which subagent to use'),
  }),
  execute: async (args, ctx) => {
    const { prompt, subagent_type } = args as {
      prompt: string
      subagent_type: 'explore' | 'general'
    }

    // Dynamic import avoids circular dependency with registry.ts
    const { createToolSet } = await import('./registry')
    const tools = createToolSet(ctx, undefined, { exclude: ['task'], includeMcp: true })
    const system =
      subagent_type === 'explore'
        ? `${explorePrompt.trim()}\n\n${buildSystemPrompt(ctx.fs.list())}`
        : `You are a general coding subagent. Complete the task and return one final summary message.\n\n${buildSystemPrompt(ctx.fs.list())}`

    const result = streamText({
      model: createAgentModel(),
      system,
      prompt,
      tools,
      stopWhen: isStepCount(10),
      abortSignal: ctx.abort,
    })

    const text = await result.text
    return {
      title: `${subagent_type} subagent`,
      output: text.trim() || 'Subagent finished with no text output.',
    }
  },
}
