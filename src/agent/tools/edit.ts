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

export const editTool: AgentToolDef = {
  id: 'edit',
  description: description.trim(),
  parameters: z.object({
    filePath: z.string().describe('Workspace path to modify'),
    oldString: z.string().describe('The text to replace'),
    newString: z.string().describe('The text to replace it with (must differ from oldString)'),
    replaceAll: z.boolean().optional().describe('Replace all occurrences (default false)'),
  }),
  execute: async (args, ctx) => {
    const { filePath, oldString, newString, replaceAll } = args as {
      filePath: string
      oldString: string
      newString: string
      replaceAll?: boolean
    }

    if (oldString === newString) {
      throw new Error('No changes to apply: oldString and newString are identical.')
    }

    if (oldString === '') {
      if (ctx.fs.exists(filePath)) {
        throw new Error(
          'oldString cannot be empty when editing an existing file. Provide the exact text to replace, or use write for an intentional full-file replacement.',
        )
      }
      ctx.pushUndo(filePath, null)
      ctx.fs.write(filePath, newString)
      const patch = trimDiff(createTwoFilesPatch(filePath, filePath, '', normalizeLineEndings(newString)))
      ctx.setLastDiff({ path: filePath, patch })
      return { output: 'File created successfully.', title: filePath }
    }

    if (!ctx.fs.exists(filePath)) {
      throw new Error(`File ${filePath} not found`)
    }

    // PORT: enforce read-before-edit discipline from OpenCode tool description
    if (!ctx.wasRead(filePath)) {
      throw new Error('You must use the Read tool at least once before editing this file.')
    }

    const contentOld = ctx.fs.read(filePath)
    const ending = detectLineEnding(contentOld)
    const old = convertToLineEnding(normalizeLineEndings(oldString), ending)
    const replacement = convertToLineEnding(normalizeLineEndings(newString), ending)
    const contentNew = replace(contentOld, old, replacement, replaceAll ?? false)

    ctx.pushUndo(filePath, contentOld)
    ctx.fs.write(filePath, contentNew)

    const diff = trimDiff(
      createTwoFilesPatch(filePath, filePath, normalizeLineEndings(contentOld), normalizeLineEndings(contentNew)),
    )
    ctx.setLastDiff({ path: filePath, patch: diff })

    return {
      output: `Edit applied successfully.\n\n${diff}`,
      title: filePath,
    }
  },
}
