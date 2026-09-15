import { RotateCcw } from 'lucide-react'
import { useAgentStore } from '../agent/session/store'
import { resetPersistedWorkspace } from '../agent/session/persist'

export function FileList() {
  const files = useAgentStore((s) => s.files)
  const selectedPath = useAgentStore((s) => s.selectedPath)
  const selectFile = useAgentStore((s) => s.selectFile)
  const paths = Object.keys(files).sort()

  return (
    <div className="flex min-h-0 flex-1 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div className="text-sm font-medium tracking-wide text-zinc-300">Workspace</div>
        <button
          type="button"
          title="Reset workspace"
          onClick={() => void resetPersistedWorkspace()}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
        {paths.map((path) => (
          <li key={path}>
            <button
              type="button"
              onClick={() => selectFile(path)}
              className={`w-full rounded px-2 py-1.5 text-left font-mono text-xs ${
                selectedPath === path ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              {path}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
