import { useState } from 'react'
import { ChevronDown, ChevronUp, Redo2, Undo2 } from 'lucide-react'
import { useAgentStore } from '../agent/session/store'
import { DiffView } from './DiffView'

export function DiffPanel() {
  const lastDiff = useAgentStore((s) => s.lastDiff)
  const undoStack = useAgentStore((s) => s.undoStack)
  const redoStack = useAgentStore((s) => s.redoStack)
  const undo = useAgentStore((s) => s.undo)
  const redo = useAgentStore((s) => s.redo)

  const patch = lastDiff?.patch
  const path = lastDiff?.path
  const hasContent = Boolean(patch || undoStack.length > 0)

  const [open, setOpen] = useState(false)

  if (!hasContent) {
    return null
  }

  return (
    <div className="flex min-h-0 shrink-0 flex-col border-t border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-1.5 truncate font-mono text-xs text-zinc-400 hover:text-zinc-200"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronUp className="size-3.5 shrink-0" />}
          {path ? <span>diff · {path}</span> : <span>history</span>}
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => undo()}
            disabled={undoStack.length === 0}
            className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            <Undo2 className="size-3.5" /> Undo ({undoStack.length})
          </button>
          <button
            type="button"
            onClick={() => redo()}
            disabled={redoStack.length === 0}
            className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            <Redo2 className="size-3.5" /> Redo ({redoStack.length})
          </button>
        </div>
      </div>
      {open ? (
        <div className="max-h-56 min-h-0 overflow-hidden border-t border-zinc-800">
          {patch ? (
            <DiffView patch={patch} path={path} className="h-full max-h-56 overflow-auto p-3" />
          ) : (
            <div className="px-3 py-2 text-xs text-zinc-600">No recent diffs</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
