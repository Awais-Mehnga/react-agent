// GREENFIELD: register Phase 1–3 tools and convert to AI SDK tools

import { tool, type ToolSet } from 'ai'
import type { AgentToolDef, ToolContext } from './types'
import { readTool } from './read'
import { editTool } from './edit'
import { writeTool } from './write'
import { globTool } from './glob'
import { grepTool } from './grep'
import { todowriteTool } from './todowrite'
import { questionTool } from './question'
import { applyPatchTool } from './apply_patch'
import { webfetchTool } from './webfetch'
import { websearchTool } from './websearch'
import { taskTool } from './task'
import { currentModelId, useApplyPatchOnly } from './model-tools'
import { useAgentStore } from '../session/store'

const allBuiltins: AgentToolDef[] = [
  readTool,
  editTool,
  writeTool,
  applyPatchTool,
  globTool,
  grepTool,
  todowriteTool,
  questionTool,
  webfetchTool,
  websearchTool,
  taskTool,
]

export type DoomGuard = (toolName: string, input: unknown) => void

export type CreateToolSetOptions = {
  exclude?: string[]
  includeMcp?: boolean
  modelId?: string
}

export function createToolSet(
  ctx: ToolContext,
  doomGuard?: DoomGuard,
  options: CreateToolSetOptions = {},
): ToolSet {
  const modelId = options.modelId ?? currentModelId()
  const patchOnly = useApplyPatchOnly(modelId)
  const exclude = new Set(options.exclude ?? [])

  const builtins = allBuiltins.filter((def) => {
    if (exclude.has(def.id)) return false
    if (patchOnly) {
      if (def.id === 'edit' || def.id === 'write') return false
    } else if (def.id === 'apply_patch') {
      return false
    }
    return true
  })

  const tools: ToolSet = {}
  for (const def of builtins) {
    tools[def.id] = tool({
      description: def.description,
      inputSchema: def.parameters,
      execute: async (input) => {
        doomGuard?.(def.id, input)
        const result = await def.execute(input, ctx)
        return result.output
      },
    })
  }

  if (options.includeMcp !== false) {
    Object.assign(tools, useAgentStore.getState().mcpToolDefs)
  }

  return tools
}

export function listToolIds(): string[] {
  return allBuiltins.map((t) => t.id)
}
