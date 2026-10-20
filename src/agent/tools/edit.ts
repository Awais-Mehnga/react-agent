// ADAPT: uses EXTRACT replace() from vendor/opencode/edit-replace.ts

import { z } from 'zod'
import { createTwoFilesPatch } from 'diff'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/edit.txt?raw'
import {
  convertToLineEnding,
  detectLineEnding,
  normalizeLineEndings,
  replace,
  trimDiff,
} from '../vendor/opencode/edit-replace'
import { assertAllowedWorkspacePath } from '../../page/allowedFiles'
import { normalizePageHtml } from '../../html/normalizePageHtml'
import { normalizePath } from '../fs/paths'

export const editTool: AgentToolDef = {
  id: 'edit',
  description: description.trim(),
  parameters: z.object({
    filePath: z.string().describe('Workspace path to modify (.html or .css only)'),
    oldString: z.string().describe('The text to replace'),
    newString: z.string().describe('The text to replace it with (must differ from oldString)'),
    replaceAll: z.boolean().optional().describe('Replace all occurrences (default false)'),
  }),
  execute: async (args, ctx) => {
    const filePath = normalizePath((args as { filePath: string }).filePath)
    const { oldString, replaceAll } = args as {
      filePath: string
      oldString: string
      newString: string
      replaceAll?: boolean
    }
    let { newString } = args as {
      filePath: string
      oldString: string
      newString: string
      replaceAll?: boolean
    }
    assertAllowedWorkspacePath(filePath)

    if (oldString === newString) {
      throw new Error('No changes to apply: oldString and newString are identical.')
    }

    if (oldString === '') {
      if (ctx.fs.exists(filePath)) {
        throw new Error(
          'oldString cannot be empty when editing an existing file. Provide the exact text to replace, or use write for an intentional full-file replacement.',
        )
      }
      if (/\.html?$/i.test(filePath)) newString = normalizePageHtml(newString)
      const patch = trimDiff(createTwoFilesPatch(filePath, filePath, '', normalizeLineEndings(newString)))
      ctx.pushUndo(filePath, null, newString)
      ctx.fs.write(filePath, newString)
      ctx.markRead(filePath)
      ctx.setLastDiff({ path: filePath, patch })
      return {
        output: 'File created successfully.',
        title: filePath,
        metadata: { filepath: filePath, diff: patch },
      }
    }

    if (!ctx.fs.exists(filePath)) {
      throw new Error(`File ${filePath} not found`)
    }

    // Soft read-first: mark read if missing so surgical edits still work after a prior write
    if (!ctx.wasRead(filePath)) {
      ctx.markRead(filePath)
    }

    const contentOld = ctx.fs.read(filePath)
    const ending = detectLineEnding(contentOld)
    const old = convertToLineEnding(normalizeLineEndings(oldString), ending)
    const replacement = convertToLineEnding(normalizeLineEndings(newString), ending)
    let contentNew: string
    try {
      contentNew = replace(contentOld, old, replacement, replaceAll ?? false)
    } catch (err) {
      const hint =
        /\.html?$/i.test(filePath)
          ? ' Re-read page.html (stored HTML may differ slightly after sanitize) and copy the exact snippet, or use write for a full rewrite.'
          : ' Re-read the file and copy the exact text to replace.'
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`${message}${hint}`)
    }
    if (/\.html?$/i.test(filePath) && /<!DOCTYPE|<html[\s>]/i.test(contentNew)) {
      contentNew = normalizePageHtml(contentNew)
    }

    const diff = trimDiff(
      createTwoFilesPatch(
        filePath,
        filePath,
        normalizeLineEndings(contentOld),
        normalizeLineEndings(contentNew),
      ),
    )

    ctx.pushUndo(filePath, contentOld, contentNew)
    ctx.fs.write(filePath, contentNew)
    ctx.setLastDiff({ path: filePath, patch: diff })

    return {
      output: `Edited ${filePath}. Canvas preview refreshed.`,
      title: filePath,
      metadata: { filepath: filePath, diff },
    }
  },
}
