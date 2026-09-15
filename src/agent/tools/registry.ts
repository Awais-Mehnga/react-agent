// GREENFIELD: register Phase 1 tools and convert to AI SDK tools

import { tool, type ToolSet } from 'ai'
import type { AgentToolDef, ToolContext } from './types'
import { readTool } from './read'
import { editTool } from './edit'
import { writeTool } from './write'
import { globTool } from './glob'
import { grepTool } from './grep'

const builtins: AgentToolDef[] = [readTool, editTool, writeTool, globTool, grepTool]

export function createToolSet(ctx: ToolContext): ToolSet {
  const tools: ToolSet = {}
  for (const def of builtins) {
    tools[def.id] = tool({
      description: def.description,
      inputSchema: def.parameters,
      execute: async (input) => {
        const result = await def.execute(input, ctx)
        return result.output
      },
    })
  }
  return tools
}

export function listToolIds(): string[] {
  return builtins.map((t) => t.id)
}
