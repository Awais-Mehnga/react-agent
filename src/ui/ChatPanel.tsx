import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileEdit,
  FilePlus,
  History,
  ListTodo,
  Loader2,
  PanelLeftClose,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { useAgentStore, type ChatPart } from '../agent/session/store'

import { runAgentTurn } from '../agent/loop'
import { currentModelId, currentProvider } from '../agent/llm'
import { usePageEditorStore } from '../page/editorStore'

type Props = {
  onCollapse?: () => void
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function ToolCard({ part }: { part: Extract<ChatPart, { type: 'tool' }> }) {
  const [open, setOpen] = useState(false)
  const isWrite = part.toolName === 'write'
  const isEdit = part.toolName === 'edit'
  const isRead = part.toolName === 'read'
  const filePath = (part.args as { filePath?: string } | undefined)?.filePath

  const icon = isEdit ? (
    <FileEdit className="size-3.5 text-sky-400" />
  ) : isWrite ? (
    <FilePlus className="size-3.5 text-emerald-400" />
  ) : isRead ? (
    <FileCode className="size-3.5 text-amber-400" />
  ) : (
    <Wrench className="size-3.5 text-zinc-400" />
  )

  const label = part.result || `${part.toolName} ${filePath ?? ''}`.trim()
  const hasDetails = Boolean(part.result && part.result.length > 40)

  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 text-xs transition-colors hover:border-zinc-700/80">
      <div
        className={`flex items-center justify-between gap-2 ${hasDetails ? 'cursor-pointer select-none' : ''}`}
        onClick={() => hasDetails && setOpen((prev) => !prev)}
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate font-mono text-[11px] text-zinc-200">{label}</span>
          {filePath && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.2 font-mono text-[10px] text-zinc-400">
              {filePath}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {part.status === 'running' ? (
            <Loader2 className="size-3 animate-spin text-amber-400" />
          ) : part.status === 'error' ? (
            <span className="rounded bg-red-950 px-1.5 py-0.2 text-[10px] text-red-400 border border-red-800/50">
              Error
            </span>
          ) : (
            <CheckCircle2 className="size-3 text-emerald-400" />
          )}
          {hasDetails && (
            <button type="button" className="text-zinc-500 hover:text-zinc-300">
              {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
          )}
        </div>
      </div>
      {open && hasDetails && (
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed text-zinc-300">
          {part.result}
        </pre>
      )}
    </div>
  )
}

function ThinkingBlock({ text, isRunning }: { text: string; isRunning: boolean }) {
  const [open, setOpen] = useState(isRunning)

  useEffect(() => {
    if (isRunning) setOpen(true)
  }, [isRunning])

  if (!text.trim()) return null

  return (
    <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 text-xs shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-1.5 font-medium text-violet-300 hover:text-violet-200"
      >
        <span className="flex items-center gap-2">
          <Brain className={`size-3.5 ${isRunning ? 'animate-pulse text-violet-400' : 'text-violet-500'}`} />
          <span className="text-[11px] font-mono">
            {isRunning ? 'Thinking…' : 'Thought process'}
          </span>
        </span>
        <span className="text-[10px] text-violet-400/60">
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </span>
      </button>
      {open && (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap border-t border-violet-900/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-violet-200/90 selection:bg-violet-800">
          {text}
        </pre>
      )}
    </div>
  )
}

function CompactionBlock({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-sky-800/40 bg-sky-950/20 text-xs shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-1.5 font-medium text-sky-300 hover:text-sky-200"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-sky-400" />
          <span className="text-[11px] font-mono">Context Compacted (Prior Work Summarized)</span>
        </span>
        <span className="text-[10px] text-sky-400/60">
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </span>
      </button>
      {open && (
        <div className="max-h-60 overflow-auto whitespace-pre-wrap border-t border-sky-900/30 px-3 py-2 text-[11px] leading-relaxed text-zinc-300">
          {summary}
        </div>
      )}
    </div>
  )
}

export function ChatPanel({ onCollapse }: Props) {
  const sessions = useAgentStore((s) => s.sessions)
  const currentSessionId = useAgentStore((s) => s.currentSessionId)
  const messages = useAgentStore((s) => s.messages)
  const todos = useAgentStore((s) => s.todos)
  const isRunning = useAgentStore((s) => s.isRunning)
  const error = useAgentStore((s) => s.error)
  const abort = useAgentStore((s) => s.abort)
  const createSession = useAgentStore((s) => s.createSession)
  const switchSession = useAgentStore((s) => s.switchSession)
  const deleteSession = useAgentStore((s) => s.deleteSession)
  const selection = usePageEditorStore((s) => s.selection)
  const setSelection = usePageEditorStore((s) => s.setSelection)

  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === currentSessionId)
  const sessionTitle = activeSession?.title || 'Chat'
  const modelLabel = `${currentProvider()} · ${currentModelId()}`

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isRunning])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isRunning) return
    setInput('')
    await runAgentTurn(text)
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs font-semibold tracking-wide text-zinc-200">Agent</span>
            <span className="text-zinc-600">·</span>
            <span
              title={sessionTitle}
              className="truncate text-xs font-medium text-zinc-400"
            >
              {sessionTitle}
            </span>
          </div>
          <div className="font-mono text-[10px] text-zinc-500">{modelLabel}</div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="New Chat (+)"
            onClick={() => {
              createSession()
              setShowHistory(false)
            }}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Plus className="size-4" />
          </button>

          <button
            type="button"
            title="Chat History"
            onClick={() => setShowHistory((prev) => !prev)}
            className={`rounded p-1.5 transition-colors ${
              showHistory
                ? 'bg-zinc-800 text-sky-400'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <History className="size-4" />
          </button>

          {onCollapse ? (
            <button
              type="button"
              title="Collapse agent panel"
              onClick={onCollapse}
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <PanelLeftClose className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Body: History or Message Timeline */}
      {showHistory ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Chats ({sessions.length})
            </span>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="rounded p-1 text-zinc-500 hover:text-zinc-300"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {sessions.map((sess) => {
              const isActive = sess.id === currentSessionId
              return (
                <div
                  key={sess.id}
                  onClick={() => {
                    switchSession(sess.id)
                    setShowHistory(false)
                  }}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg border p-2.5 transition-all ${
                    isActive
                      ? 'border-sky-500/50 bg-sky-950/20 text-white shadow-sm'
                      : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      {isActive && <span className="size-1.5 shrink-0 rounded-full bg-sky-400 animate-pulse" />}
                      <div className="truncate font-medium text-xs text-zinc-200">
                        {sess.title || 'Untitled Chat'}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>{formatDate(sess.updatedAt)}</span>
                      <span>·</span>
                      <span>{sess.messages.length} messages</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    title="Delete Chat"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(sess.id)
                    }}
                    className="shrink-0 rounded p-1 text-zinc-500 opacity-60 transition-opacity hover:bg-red-950/50 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="border-t border-zinc-800 p-2.5">
            <button
              type="button"
              onClick={() => {
                createSession()
                setShowHistory(false)
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <Plus className="size-3.5" /> New Chat
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-3 text-sm">
          {messages.length === 0 && (
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3.5 text-xs leading-relaxed text-zinc-400">
              <p className="font-medium text-zinc-300">OpenCode-Powered Agent</p>
              <p className="mt-1">
                Ask for page designs, visual edits, or theme styling. The canvas previews in real time.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user'
            return (
              <div key={msg.id} className={isUser ? 'ml-4' : 'mr-1'}>
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {isUser ? 'You' : 'Assistant'}
                </div>

                <div
                  className={`space-y-2 rounded-xl p-3 ${
                    isUser
                      ? 'border border-sky-800/30 bg-sky-950/25 text-sky-100'
                      : 'border border-zinc-800/50 bg-zinc-900/30 text-zinc-200'
                  }`}
                >
                  {msg.parts.map((part, i) => {
                    if (part.type === 'thinking') {
                      const isCurrentRunning =
                        isRunning && msg.id === messages[messages.length - 1]?.id
                      return <ThinkingBlock key={i} text={part.text} isRunning={isCurrentRunning} />
                    }

                    if (part.type === 'compaction') {
                      return <CompactionBlock key={i} summary={part.summary} />
                    }

                    if (part.type === 'tool') {
                      return <ToolCard key={i} part={part} />
                    }

                    if (part.type === 'text') {
                      if (!part.text.trim()) return null
                      return (
                        <div key={i} className="whitespace-pre-wrap break-words leading-relaxed text-xs">
                          {part.text}
                        </div>
                      )
                    }

                    return null
                  })}
                </div>
              </div>
            )
          })}

          {/* Todos / Tasks display */}
          {todos.length > 0 && (
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5 text-xs">
              <div className="mb-1.5 flex items-center gap-1.5 font-medium text-zinc-400 text-[11px]">
                <ListTodo className="size-3.5 text-sky-400" />
                Tasks
              </div>
              <ul className="space-y-1">
                {todos.map((todo) => (
                  <li key={todo.id} className="flex items-center gap-2 text-zinc-300">
                    <span
                      className={`size-3 rounded border flex items-center justify-center ${
                        todo.status === 'completed'
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                          : 'border-zinc-600 bg-zinc-800'
                      }`}
                    >
                      {todo.status === 'completed' && <Check className="size-2.5" />}
                    </span>
                    <span className={todo.status === 'completed' ? 'line-through text-zinc-500' : ''}>
                      {todo.content}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <div className="border-t border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Selected Element Context Pill */}
      {selection && (
        <div className="flex items-center justify-between border-t border-sky-900/50 bg-sky-950/40 px-3 py-1.5 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5 truncate">
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-400">
              &lt;{selection.tagName}&gt;
            </span>
            <span className="truncate font-mono text-[11px] text-zinc-400">
              {selection.className
                ? `.${selection.className.split(/\s+/).slice(0, 3).join('.')}`
                : selection.eid}
            </span>
          </div>
          <button
            type="button"
            title="Clear element selection"
            onClick={() => setSelection(null)}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors ml-2 shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-zinc-800 p-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent to edit page.html or theme.css…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs outline-none focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500"
          disabled={isRunning}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={abort}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            <Square className="size-3" /> Stop
          </button>
        ) : (
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium hover:bg-sky-500 disabled:opacity-40 text-white transition-colors"
            disabled={!input.trim()}
          >
            <Send className="size-3" /> Send
          </button>
        )}
      </form>
    </div>
  )
}
