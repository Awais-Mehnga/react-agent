// ADAPT: thin wrapper around VirtualFS; description from vendor read.txt

import { z } from 'zod'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/read.txt?raw'

export const readTool: AgentToolDef = {
  id: 'read',
  description: description.trim(),
  parameters: z.object({
    filePath: z.string().describe('Workspace path to read'),
    offset: z.number().optional().describe('1-indexed start line'),
    limit: z.number().optional().describe('Max lines to return (default 2000)'),
  }),
  execute: async (args, ctx) => {
    const { filePath, offset, limit } = args as {
      filePath: string
      offset?: number
      limit?: number
    }
    if (!ctx.fs.exists(filePath)) {
      throw new Error(`File ${filePath} not found`)
    }
    ctx.markRead(filePath)
    const output = ctx.fs.readLines(filePath, offset ?? 1, limit ?? 2000)
    return { output, title: filePath }
  },
}
