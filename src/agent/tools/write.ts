// ADAPT: full-file write against VirtualFS

import { z } from 'zod'
import { createTwoFilesPatch } from 'diff'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/write.txt?raw'
import { normalizeLineEndings, trimDiff } from '../vendor/opencode/edit-replace'

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
    const before = exists ? ctx.fs.read(filePath) : null
    ctx.pushUndo(filePath, before)
    ctx.fs.write(filePath, content)
    ctx.markRead(filePath)

    const patch = trimDiff(
      createTwoFilesPatch(
        filePath,
        filePath,
        normalizeLineEndings(before ?? ''),
        normalizeLineEndings(content),
      ),
    )
    ctx.setLastDiff({ path: filePath, patch })

    return {
      output: exists ? `File overwritten successfully.\n\n${patch}` : 'File created successfully.',
      title: filePath,
    }
  },
}
