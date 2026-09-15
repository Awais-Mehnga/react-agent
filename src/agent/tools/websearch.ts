// ADAPT: websearch via Vite /api/search (DuckDuckGo Instant Answer)

import { z } from 'zod'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/websearch.txt?raw'

export const websearchTool: AgentToolDef = {
  id: 'websearch',
  description: description.trim(),
  parameters: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async (args) => {
    const { query } = args as { query: string }
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`websearch failed (${res.status}): ${body.slice(0, 400)}`)
    }
    const data = (await res.json()) as {
      AbstractText?: string
      AbstractURL?: string
      Heading?: string
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>
      Results?: Array<{ Text?: string; FirstURL?: string }>
    }

    const lines: string[] = []
    if (data.Heading) lines.push(`# ${data.Heading}`)
    if (data.AbstractText) {
      lines.push(data.AbstractText)
      if (data.AbstractURL) lines.push(data.AbstractURL)
    }

    const pushTopic = (t: { Text?: string; FirstURL?: string }) => {
      if (t.Text) lines.push(`- ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ''}`)
    }

    for (const t of data.RelatedTopics ?? []) {
      if (t.Topics) t.Topics.forEach(pushTopic)
      else pushTopic(t)
    }
    for (const r of data.Results ?? []) pushTopic(r)

    if (lines.length === 0) lines.push('No results found.')
    return { title: query, output: lines.join('\n') }
  },
}
