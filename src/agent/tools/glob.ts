// ADAPT: in-memory glob via minimatch (no ripgrep)

import { z } from 'zod'
import { minimatch } from 'minimatch'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/glob.txt?raw'

export const globTool: AgentToolDef = {
  id: 'glob',
  description: description.trim(),
  parameters: z.object({
    pattern: z.string().describe('Glob pattern, e.g. **/*.tsx'),
  }),
  execute: async (args, ctx) => {
    const { pattern } = args as { pattern: string }
    const matches = ctx.fs.list().filter((p) => minimatch(p, pattern, { dot: true }))
    return {
      output: matches.length === 0 ? 'No files matched.' : matches.join('\n'),
      title: pattern,
    }
  },
}
