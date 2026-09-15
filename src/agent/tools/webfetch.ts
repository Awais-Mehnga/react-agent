// ADAPT: webfetch via Vite /api/fetch proxy

import { z } from 'zod'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/webfetch.txt?raw'

const MAX_CHARS = 80_000

export const webfetchTool: AgentToolDef = {
  id: 'webfetch',
  description: description.trim(),
  parameters: z.object({
    url: z.string().describe('Fully-formed URL to fetch'),
    format: z.enum(['markdown', 'text', 'html']).optional().describe('Output format (default markdown)'),
  }),
  execute: async (args) => {
    const { url, format = 'markdown' } = args as { url: string; format?: 'markdown' | 'text' | 'html' }
    let target = url.trim()
    if (target.startsWith('http://')) target = `https://${target.slice('http://'.length)}`
    if (!/^https:\/\//i.test(target)) throw new Error('URL must be https')

    const res = await fetch(`/api/fetch?url=${encodeURIComponent(target)}&format=${encodeURIComponent(format)}`)
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`webfetch failed (${res.status}): ${body.slice(0, 400)}`)
    }
    let text = await res.text()
    if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}\n\n[truncated]`
    return { title: target, output: text }
  },
}
