// ADAPT: full-file write against VirtualFS

import { z } from 'zod'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/write.txt?raw'

export const writeTool: AgentToolDef = {
  id: 'write',
  description: description.trim(),
  parameters: z.object({
    filePath: z.string().describe('Workspace path to write'),
    content: z.string().describe('Full file contents'),
  }),
  execute: async (args, ctx) => {
    const { filePath, content } = args as { filePath: string; content: string }
    const exists = ctx.fs.exists(filePath)
    if (exists && !ctx.wasRead(filePath)) {
      throw new Error('You must use the Read tool first before overwriting an existing file.')
    }
    ctx.fs.write(filePath, content)
    ctx.markRead(filePath)
    return {
      output: exists ? 'File overwritten successfully.' : 'File created successfully.',
      title: filePath,
    }
  },
}
