// ADAPT: regex scan of VirtualFS contents (no ripgrep binary)

import { z } from 'zod'
import { minimatch } from 'minimatch'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/grep.txt?raw'

export const grepTool: AgentToolDef = {
  id: 'grep',
  description: description.trim(),
  parameters: z.object({
    pattern: z.string().describe('Regular expression to search for'),
    include: z.string().optional().describe('Optional glob to filter files, e.g. *.{ts,tsx}'),
  }),
  execute: async (args, ctx) => {
    const { pattern, include } = args as { pattern: string; include?: string }
    let regex: RegExp
    try {
      regex = new RegExp(pattern)
    } catch (e) {
      throw new Error(`Invalid regex: ${(e as Error).message}`)
    }

    const files = ctx.fs.list().filter((p) => (include ? minimatch(p, include, { dot: true }) : true))
    const hits: string[] = []
    for (const file of files) {
      const content = ctx.fs.read(file)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          hits.push(`${file}:${i + 1}: ${lines[i]}`)
          if (hits.length >= 200) {
            hits.push('… truncated')
            return { output: hits.join('\n'), title: pattern }
          }
        }
      }
    }
    return {
      output: hits.length === 0 ? 'No matches found.' : hits.join('\n'),
      title: pattern,
    }
  },
}
