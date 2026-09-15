// ADAPT: todowrite against Zustand (no OpenCode DB)

import { z } from 'zod'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/todowrite.txt?raw'
import { newTodoId, type TodoItem } from '../session/store'

const todoSchema = z.object({
  id: z.string().optional(),
  content: z.string().describe('Brief description of the task'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .describe('Current status of the task'),
  priority: z.enum(['high', 'medium', 'low']).default('medium').describe('Priority level'),
})

export const todowriteTool: AgentToolDef = {
  id: 'todowrite',
  description: description.trim(),
  parameters: z.object({
    todos: z.array(todoSchema).describe('The updated todo list'),
  }),
  execute: async (args, ctx) => {
    const { todos } = args as {
      todos: Array<{
        id?: string
        content: string
        status: TodoItem['status']
        priority?: TodoItem['priority']
      }>
    }

    const normalized: TodoItem[] = todos.map((t) => ({
      id: t.id || newTodoId(),
      content: t.content,
      status: t.status,
      priority: t.priority ?? 'medium',
    }))

    const inProgress = normalized.filter((t) => t.status === 'in_progress')
    if (inProgress.length > 1) {
      throw new Error('Keep exactly one todo in_progress at a time.')
    }

    ctx.setTodos(normalized)
    const open = normalized.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length
    return {
      title: `${open} todos`,
      output: JSON.stringify(normalized, null, 2),
    }
  },
}
