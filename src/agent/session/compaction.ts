import { generateText } from 'ai'

import { createAgentModel } from '../llm'
import type { ChatMessage, ChatPart } from './store'

export const SUMMARY_TEMPLATE = `Output exactly the Markdown structure shown inside <template> and keep the section order unchanged. Do not include the <template> tags in your response.
<template>
## Objective
- [one or two brief sentences describing what the user is trying to accomplish]

## Important Details
- [constraints/preferences, decisions and why, important facts/assumptions, exact context needed to continue, or "(none)"]

## Work State
### Completed
- [finished work, verified facts, or changes made; otherwise "(none)"]

### Active
- [current work, partial changes, or investigation state; otherwise "(none)"]

### Blocked
- [blockers, failing commands, or unknowns; otherwise "(none)"]

## Next Move
1. [immediate concrete action, or "(none)"]
2. [next action if known, or "(none)"]

## Relevant Files
- [file or directory path: why it matters, or "(none)"]
</template>

Rules:
- Keep every section, even when empty.
- Use terse bullets, not prose paragraphs.
- Preserve exact file paths, symbols, commands, error strings, URLs, and identifiers when known.
- Do not mention the summary process or that context was compacted.`

export const SUMMARY_UPDATE_INSTRUCTIONS = `The <prior-summary> summarizes everything that happened before the <conversation>. Construct a new summary that combines both. The <prior-summary> is discarded after this: anything you do not carry into the new summary is lost.

When combining:
- Carry forward objectives, constraints, user directives, decisions, and parallel workstreams from the <prior-summary> even when the <conversation> does not mention them. Drop only what is finished and no longer needed.
- The <conversation> is more recent than the <prior-summary>. Where they conflict, the conversation wins: state the corrected fact and drop the old claim.
- Add new progress, decisions, constraints, and context from the conversation.
- Move completed work from "Active" to "Completed".
- If a blocker has been resolved, update the summary to reflect that while keeping any details still needed to continue the work.
- Update "Objective" and "Next Move" to reflect the current work state.`

const TOOL_OUTPUT_MAX_CHARS = 1000

function truncate(text: string): string {
  if (text.length <= TOOL_OUTPUT_MAX_CHARS) return text
  return `${text.slice(0, TOOL_OUTPUT_MAX_CHARS)}\n[...truncated]`
}

export function serializeMessage(msg: ChatMessage): string {
  if (msg.role === 'user') {
    const text = msg.parts
      .filter((p): p is Extract<ChatPart, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
    return `[User]: ${text}`
  }
  if (msg.role === 'assistant') {
    const lines: string[] = []
    for (const p of msg.parts) {
      if (p.type === 'text') {
        lines.push(`[Assistant]: ${p.text}`)
      } else if (p.type === 'tool') {
        const file = (p.args as { filePath?: string } | undefined)?.filePath
        const target = file ? ` on ${file}` : ''
        lines.push(`[Tool ${p.toolName}${target} - ${p.status}]: ${truncate(p.result || '')}`)
      } else if (p.type === 'compaction') {
        lines.push(`[Prior Summary]:\n${p.summary}`)
      }
    }
    return lines.join('\n')
  }
  return ''
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8)
}

export type CompactionResult = {
  summary: string
  compactedMessages: ChatMessage[]
}

/**
 * Compacts conversation history by summarizing older turns using OpenCode's format,
 * keeping the last few recent turns intact.
 */
export async function compactConversation(
  messages: ChatMessage[],
  options?: {
    keepRecentTurns?: number
    priorSummary?: string
    abortSignal?: AbortSignal
  },
): Promise<string> {
  const keepCount = options?.keepRecentTurns ?? 2
  const prior = options?.priorSummary

  // Separate messages to summarize vs recent to keep
  const sliceIndex = Math.max(0, messages.length - keepCount * 2)
  const toSummarize = messages.slice(0, sliceIndex)
  const serializedHistory = toSummarize
    .map(serializeMessage)
    .filter(Boolean)
    .join('\n\n')

  let prompt = `Here is the conversation history to compact:\n\n<conversation>\n${serializedHistory}\n</conversation>\n\n`
  if (prior) {
    prompt += `Here is the prior summary:\n\n<prior-summary>\n${prior}\n</prior-summary>\n\n${SUMMARY_UPDATE_INSTRUCTIONS}\n\n`
  } else {
    prompt += `Create an anchored summary of this conversation so another coding turn can continue directly without loss of intent or progress.\n\n`
  }
  prompt += SUMMARY_TEMPLATE

  const result = await generateText({
    model: createAgentModel('compaction'),
    system:
      'You are a context summarization agent. Produce a concise, structured engineering summary of the conversation matching the required format exactly. Never continue the conversation or execute tools.',
    prompt,
    abortSignal: options?.abortSignal,
  })

  return result.text.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim()
}
