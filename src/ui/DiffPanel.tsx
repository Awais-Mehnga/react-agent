import { Undo2 } from 'lucide-react'
import { useAgentStore } from '../agent/session/store'

export function DiffPanel() {
  const lastDiff = useAgentStore((s) => s.lastDiff)
  const undoStack = useAgentStore((s) => s.undoStack)
  const undo = useAgentStore((s) => s.undo)

  if (!lastDiff && undoStack.length === 0) {
    return (
      <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-600">
        No recent diffs
      </div>
    )
  }

  return (
    <div className="flex max-h-48 min-h-0 flex-col border-t border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="truncate font-mono text-xs text-zinc-400">
          {lastDiff ? `diff · ${lastDiff.path}` : 'undo ready'}
        </div>
        <button
          type="button"
          onClick={() => undo()}
          disabled={undoStack.length === 0}
          className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
        >
          <Undo2 className="size-3.5" /> Undo ({undoStack.length})
        </button>
      </div>
      {lastDiff && (
        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-4 text-emerald-300/90">
          {lastDiff.patch}
        </pre>
      )}
    </div>
  )
}
