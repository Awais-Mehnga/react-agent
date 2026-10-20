// Sourced and adapted from opencode/packages/core/src/plugin/agent.ts

import { generateText } from 'ai'
import { createAgentModel } from '../llm'

export const PROMPT_TITLE = `You are a title generator. You output ONLY a thread title. Nothing else.

<task>
Generate a brief title that would help the user find this conversation later.

Follow all rules in <rules>
Your output must be:
- A single line
- <=40 characters
- No quotes or explanations
</task>

<rules>
- Use English for the title unless the user message is clearly written in another language (then match that language). Never default to Chinese.
- Title must be grammatically correct and read naturally
- Never include tool names in the title (e.g. "read tool", "bash tool", "edit tool")
- Focus on the main topic or question the user needs to retrieve
- Vary your phrasing - avoid repetitive patterns like always starting with "Analyzing"
- Keep exact: technical terms, numbers, filenames
- Remove filler words: the, this, my, a, an
- Never use tools
- NEVER respond to questions, just generate a title for the conversation
- The title should NEVER include "summarizing" or "generating"
- DO NOT SAY YOU CANNOT GENERATE A TITLE
- If the user message is short or conversational (e.g. "hello", "hi"):
  -> create a title like "New Chat" or "Quick Question"
</rules>`

export async function generateSessionTitle(userMessage: string, abortSignal?: AbortSignal): Promise<string | null> {
  try {
    const text = userMessage.trim().slice(0, 500)
    if (!text) return null

    const result = await generateText({
      model: createAgentModel('title'),
      system: PROMPT_TITLE,
      prompt: `User request: "${text}"\n\nTitle:`,
      abortSignal,
    })

    const cleaned = result.text
      .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
      .replace(/["'`]/g, '')
      .split('\n')[0]
      ?.trim()

    if (!cleaned) return null
    return cleaned.slice(0, 45)
  } catch {
    return null
  }
}
