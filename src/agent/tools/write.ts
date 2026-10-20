// ADAPT: full-file write against VirtualFS

import { z } from 'zod'
import { createTwoFilesPatch } from 'diff'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/write.txt?raw'
import { normalizeLineEndings, trimDiff } from '../vendor/opencode/edit-replace'
import { assertAllowedWorkspacePath } from '../../page/allowedFiles'
import { normalizePageHtml } from '../../html/normalizePageHtml'
import { normalizePath } from '../fs/paths'

export const writeTool: AgentToolDef = {
  id: 'write',
  description: description.trim(),
  parameters: z.object({
    filePath: z.string().describe('Workspace path to write (.html or .css only)'),
    content: z.string().describe('Full file contents'),
  }),
  execute: async (args, ctx) => {
    const filePath = normalizePath((args as { filePath: string }).filePath)
    let { content } = args as { filePath: string; content: string }
    assertAllowedWorkspacePath(filePath)
    if (/\.html?$/i.test(filePath)) {
      content = normalizePageHtml(content)
    }
    const exists = ctx.fs.exists(filePath)
    // PORT: page-builder seed files are always present — do not block overwrite on wasRead
    // (OpenCode read-first is guidance in the tool description; hard-fail caused doom loops).
    const before = exists ? ctx.fs.read(filePath) : null
    let patch = ''
    try {
      patch = trimDiff(
        createTwoFilesPatch(
          filePath,
          filePath,
          normalizeLineEndings(before ?? ''),
          normalizeLineEndings(content),
        ),
      )
    } catch (e) {
      console.warn('[write] diff failed', e)
      patch = `--- ${filePath}\n+++ ${filePath}\n@@ updated @@\n`
    }

    ctx.pushUndo(filePath, before, content)
    ctx.fs.write(filePath, content)
    ctx.markRead(filePath)
    ctx.setLastDiff({ path: filePath, patch })

    return {
      output: exists
        ? `Updated ${filePath} (${content.length} chars). Canvas preview refreshed. For later edits, re-read the file — stored markup may be normalized.`
        : `Created ${filePath}. Canvas preview refreshed. For later edits, re-read the file — stored markup may be normalized.`,
      title: filePath,
      metadata: { filepath: filePath, diff: patch },
    }
  },
}
