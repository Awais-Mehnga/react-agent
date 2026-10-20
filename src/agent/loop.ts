// GREENFIELD: agent loop inspired by OpenCode session/prompt.ts semantics (no Effect)
// PORT: OpenCode V2 tool-input streaming into pending tool parts + review-gated preview

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
import { stripPageChrome } from '../html/normalizePageHtml'
import { usePageEditorStore } from '../page/editorStore'
import { compactConversation } from './session/compaction'
import { generateSessionTitle } from './prompts/title'
import { replace } from './vendor/opencode/edit-replace'
import { normalizePath } from './fs/paths'
import type { CanvasSelection } from '../editor/Canvas'

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
    recent.every((c) => c.name === recent[0]!.name && c.input === recent[0]!.input)
  ) {
    throw new DoomLoopError(name)
  }
}

/** HTML needs near-immediate paints; CSS can coalesce slightly. */
const PREVIEW_DELAY_HTML_MS = 32
const PREVIEW_DELAY_CSS_MS = 80
let previewTimer: ReturnType<typeof setTimeout> | null = null
let pendingPreview: { path: string; content: string } | null = null

function cancelPreviewTimer() {
  if (previewTimer != null) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
}

function schedulePreview(path: string, content: string) {
  if (path !== 'page.html' && path !== 'theme.css') return
  if (!content) return
  pendingPreview = { path, content }
  cancelPreviewTimer()
  const delay = path === 'page.html' ? PREVIEW_DELAY_HTML_MS : PREVIEW_DELAY_CSS_MS
  previewTimer = setTimeout(() => {
    previewTimer = null
    const next = pendingPreview
    pendingPreview = null
    if (!next) return
    pushPreviewFile(next.path, next.content)
  }, delay)
}

/** Flush immediately (final tool args / committed FS write). */
function flushPreview(path: string, content: string) {
  if (path !== 'page.html' && path !== 'theme.css') return
  if (!content) return
  cancelPreviewTimer()
  pendingPreview = null
  pushPreviewFile(path, content)
}

/** Apply any coalesced stream snapshot before the turn ends. */
function flushPendingPreview() {
  cancelPreviewTimer()
  const next = pendingPreview
  pendingPreview = null
  if (next) pushPreviewFile(next.path, next.content)
}

function looksLikeCss(content: string): boolean {
  return /(?:^|\n)\s*(?:@(?:theme|import|keyframes)|:root|--[\w-]+\s*:)/m.test(content)
}

function looksLikeHtml(content: string): boolean {
  return /<\/?[a-zA-Z][\w:-]*\b/.test(content)
}

function pushPreviewFile(path: string, content: string) {
  if (path !== 'page.html' && path !== 'theme.css') return
  if (!content) return
  const editor = usePageEditorStore.getState()
  editor.setIsEditing(true)
  // Do not selectFile here — tab/file switching is user-controlled only.
  // Canvas still receives previewHtml / previewTheme overlays regardless of selection.
  if (path === 'page.html') {
    // No DOMPurify during stream — keep partial markup visible in code + visual.
    // While the model streams <head>, stripPageChrome is empty — keep prior paint.
    const stripped = stripPageChrome(content)
    if (!stripped.trim()) return
    editor.setPreviewHtml(stripped)
  } else {
    editor.setPreviewTheme(content)
  }
}

function previewFromWriteArgs(
  args: { filePath?: string; content?: string } | null | undefined,
  immediate = false,
) {
  if (!args?.filePath || typeof args.content !== 'string') return
  const path = normalizePath(args.filePath)
  if (path === 'page.html' || path === 'theme.css') {
    if (immediate) flushPreview(path, args.content)
    else schedulePreview(path, args.content)
  }
}

function previewFromEditArgs(
  args: {
    filePath?: string
    oldString?: string
    newString?: string
    replaceAll?: boolean
  } | null | undefined,
  immediate = false,
) {
  if (!args?.filePath || args.oldString == null || args.newString == null) return
  const path = normalizePath(args.filePath)
  if (path !== 'page.html' && path !== 'theme.css') return
  const push = immediate ? flushPreview : schedulePreview
  const fs = useAgentStore.getState().getFS()
  const current = fs.exists(path) ? fs.read(path) : ''
  if (!current && args.oldString === '') {
    push(path, args.newString)
    return
  }
  if (!current) return
  try {
    push(path, replace(current, args.oldString, args.newString, args.replaceAll ?? false))
    return
  } catch {
    // fall through to soft previews while args are still streaming
  }
  if (args.oldString.length >= 8 && current.includes(args.oldString)) {
    push(path, current.replace(args.oldString, args.newString))
    return
  }
  // Large HTML newString mid-stream: paint it directly once it looks like markup
  if (
    path === 'page.html' &&
    args.newString.length > 60 &&
    looksLikeHtml(args.newString) &&
    (!args.oldString || args.oldString.length < args.newString.length / 2)
  ) {
    push(path, args.newString)
  }
}

