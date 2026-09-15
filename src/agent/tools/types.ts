// GREENFIELD: tool types inspired by opencode tool/tool.ts (no Effect).

import type { VirtualFS } from '../fs/types'
import type { ZodType } from 'zod'
import type { LastDiff, QuestionPrompt, TodoItem } from '../session/store'

export type ToolContext = {
  fs: VirtualFS
  wasRead: (path: string) => boolean
  markRead: (path: string) => void
  abort: AbortSignal
  pushUndo: (path: string, before: string | null) => void
  setLastDiff: (diff: LastDiff | null) => void
  setTodos: (todos: TodoItem[]) => void
  askQuestion: (questions: QuestionPrompt[]) => Promise<string[][]>
}

export type ToolResult = {
  output: string
  title?: string
}

export type AgentToolDef<T = unknown> = {
  id: string
  description: string
  parameters: ZodType<T>
  execute: (args: T, ctx: ToolContext) => Promise<ToolResult>
}
