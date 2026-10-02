// ADAPT: full-file write against VirtualFS

import { z } from 'zod'
import { createTwoFilesPatch } from 'diff'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/write.txt?raw'
import { normalizeLineEndings, trimDiff } from '../vendor/opencode/edit-replace'
import { assertAllowedWorkspacePath } from '../../page/allowedFiles'
import { normalizePageHtml } from '../../html/normalizePageHtml'

export const writeTool: AgentToolDef = {
  id: 'write',
  description: description.trim(),
  parameters: z.object({
    filePath: z.string().describe('Workspace path to write (.html or .css only)'),
    content: z.string().describe('Full file contents'),
  }),
  execute: async (args, ctx) => {
    const { filePath } = args as { filePath: string; content: string }
    let { content } = args as { filePath: string; content: string }
    assertAllowedWorkspacePath(filePath)
    if (/\.html?$/i.test(filePath)) {
      content = normalizePageHtml(content)
    }
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
      output: exists
        ? `Updated ${filePath} (${content.length} chars). Canvas preview refreshed.`
        : `Created ${filePath}. Canvas preview refreshed.`,
      title: filePath,
    }
  },
}