function toolChatSummary(toolName: string, args: unknown, result?: string): string {
  const a = (args ?? {}) as Record<string, unknown>
  const path = typeof a.filePath === 'string' ? a.filePath : ''
  if (result?.startsWith('Error:')) {
    return result.length > 160 ? `${result.slice(0, 157)}…` : result
  }
  if (toolName === 'write') return path ? `Wrote ${path}` : 'Wrote file'
  if (toolName === 'edit') return path ? `Edited ${path}` : 'Edited file'
  if (toolName === 'read') return path ? `Read ${path}` : 'Read file'
  if (toolName === 'apply_patch') return 'Applied patch'
  if (result && result.length < 120 && !result.includes('@@') && !result.includes('<')) return result
  return toolName
}

function isToolFailureOutput(output: string | undefined): boolean {
  if (!output) return true
  return output.startsWith('Error:') || output.startsWith('Error ')
}

function updateAssistantParts(
  assistantId: string,
  updater: (parts: ChatPart[]) => ChatPart[],
) {
  useAgentStore.getState().updateMessage(assistantId, (msg) => ({
    ...msg,
    parts: updater(msg.parts),
  }))
}

function upsertToolPart(
  assistantId: string,
  callId: string,
  patch: Partial<Extract<ChatPart, { type: 'tool' }>> & { toolName?: string },
) {
  updateAssistantParts(assistantId, (parts) => {
    const idx = parts.findIndex(
      (p) => p.type === 'tool' && (p.callId === callId || p.id === callId),
    )
    if (idx >= 0) {
      const prev = parts[idx] as Extract<ChatPart, { type: 'tool' }>
      const next = [...parts]
      next[idx] = { ...prev, ...patch, type: 'tool' }
      return next
    }
    return [
      ...parts,
      {
        type: 'tool' as const,
        id: callId,
        callId,
        toolName: patch.toolName ?? 'tool',
        status: patch.status ?? 'pending',
        raw: patch.raw ?? '',
        args: patch.args,
        result: patch.result,
        metadata: patch.metadata,
      },
    ]
  })
}

