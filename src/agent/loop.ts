// GREENFIELD: agent loop inspired by OpenCode session/prompt.ts semantics (no Effect)

import { isStepCount, streamText, type ModelMessage } from 'ai'
import { nanoid } from 'nanoid'
import { createAgentModel, currentModelId, currentProvider } from './llm'
import { buildSystemPrompt } from './prompts/system'
import { createToolSet } from './tools/registry'
import { useAgentStore, type ChatMessage, type ChatPart } from './session/store'
import maxStepsNote from './prompts/max-steps.txt?raw'
import {
  extractHtmlFromAssistantText,
  extractPartialJsonString,
  stripCodeForChat,
} from './streamPreview'
import { normalizePageHtml } from '../html/normalizePageHtml'
import { usePageEditorStore } from '../page/editorStore'
import { compactConversation } from './session/compaction'
import { generateSessionTitle } from './prompts/title'

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

import type { CanvasSelection } from '../editor/Canvas'

function toModelMessages(
  messages: ChatMessage[],
  selectedElement?: CanvasSelection | null,
): ModelMessage[] {
  const out: ModelMessage[] = []
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user')

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!
    if (msg.role === 'user') {
      let text = msg.parts
        .filter((p): p is Extract<ChatPart, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('\n')

      if (i === lastUserIndex && selectedElement) {
        text += `\n\n[Context: User has selected <${selectedElement.tagName} class="${selectedElement.className}"> in the visual editor:\n${selectedElement.outerHtml.slice(0, 800)}]`
      }

      out.push({ role: 'user', content: text })
      continue
    }
    if (msg.role === 'assistant') {
      const compaction = msg.parts.find(
        (p): p is Extract<ChatPart, { type: 'compaction' }> => p.type === 'compaction',
      )
      if (compaction) {
        out.push({
          role: 'user',
          content: `[CONTEXT SUMMARY — previous messages have been compacted]:\n${compaction.summary}`,
        })
        out.push({
          role: 'assistant',
          content: 'Understood. I have the context summary and will continue from there.',
        })
      }

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
  editor.setIsEditing(true)
  if (path === 'page.html') {
    if (content.trim().length > 30) {
      editor.setPreviewHtml(normalizePageHtml(content))
    }
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

  // Pre-turn compaction check if conversation has grown very long
  if (store.messages.length >= 10) {
    try {
      const summary = await compactConversation(store.messages, {
        abortSignal: controller.signal,
      })
      useAgentStore.getState().compactCurrentSession(summary)
    } catch (e) {
      console.warn('Pre-turn compaction check:', e)
    }
  }

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
  usePageEditorStore.getState().setIsEditing(true)

  // Asynchronously generate title for new chats
  const activeSession = useAgentStore
    .getState()
    .sessions.find((s) => s.id === store.currentSessionId)
  if (
    activeSession &&
    (!activeSession.title || activeSession.title === 'New Chat') &&
    store.messages.length <= 2
  ) {
    void generateSessionTitle(userText).then((title) => {
      if (title) {
        useAgentStore.getState().updateSessionTitle(store.currentSessionId, title)
      }
    })
  }

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

  const selection = usePageEditorStore.getState().selection
  const history = toModelMessages(
    useAgentStore.getState().messages.filter((m) => m.id !== assistantId),
    selection,
  )

  let toolInputBuf = ''
  let streamingToolName = ''
  let text = ''
  let thinking = ''
  let lastPreviewAt = 0

  const modelId = currentModelId('code').toLowerCase()
  const isReasoningModel =
    currentProvider() === 'deepseek' &&
    (modelId.includes('reasoner') || modelId.includes('r1') || modelId.includes('pro'))

  try {
    const result = streamText({
      model: createAgentModel('code'),
      system: buildSystemPrompt(fs.list(), selection),
      messages: history,
      tools,
      stopWhen: isStepCount(MAX_STEPS),
      abortSignal: controller.signal,
      // Pass low reasoning only when explicitly using a reasoning model
      ...(isReasoningModel ? { reasoning: 'low' as const } : {}),
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (!toolCalls?.length) return
        for (let i = 0; i < toolCalls.length; i++) {
          const call = toolCalls[i]
          if (call.toolName === 'write' || call.toolName === 'edit') {
            const p = (call.input as { filePath?: string } | undefined)?.filePath
            if (p === 'page.html' || p === 'theme.css') {
              if (fs.exists(p)) {
                pushPreviewFile(p, fs.read(p))
              }
            }
          }
        }
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
      if (chunk.type === 'reasoning-delta') {
        thinking += chunk.text
        const snapshot = thinking
        useAgentStore.getState().updateMessage(assistantId, (msg) => {
          const rest = msg.parts.filter((p) => p.type !== 'thinking')
          return {
            ...msg,
            parts: [{ type: 'thinking', text: snapshot }, ...rest],
          }
        })
        continue
      }

      if (chunk.type === 'text-delta') {
        text += chunk.text
        const display = stripCodeForChat(text)
        useAgentStore.getState().updateMessage(assistantId, (msg) => {
          const thinkingParts = msg.parts.filter((p) => p.type === 'thinking')
          const toolParts = msg.parts.filter((p) => p.type === 'tool')
          const otherParts = msg.parts.filter(
            (p) => p.type !== 'text' && p.type !== 'thinking' && p.type !== 'tool',
          )
          return {
            ...msg,
            parts: [
              ...thinkingParts,
              ...toolParts,
              ...otherParts,
              ...(display ? ([{ type: 'text', text: display }] as const) : []),
            ],
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
            if (content.length > 60 && (content.includes('</') || content.includes('}'))) {
              const now = Date.now()
              if (now - lastPreviewAt > 100) {
                lastPreviewAt = now
                pushPreviewFile(path, content)
              }
            }
          }
        } else if (streamingToolName === 'edit') {
          const path = extractPartialJsonString(toolInputBuf, 'filePath')
          const oldStr = extractPartialJsonString(toolInputBuf, 'oldString')
          const newStr = extractPartialJsonString(toolInputBuf, 'newString')
          if (path && oldStr && newStr && (path === 'page.html' || path === 'theme.css')) {
            const currentFile = fs.exists(path) ? fs.read(path) : ''
            if (currentFile && currentFile.includes(oldStr)) {
              const live = currentFile.replace(oldStr, newStr)
              const now = Date.now()
              if (now - lastPreviewAt > 40) {
                lastPreviewAt = now
                pushPreviewFile(path, live)
              }
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

    // Final chat text: code-stripped, preserving strict order (thinking -> tools -> text)
    const finalDisplay = stripCodeForChat(text)
    if (finalDisplay) {
      useAgentStore.getState().updateMessage(assistantId, (msg) => {
        const thinkingParts = msg.parts.filter((p) => p.type === 'thinking')
        const toolParts = msg.parts.filter((p) => p.type === 'tool')
        const otherParts = msg.parts.filter(
          (p) => p.type !== 'text' && p.type !== 'thinking' && p.type !== 'tool',
        )
        return {
          ...msg,
          parts: [
            ...thinkingParts,
            ...toolParts,
            ...otherParts,
            { type: 'text', text: finalDisplay },
          ],
        }
      })
    }

    const steps = (await result.steps).length
    if (steps >= MAX_STEPS) {
      // Automatic session compaction instead of breaking
      try {
        const currentMsgs = useAgentStore.getState().messages
        const summary = await compactConversation(currentMsgs, {
          abortSignal: controller.signal,
        })
        useAgentStore.getState().compactCurrentSession(summary)
        useAgentStore.getState().updateMessage(assistantId, (msg) => ({
          ...msg,
          parts: [
            ...msg.parts,
            {
              type: 'text',
              text: '\n\n*Session context compacted to continue smoothly in this chat.*',
            },
          ],
        }))
      } catch {
        const note = maxStepsNote.trim()
        useAgentStore.getState().updateMessage(assistantId, (msg) => ({
          ...msg,
          parts: [...msg.parts, { type: 'text', text: `\n\n${note}` }],
        }))
      }
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
    usePageEditorStore.getState().setIsEditing(false)
    useAgentStore.getState().setRunning(false, null)
  }
}
