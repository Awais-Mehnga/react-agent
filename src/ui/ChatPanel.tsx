import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, PanelLeftClose, Send, Square } from 'lucide-react'
import { useAgentStore } from '../agent/session/store'
import { runAgentTurn } from '../agent/loop'
import { currentModelId, currentProvider } from '../agent/llm'

type Props = {
  onCollapse?: () => void
}

export function ChatPanel({ onCollapse }: Props) {
  const messages = useAgentStore((s) => s.messages)
  const isRunning = useAgentStore((s) => s.isRunning)
  const error = useAgentStore((s) => s.error)
  const abort = useAgentStore((s) => s.abort)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
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
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium tracking-wide text-zinc-300">Agent</div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">{modelLabel}</div>
        </div>
        {onCollapse ? (
          <button
            type="button"
            title="Collapse agent"
            onClick={onCollapse}
            className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {messages.length === 0 && (
          <p className="text-zinc-500">
            Ask for page or theme changes. The canvas updates live — keep replies in the chat short.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'text-sky-200' : 'text-zinc-200'}>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">{msg.role}</div>
            <div className="space-y-2 whitespace-pre-wrap break-words">
              {msg.parts.map((part, i) => {
                if (part.type === 'thinking') {
                  if (!part.text.trim()) return null
                  const isCurrentRunning = isRunning && msg.id === messages[messages.length - 1]?.id
                  return (
                    <details
                      key={i}
                      open={isCurrentRunning}
                      className="group rounded-lg border border-violet-800/40 bg-violet-950/25 text-xs shadow-sm transition-all"
                    >
                      <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-1.5 font-medium tracking-wide text-violet-300 hover:text-violet-200">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`size-1.5 rounded-full ${
                              isCurrentRunning ? 'bg-violet-400 animate-pulse' : 'bg-violet-500/60'
                            }`}
                          />
                          DeepSeek Thinking
                        </span>
                        <span className="text-[10px] text-violet-400/60 transition-transform group-open:rotate-180">
                          ▼
                        </span>
                      </summary>
                      <pre className="max-h-60 overflow-auto whitespace-pre-wrap border-t border-violet-900/30 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-violet-200/90 selection:bg-violet-800">
                        {part.text}
                      </pre>
                    </details>
                  )
                }
                if (part.type === 'text') {
                  if (!part.text.trim()) return null
                  return <div key={i}>{part.text}</div>
                }
                return (
                  <div
                    key={i}
                    className="rounded border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 font-mono text-[11px] text-amber-200/90"
                  >
                    {part.status === 'running' ? '…' : '✓'} {part.result || part.toolName}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <div className="border-t border-red-900 bg-red-950/50 px-4 py-2 text-xs text-red-300">{error}</div>}
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-zinc-800 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent to edit page.html or theme.css…"
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          disabled={isRunning}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={abort}
            className="inline-flex items-center gap-1 rounded bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
          >
            <Square className="size-3.5" /> Stop
          </button>
        ) : (
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded bg-sky-700 px-3 py-2 text-sm hover:bg-sky-600 disabled:opacity-40"
            disabled={!input.trim()}
          >
            <Send className="size-3.5" /> Send
          </button>
        )}
        {isRunning && <Loader2 className="size-5 animate-spin self-center text-zinc-400" />}
      </form>
    </div>
  )
}