export async function runAgentTurn(userText: string): Promise<void> {
  const store = useAgentStore.getState()
  if (store.isRunning) return

  const controller = new AbortController()

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
  const toolMetaByCall = new Map<
    string,
    NonNullable<Extract<ChatPart, { type: 'tool' }>['metadata']>
  >()

  const tools = createToolSet(
    {
      fs,
      wasRead: (p) => useAgentStore.getState().wasRead(p),
      markRead: (p) => useAgentStore.getState().markRead(p),
      abort: controller.signal,
      pushUndo: (path, before, after) =>
        useAgentStore.getState().pushUndo(path, before, after),
      setLastDiff: (diff) => useAgentStore.getState().setLastDiff(diff),
      setTodos: (todos) => useAgentStore.getState().setTodos(todos),
      askQuestion: (questions) => useAgentStore.getState().askQuestion(questions),
    },
    (name, input) => recordDoomCall(recentCalls, name, input),
    {
      onToolResult: (name, input, result) => {
        if (result.metadata) {
          // keyed later by step finish when we have call ids; stash by tool+path
          const raw = (input as { filePath?: string })?.filePath
          const key = `${name}:${raw ? normalizePath(raw) : ''}`
          toolMetaByCall.set(key, result.metadata)
        }
      },
    },
  )

  const selection = usePageEditorStore.getState().selection
  const history = toModelMessages(
    useAgentStore.getState().messages.filter((m) => m.id !== assistantId),
    selection,
  )

  let toolInputBuf = ''
  let streamingToolName = ''
  let streamingCallId = ''
  let text = ''
  let thinking = ''

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
      ...(isReasoningModel ? { reasoning: 'low' as const } : {}),
      onStepFinish: ({ toolCalls, toolResults, content }) => {
        if (!toolCalls?.length) return
        // Match by toolCallId — arrays are not guaranteed parallel by index
        const resultsById = new Map(
          (toolResults ?? []).map((r) => [r.toolCallId, r] as const),
        )
        const errorsById = new Map<string, string>()
        for (const part of content ?? []) {
          if (part.type === 'tool-error') {
            const err = (part as { toolCallId: string; error: unknown }).error
            errorsById.set(
              part.toolCallId,
              err instanceof Error ? err.message : String(err ?? 'Tool failed'),
            )
          }
        }

        for (const call of toolCalls) {
          const res = resultsById.get(call.toolCallId)
          const thrownMsg = errorsById.get(call.toolCallId)
          const output = res != null ? String(res.output ?? '') : thrownMsg
          const failed = thrownMsg != null || isToolFailureOutput(output)
          const rawPath = (call.input as { filePath?: string } | undefined)?.filePath
          const path = rawPath ? normalizePath(rawPath) : undefined
          const metaKey = `${call.toolName}:${path ?? rawPath ?? ''}`
          const metadata =
            toolMetaByCall.get(metaKey) ??
            (rawPath ? toolMetaByCall.get(`${call.toolName}:${rawPath}`) : undefined)
          upsertToolPart(assistantId, call.toolCallId, {
            toolName: call.toolName,
            status: failed ? 'error' : 'done',
            args: call.input,
            result: toolChatSummary(call.toolName, call.input, output),
            metadata: metadata ? metadata : path ? { filepath: path } : undefined,
          })

          // Only paint canvas from committed FS when the tool actually succeeded
          if (
            !failed &&
            (call.toolName === 'write' ||
              call.toolName === 'edit' ||
              call.toolName === 'apply_patch') &&
            path &&
            (path === 'page.html' || path === 'theme.css') &&
            fs.exists(path)
          ) {
            flushPreview(path, fs.read(path))
          }
        }
      },
    })

    let lastToolPartUiAt = 0

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        thinking += chunk.text
        const snapshot = thinking
        updateAssistantParts(assistantId, (parts) => {
          const rest = parts.filter((p) => p.type !== 'thinking')
          return [{ type: 'thinking', text: snapshot }, ...rest]
        })
        continue
      }

      if (chunk.type === 'text-delta') {
        text += chunk.text
        const display = stripCodeForChat(text)
        updateAssistantParts(assistantId, (parts) => {
          const thinkingParts = parts.filter((p) => p.type === 'thinking')
          const toolParts = parts.filter((p) => p.type === 'tool')
          const otherParts = parts.filter(
            (p) => p.type !== 'text' && p.type !== 'thinking' && p.type !== 'tool',
          )
          return [
            ...thinkingParts,
            ...toolParts,
            ...otherParts,
            ...(display ? ([{ type: 'text' as const, text: display }] as const) : []),
          ]
        })
        const leaked = extractHtmlFromAssistantText(text)
        if (leaked && leaked.length > 20) {
          schedulePreview('page.html', leaked)
        }
        continue
      }

      if (chunk.type === 'tool-input-start') {
        toolInputBuf = ''
        streamingToolName = chunk.toolName
        streamingCallId = chunk.id
        upsertToolPart(assistantId, chunk.id, {
          toolName: chunk.toolName,
          status: 'pending',
          raw: '',
        })
        continue
      }

      if (chunk.type === 'tool-input-delta') {
        toolInputBuf += chunk.delta
        const callId = streamingCallId || chunk.id
        // Throttle timeline UI updates; preview updates every frame below
        const now = Date.now()
        if (now - lastToolPartUiAt > 80) {
          lastToolPartUiAt = now
          upsertToolPart(assistantId, callId, {
            toolName: streamingToolName,
            status: 'pending',
            raw: toolInputBuf,
          })
        }

        if (streamingToolName === 'write') {
          const rawPath = extractPartialJsonString(toolInputBuf, 'filePath')
          const content = extractPartialJsonString(toolInputBuf, 'content')
          if (!content) continue
          // Infer path when filePath streams after content (common for large HTML writes)
          let path = rawPath ? normalizePath(rawPath) : null
          if (!path || (path !== 'page.html' && path !== 'theme.css')) {
            if (looksLikeCss(content) && !looksLikeHtml(content)) path = 'theme.css'
            else if (looksLikeHtml(content)) path = 'page.html'
          }
          if (path === 'page.html' || path === 'theme.css') {
            schedulePreview(path, content)
          }
        } else if (streamingToolName === 'edit') {
          previewFromEditArgs({
            filePath: extractPartialJsonString(toolInputBuf, 'filePath') ?? undefined,
            oldString: extractPartialJsonString(toolInputBuf, 'oldString') ?? undefined,
            newString: extractPartialJsonString(toolInputBuf, 'newString') ?? undefined,
          })
        }
        continue
      }

      if (chunk.type === 'tool-input-end') {
        // Final preview from complete JSON before execute / permission gate
        try {
          const parsed = JSON.parse(toolInputBuf) as Record<string, unknown>
          if (streamingToolName === 'write') {
            previewFromWriteArgs(parsed as { filePath?: string; content?: string }, true)
          } else if (streamingToolName === 'edit') {
            previewFromEditArgs(
              parsed as {
                filePath?: string
                oldString?: string
                newString?: string
                replaceAll?: boolean
              },
              true,
            )
          }
        } catch {
          // partial JSON — already previewed from deltas
        }

        if (streamingCallId) {
          upsertToolPart(assistantId, streamingCallId, {
            toolName: streamingToolName,
            status: 'running',
            raw: toolInputBuf,
          })
        }
        toolInputBuf = ''
        streamingToolName = ''
        streamingCallId = ''
        continue
      }

      // Some providers only emit full tool-call (no input deltas)
      if (chunk.type === 'tool-call') {
        const name = chunk.toolName
        const input = chunk.input as Record<string, unknown> | undefined
        if (name === 'write') {
          previewFromWriteArgs(input as { filePath?: string; content?: string }, true)
        } else if (name === 'edit') {
          previewFromEditArgs(
            input as {
              filePath?: string
              oldString?: string
              newString?: string
              replaceAll?: boolean
            },
            true,
          )
        }
        upsertToolPart(assistantId, chunk.toolCallId, {
          toolName: name,
          status: 'running',
          args: input,
        })
      }
    }

    const finalDisplay = stripCodeForChat(text)
    if (finalDisplay) {
      updateAssistantParts(assistantId, (parts) => {
        const thinkingParts = parts.filter((p) => p.type === 'thinking')
        const toolParts = parts.filter((p) => p.type === 'tool')
        const otherParts = parts.filter(
          (p) => p.type !== 'text' && p.type !== 'thinking' && p.type !== 'tool',
        )
        return [
          ...thinkingParts,
          ...toolParts,
          ...otherParts,
          { type: 'text', text: finalDisplay },
        ]
      })
    }

    const steps = (await result.steps).length
    if (steps >= MAX_STEPS) {
      try {
        const currentMsgs = useAgentStore.getState().messages
        const summary = await compactConversation(currentMsgs, {
          abortSignal: controller.signal,
        })
        useAgentStore.getState().compactCurrentSession(summary)
        updateAssistantParts(assistantId, (parts) => [
          ...parts,
          {
            type: 'text',
            text: '\n\n*Session context compacted to continue smoothly in this chat.*',
          },
        ])
      } catch {
        const note = maxStepsNote.trim()
        updateAssistantParts(assistantId, (parts) => [
          ...parts,
          { type: 'text', text: `\n\n${note}` },
        ])
      }
    }

    await result.response
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (controller.signal.aborted && !(err instanceof DoomLoopError)) {
      useAgentStore.getState().setError('Cancelled')
    } else {
      useAgentStore.getState().setError(message)
      updateAssistantParts(assistantId, (parts) => [
        ...parts,
        { type: 'text', text: `\n\nError: ${message}` },
      ])
      if (err instanceof DoomLoopError) {
        controller.abort()
      }
    }
  } finally {
    // Land any in-flight stream snapshot, then drop overlay so canvas uses committed files
    flushPendingPreview()
    const liveFs = useAgentStore.getState().getFS()
    if (liveFs.exists('page.html')) {
      flushPreview('page.html', liveFs.read('page.html'))
    }
    if (liveFs.exists('theme.css')) {
      flushPreview('theme.css', liveFs.read('theme.css'))
    }
    // Defer clear so the last morph paints before we switch to committed store content
    queueMicrotask(() => {
      usePageEditorStore.getState().clearPreview()
      usePageEditorStore.getState().setIsEditing(false)
    })
    useAgentStore.getState().setRunning(false, null)
  }
}
