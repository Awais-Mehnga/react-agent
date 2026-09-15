// ADAPT: apply_patch against VirtualFS using EXTRACT patch engine

import { z } from 'zod'
import { createTwoFilesPatch } from 'diff'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/apply_patch.txt?raw'
import { deriveNewContentsFromChunks, parsePatch } from '../vendor/opencode/patch'
import { normalizeLineEndings, trimDiff } from '../vendor/opencode/edit-replace'
import { normalizePath } from '../fs/paths'

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
    let lastPatch = ''
    let lastPath = ''

    for (const hunk of hunks) {
      const filePath = normalizePath(hunk.path)

      if (hunk.type === 'add') {
        if (ctx.fs.exists(filePath)) {
          throw new Error(`apply_patch verification failed: file already exists: ${filePath}`)
        }
        const newContent =
          hunk.contents.length === 0 || hunk.contents.endsWith('\n') ? hunk.contents : `${hunk.contents}\n`
        ctx.pushUndo(filePath, null)
        ctx.fs.write(filePath, newContent)
        ctx.markRead(filePath)
        const diff = trimDiff(createTwoFilesPatch(filePath, filePath, '', normalizeLineEndings(newContent)))
        lastPatch = diff
        lastPath = filePath
        summaries.push(`A ${filePath}`)
        continue
      }

      if (hunk.type === 'delete') {
        if (!ctx.fs.exists(filePath)) {
          throw new Error(`apply_patch verification failed: Failed to read file to delete: ${filePath}`)
        }
        const oldContent = ctx.fs.read(filePath)
        ctx.pushUndo(filePath, oldContent)
        ctx.fs.delete(filePath)
        const diff = trimDiff(createTwoFilesPatch(filePath, filePath, normalizeLineEndings(oldContent), ''))
        lastPatch = diff
        lastPath = filePath
        summaries.push(`D ${filePath}`)
        continue
      }

      // update
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

      ctx.pushUndo(filePath, oldContent)
      if (hunk.move_path) {
        const movePath = normalizePath(hunk.move_path)
        ctx.fs.write(movePath, fileUpdate.content)
        ctx.fs.delete(filePath)
        ctx.markRead(movePath)
        const diff = trimDiff(
          createTwoFilesPatch(
            filePath,
            movePath,
            normalizeLineEndings(oldContent),
            normalizeLineEndings(fileUpdate.content),
          ),
        )
        lastPatch = diff
        lastPath = movePath
        summaries.push(`M ${filePath} -> ${movePath}`)
      } else {
        ctx.fs.write(filePath, fileUpdate.content)
        ctx.markRead(filePath)
        const diff = trimDiff(
          createTwoFilesPatch(
            filePath,
            filePath,
            normalizeLineEndings(oldContent),
            normalizeLineEndings(fileUpdate.content),
          ),
        )
        lastPatch = diff
        lastPath = filePath
        summaries.push(`M ${filePath}`)
      }
    }

    if (lastPath && lastPatch) {
      ctx.setLastDiff({ path: lastPath, patch: lastPatch })
    }

    return {
      title: `${summaries.length} file(s)`,
      output: `Patch applied successfully.\n${summaries.join('\n')}`,
    }
  },
}
