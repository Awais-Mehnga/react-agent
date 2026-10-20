// ADAPT: apply_patch against VirtualFS using EXTRACT patch engine

import { z } from 'zod'
import { createTwoFilesPatch } from 'diff'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/apply_patch.txt?raw'
import { deriveNewContentsFromChunks, parsePatch } from '../vendor/opencode/patch'
import { normalizeLineEndings, trimDiff } from '../vendor/opencode/edit-replace'
import { normalizePath } from '../fs/paths'
import { assertAllowedWorkspacePath } from '../../page/allowedFiles'

export const applyPatchTool: AgentToolDef = {
  id: 'apply_patch',
  description: description.trim(),
  parameters: z.object({
    patchText: z.string().describe('The full patch text that describes all changes to be made'),
  }),
  execute: async (args, ctx) => {
    const { patchText } = args as { patchText: string }
    if (!patchText?.trim()) throw new Error('patchText is required')

    let hunks
    try {
      hunks = parsePatch(patchText).hunks
    } catch (error) {
      throw new Error(`apply_patch verification failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (hunks.length === 0) {
      const normalized = patchText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
      if (normalized === '*** Begin Patch\n*** End Patch') {
        throw new Error('patch rejected: empty patch')
      }
      throw new Error('apply_patch verification failed: no hunks found')
    }

    const summaries: string[] = []
    const fileDiffs: Array<{ filepath: string; diff: string }> = []

    for (const hunk of hunks) {
      const filePath = normalizePath(hunk.path)
      assertAllowedWorkspacePath(filePath)
      if (hunk.type === 'update' && hunk.move_path) {
        assertAllowedWorkspacePath(hunk.move_path)
      }

      if (hunk.type === 'add') {
        if (ctx.fs.exists(filePath)) {
          throw new Error(`apply_patch verification failed: file already exists: ${filePath}`)
        }
        const newContent =
          hunk.contents.length === 0 || hunk.contents.endsWith('\n') ? hunk.contents : `${hunk.contents}\n`
        const diff = trimDiff(createTwoFilesPatch(filePath, filePath, '', normalizeLineEndings(newContent)))
        ctx.pushUndo(filePath, null, newContent)
        ctx.fs.write(filePath, newContent)
        ctx.markRead(filePath)
        fileDiffs.push({ filepath: filePath, diff })
        summaries.push(`A ${filePath}`)
        continue
      }

      if (hunk.type === 'delete') {
        if (!ctx.fs.exists(filePath)) {
          throw new Error(`apply_patch verification failed: Failed to read file to delete: ${filePath}`)
        }
        const oldContent = ctx.fs.read(filePath)
        const diff = trimDiff(createTwoFilesPatch(filePath, filePath, normalizeLineEndings(oldContent), ''))
        ctx.pushUndo(filePath, oldContent, null)
        ctx.fs.delete(filePath)
        fileDiffs.push({ filepath: filePath, diff })
        summaries.push(`D ${filePath}`)
        continue
      }

      if (!ctx.fs.exists(filePath)) {
        throw new Error(`apply_patch verification failed: Failed to read file to update: ${filePath}`)
      }
      const oldContent = ctx.fs.read(filePath)
      let fileUpdate
      try {
        fileUpdate = deriveNewContentsFromChunks(filePath, hunk.chunks, oldContent)
      } catch (error) {
        throw new Error(`apply_patch verification failed: ${error instanceof Error ? error.message : String(error)}`)
      }

      if (hunk.move_path) {
        const movePath = normalizePath(hunk.move_path)
        const moveBefore = ctx.fs.exists(movePath) ? ctx.fs.read(movePath) : null
        const diff = trimDiff(
          createTwoFilesPatch(
            filePath,
            movePath,
            normalizeLineEndings(oldContent),
            normalizeLineEndings(fileUpdate.content),
          ),
        )
        ctx.pushUndo(filePath, oldContent, null)
        ctx.pushUndo(movePath, moveBefore, fileUpdate.content)
        ctx.fs.write(movePath, fileUpdate.content)
        ctx.fs.delete(filePath)
        ctx.markRead(movePath)
        fileDiffs.push({ filepath: movePath, diff })
        summaries.push(`M ${filePath} -> ${movePath}`)
      } else {
        const diff = trimDiff(
          createTwoFilesPatch(
            filePath,
            filePath,
            normalizeLineEndings(oldContent),
            normalizeLineEndings(fileUpdate.content),
          ),
        )
        ctx.pushUndo(filePath, oldContent, fileUpdate.content)
        ctx.fs.write(filePath, fileUpdate.content)
        ctx.markRead(filePath)
        fileDiffs.push({ filepath: filePath, diff })
        summaries.push(`M ${filePath}`)
      }
    }

    const last = fileDiffs[fileDiffs.length - 1]
    if (last) {
      ctx.setLastDiff({ path: last.filepath, patch: last.diff })
    }

    return {
      title: `${summaries.length} file(s)`,
      output: `Patch applied successfully.\n${summaries.join('\n')}`,
      metadata: {
        files: fileDiffs,
        filepath: last?.filepath,
        diff: last?.diff,
      },
    }
  },
}
