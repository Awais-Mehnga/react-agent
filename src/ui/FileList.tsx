import { FolderOpen, RotateCcw, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAgentStore } from '../agent/session/store'
import { resetPersistedWorkspace } from '../agent/session/persist'
import {
  clearFsaHandle,
  ensureFsaPermission,
  loadFsaHandle,
  pickDirectory,
  readDirectoryToFiles,
  saveFsaHandle,
} from '../agent/fs/fsa-sync'

export function FileList() {
  const files = useAgentStore((s) => s.files)
  const selectedPath = useAgentStore((s) => s.selectedPath)
  const selectFile = useAgentStore((s) => s.selectFile)
  const fsaName = useAgentStore((s) => s.fsaName)
  const setFsaRoot = useAgentStore((s) => s.setFsaRoot)
  const loadFilesFromMap = useAgentStore((s) => s.loadFilesFromMap)
  const [busy, setBusy] = useState(false)
  const [fsaError, setFsaError] = useState<string | null>(null)
  const paths = Object.keys(files).sort()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const handle = await loadFsaHandle()
      if (!handle || cancelled) return
      const ok = await ensureFsaPermission(handle)
      if (!ok || cancelled) return
      try {
        const map = await readDirectoryToFiles(handle)
        if (cancelled) return
        loadFilesFromMap(map)
        setFsaRoot(handle, handle.name)
      } catch {
        // permission or read failure — stay on seed/IDB workspace
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadFilesFromMap, setFsaRoot])

  const openFolder = async () => {
    setBusy(true)
    setFsaError(null)
    try {
      const picked = await pickDirectory()
      if (!picked) return
      const map = await readDirectoryToFiles(picked.handle)
      loadFilesFromMap(map)
      setFsaRoot(picked.handle, picked.name)
      await saveFsaHandle(picked.handle)
    } catch (error) {
      setFsaError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setFsaError(null)
    try {
      setFsaRoot(null, null)
      await clearFsaHandle()
      await resetPersistedWorkspace()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium tracking-wide text-zinc-300">Workspace</div>
          {fsaName ? (
            <div className="truncate font-mono text-[10px] text-emerald-500/80" title={fsaName}>
              {fsaName}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          {fsaName ? (
            <button
              type="button"
              title="Disconnect folder"
              disabled={busy}
              onClick={() => void disconnect()}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
            >
              <Unplug className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              title="Open folder"
              disabled={busy}
              onClick={() => void openFolder()}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
            >
              <FolderOpen className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            title="Reset workspace"
            disabled={busy || !!fsaName}
            onClick={() => void resetPersistedWorkspace()}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
      {fsaError ? <div className="border-b border-zinc-800 px-3 py-1.5 text-[10px] text-red-400">{fsaError}</div> : null}
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
