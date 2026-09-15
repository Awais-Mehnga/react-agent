import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Send, Square } from 'lucide-react'
import { useAgentStore } from '../agent/session/store'
import { runAgentTurn } from '../agent/loop'

export function ChatPanel() {
  const messages = useAgentStore((s) => s.messages)
  const isRunning = useAgentStore((s) => s.isRunning)
  const error = useAgentStore((s) => s.error)
  const abort = useAgentStore((s) => s.abort)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

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
    <div className="flex h-full min-h-0 flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-medium tracking-wide text-zinc-300">
        Agent
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {messages.length === 0 && (
          <p className="text-zinc-500">
            Ask the agent to edit workspace files. Example: change the Hello World heading in src/App.tsx.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'text-sky-200' : 'text-zinc-200'}>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">{msg.role}</div>
            <div className="space-y-2 whitespace-pre-wrap break-words">
              {msg.parts.map((part, i) => {
                if (part.type === 'text') {
                  return <div key={i}>{part.text}</div>
                }
                return (
                  <div
                    key={i}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-amber-200"
                  >
                    {part.status === 'running' ? '…' : '✓'} {part.toolName}
                    {part.result ? (
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-zinc-400">
                        {part.result.slice(0, 800)}
                      </pre>
                    ) : null}
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
          placeholder="Message the coding agent…"
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
