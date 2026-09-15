// GREENFIELD: agent loop inspired by OpenCode session/prompt.ts semantics (no Effect)

import { isStepCount, streamText, type ModelMessage } from 'ai'
import { nanoid } from 'nanoid'
import { createAgentModel } from './llm'
import { buildSystemPrompt } from './prompts/system'
import { createToolSet } from './tools/registry'
import { useAgentStore, type ChatMessage, type ChatPart } from './session/store'

function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'user') {
      const text = msg.parts
        .filter((p): p is Extract<ChatPart, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('\n')
      out.push({ role: 'user', content: text })
      continue
    }
    if (msg.role === 'assistant') {
      const text = msg.parts
        .filter((p): p is Extract<ChatPart, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('\n')
      if (text.trim()) {
        out.push({ role: 'assistant', content: text })
      }
    }
  }
  return out
}

export async function runAgentTurn(userText: string): Promise<void> {
  const store = useAgentStore.getState()
  if (store.isRunning) return

  const controller = new AbortController()
  const userMsg: ChatMessage = {
    id: nanoid(),
    role: 'user',
    parts: [{ type: 'text', text: userText }],
  }
  const assistantId = nanoid()
  const assistantMsg: ChatMessage = {
    id: assistantId,
    role: 'assistant',
    parts: [],
  }

  store.addMessage(userMsg)
  store.addMessage(assistantMsg)
  store.setRunning(true, controller)

  const fs = store.getFS()
  const tools = createToolSet({
    fs,
    wasRead: (p) => useAgentStore.getState().wasRead(p),
    markRead: (p) => useAgentStore.getState().markRead(p),
    abort: controller.signal,
  })

  const history = toModelMessages(useAgentStore.getState().messages.filter((m) => m.id !== assistantId))

  try {
    const result = streamText({
      model: createAgentModel(),
      system: buildSystemPrompt(fs.list()),
      messages: history,
      tools,
      stopWhen: isStepCount(20),
      abortSignal: controller.signal,
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (!toolCalls?.length) return
        useAgentStore.getState().updateMessage(assistantId, (msg) => {
          const parts = [...msg.parts]
          for (let i = 0; i < toolCalls.length; i++) {
            const call = toolCalls[i]
            const res = toolResults?.[i]
            parts.push({
              type: 'tool',
              toolName: call.toolName,
              status: res ? 'done' : 'error',
              args: call.input,
              result: res ? String(res.output ?? '') : undefined,
            })
          }
          return { ...msg, parts }
        })
      },
    })

    let text = ''
    for await (const delta of result.textStream) {
      text += delta
      const snapshot = text
      useAgentStore.getState().updateMessage(assistantId, (msg) => {
        const nonText = msg.parts.filter((p) => p.type !== 'text')
        return {
          ...msg,
          parts: [{ type: 'text', text: snapshot }, ...nonText],
        }
      })
    }

    await result.response
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (controller.signal.aborted) {
      useAgentStore.getState().setError('Cancelled')
    } else {
      useAgentStore.getState().setError(message)
      useAgentStore.getState().updateMessage(assistantId, (msg) => ({
        ...msg,
        parts: [...msg.parts, { type: 'text', text: `\n\nError: ${message}` }],
      }))
    }
  } finally {
    useAgentStore.getState().setRunning(false, null)
  }
}
