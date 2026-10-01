// GREENFIELD: agent loop inspired by OpenCode session/prompt.ts semantics (no Effect)

import { isStepCount, streamText, type ModelMessage } from 'ai'
import { nanoid } from 'nanoid'
import { createAgentModel } from './llm'
import { buildSystemPrompt } from './prompts/system'
import { createToolSet } from './tools/registry'
import { useAgentStore, type ChatMessage, type ChatPart } from './session/store'
import maxStepsNote from './prompts/max-steps.txt?raw'
import {
  extractHtmlFromAssistantText,
  extractPartialJsonString,
  stripCodeForChat,
} from './streamPreview'
import { sanitizeHtml } from '../html/sanitize'
import { usePageEditorStore } from '../page/editorStore'

const DOOM_LOOP_THRESHOLD = 3
const MAX_STEPS = 20

class DoomLoopError extends Error {
  constructor(toolName: string) {
    super(
      `Doom loop detected: tool "${toolName}" was called ${DOOM_LOOP_THRESHOLD} times in a row with identical arguments. Stopping this turn.`,
    )
    this.name = 'DoomLoopError'
  }
}

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
      // Persist chat-safe text so history does not re-feed huge HTML dumps
      const safe = stripCodeForChat(text)
      if (safe.trim()) {
        out.push({ role: 'assistant', content: safe })
      }
    }
  }
  return out
}

function recordDoomCall(
  recent: Array<{ name: string; input: string }>,
  name: string,
  input: unknown,
): void {
  recent.push({ name, input: JSON.stringify(input ?? {}) })
  if (recent.length > DOOM_LOOP_THRESHOLD) recent.shift()
  if (
    recent.length === DOOM_LOOP_THRESHOLD &&
    recent.every((c) => c.name === recent[0].name && c.input === recent[0].input)
  ) {
    throw new DoomLoopError(name)
  }
}

function pushPreviewFile(path: string, content: string) {
  if (path !== 'page.html' && path !== 'theme.css') return
  const editor = usePageEditorStore.getState()
  editor.setMode('visual')
  if (path === 'page.html') {
    editor.setPreviewHtml(sanitizeHtml(content))
    useAgentStore.getState().selectFile('page.html')
  } else {
    editor.setPreviewTheme(content)
  }
}

function toolChatSummary(toolName: string, args: unknown, result?: string): string {
  const a = (args ?? {}) as Record<string, unknown>
  const path = typeof a.filePath === 'string' ? a.filePath : ''
  if (toolName === 'write') return path ? `Wrote ${path}` : 'Wrote file'
  if (toolName === 'edit') return path ? `Edited ${path}` : 'Edited file'
  if (toolName === 'read') return path ? `Read ${path}` : 'Read file'
  if (toolName === 'apply_patch') return 'Applied patch'
  if (result && result.length < 120 && !result.includes('@@') && !result.includes('<')) return result
  return toolName
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
  const recentCalls: Array<{ name: string; input: string }> = []

  const tools = createToolSet(
    {
      fs,
      wasRead: (p) => useAgentStore.getState().wasRead(p),
      markRead: (p) => useAgentStore.getState().markRead(p),
      abort: controller.signal,
      pushUndo: (path, before) => useAgentStore.getState().pushUndo(path, before),
      setLastDiff: (diff) => useAgentStore.getState().setLastDiff(diff),
      setTodos: (todos) => useAgentStore.getState().setTodos(todos),
      askQuestion: (questions) => useAgentStore.getState().askQuestion(questions),
    },
    (name, input) => recordDoomCall(recentCalls, name, input),
  )

  const history = toModelMessages(useAgentStore.getState().messages.filter((m) => m.id !== assistantId))

  let toolInputBuf = ''
  let streamingToolName = ''
  let text = ''
  let lastPreviewAt = 0

  try {
    const result = streamText({
      model: createAgentModel(),
      system: buildSystemPrompt(fs.list()),
      messages: history,
      tools,
      stopWhen: isStepCount(MAX_STEPS),
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
              args: { filePath: (call.input as { filePath?: string } | undefined)?.filePath },
              result: toolChatSummary(call.toolName, call.input, res ? String(res.output ?? '') : undefined),
            })
          }
          return { ...msg, parts }
        })
      },
    })

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        text += chunk.text
        const display = stripCodeForChat(text)
        useAgentStore.getState().updateMessage(assistantId, (msg) => {
          const nonText = msg.parts.filter((p) => p.type !== 'text')
          return {
            ...msg,
            parts: display ? [{ type: 'text', text: display }, ...nonText] : nonText,
          }
        })
        // If the model wrongly streams HTML into chat, still update the canvas
        const leaked = extractHtmlFromAssistantText(text)
        if (leaked && leaked.length > 40) {
          const now = Date.now()
          if (now - lastPreviewAt > 80) {
            lastPreviewAt = now
            pushPreviewFile('page.html', leaked)
          }
        }
        continue
      }

      if (chunk.type === 'tool-input-start') {
        toolInputBuf = ''
        streamingToolName = chunk.toolName
        continue
      }

      if (chunk.type === 'tool-input-delta') {
        toolInputBuf += chunk.delta
        if (streamingToolName === 'write') {
          const path = extractPartialJsonString(toolInputBuf, 'filePath')
          const content = extractPartialJsonString(toolInputBuf, 'content')
          if (path && content && (path === 'page.html' || path === 'theme.css')) {
            const now = Date.now()
            if (now - lastPreviewAt > 50) {
              lastPreviewAt = now
              pushPreviewFile(path, content)
            }
          }
        }
        continue
      }

      if (chunk.type === 'tool-input-end') {
        toolInputBuf = ''
        streamingToolName = ''
      }
    }

    // Final chat text: code-stripped
    const finalDisplay = stripCodeForChat(text)
    if (finalDisplay) {
      useAgentStore.getState().updateMessage(assistantId, (msg) => {
        const nonText = msg.parts.filter((p) => p.type !== 'text')
        return { ...msg, parts: [{ type: 'text', text: finalDisplay }, ...nonText] }
      })
    }

    const steps = (await result.steps).length
    if (steps >= MAX_STEPS) {
      const note = maxStepsNote.trim()
      useAgentStore.getState().setError('Maximum steps reached')
      useAgentStore.getState().updateMessage(assistantId, (msg) => ({
        ...msg,
        parts: [...msg.parts, { type: 'text', text: `\n\n${note}` }],
      }))
    }

    await result.response
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (controller.signal.aborted && !(err instanceof DoomLoopError)) {
      useAgentStore.getState().setError('Cancelled')
    } else {
      useAgentStore.getState().setError(message)
      useAgentStore.getState().updateMessage(assistantId, (msg) => ({
        ...msg,
        parts: [...msg.parts, { type: 'text', text: `\n\nError: ${message}` }],
      }))
      if (err instanceof DoomLoopError) {
        controller.abort()
      }
    }
  } finally {
    usePageEditorStore.getState().clearPreview()
    useAgentStore.getState().setRunning(false, null)
  }
}
