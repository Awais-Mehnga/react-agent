// GREENFIELD: Zustand session + workspace store.

import { create } from 'zustand'
import type { VirtualFS } from '../fs/types'
import { createMemoryFS } from '../fs/memory-fs'
import { normalizePath } from '../fs/paths'

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'tool'; toolName: string; status: 'running' | 'done' | 'error'; args?: unknown; result?: string }

export type ChatMessage = {
  id: string
  role: ChatRole
  parts: ChatPart[]
}

const SEED_FILES: Record<string, string> = {
  'src/App.tsx': `function App() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold">Hello World</h1>
    </div>
  )
}

export default App
`,
  'README.md': `# Demo Workspace

This is an in-browser VirtualFS for React Agent Phase 1.
Ask the agent to edit \`src/App.tsx\`.
`,
}

type AgentState = {
  files: Record<string, string>
  selectedPath: string
  messages: ChatMessage[]
  isRunning: boolean
  error: string | null
  readSet: Set<string>
  abortController: AbortController | null

  selectFile: (path: string) => void
  setFileContent: (path: string, content: string) => void
  upsertFile: (path: string, content: string) => void
  removeFile: (path: string) => void
  markRead: (path: string) => void
  wasRead: (path: string) => boolean
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updater: (msg: ChatMessage) => ChatMessage) => void
  setRunning: (running: boolean, controller?: AbortController | null) => void
  setError: (error: string | null) => void
  abort: () => void
  getFS: () => VirtualFS
}

export const useAgentStore = create<AgentState>((set, get) => ({
  files: { ...SEED_FILES },
  selectedPath: 'src/App.tsx',
  messages: [],
  isRunning: false,
  error: null,
  readSet: new Set<string>(),
  abortController: null,

  selectFile: (path) => set({ selectedPath: normalizePath(path) }),

  setFileContent: (path, content) => {
    const key = normalizePath(path)
    set((s) => ({ files: { ...s.files, [key]: content } }))
  },

  upsertFile: (path, content) => {
    const key = normalizePath(path)
    set((s) => ({
      files: { ...s.files, [key]: content },
      selectedPath: key,
    }))
  },

  removeFile: (path) => {
    const key = normalizePath(path)
    set((s) => {
      const next = { ...s.files }
      delete next[key]
      const selectedPath = s.selectedPath === key ? (Object.keys(next)[0] ?? '') : s.selectedPath
      return { files: next, selectedPath }
    })
  },

  markRead: (path) => {
    const key = normalizePath(path)
    set((s) => {
      const readSet = new Set(s.readSet)
      readSet.add(key)
      return { readSet }
    })
  },

  wasRead: (path) => get().readSet.has(normalizePath(path)),

  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

  updateMessage: (id, updater) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? updater(m) : m)),
    })),

  setRunning: (running, controller = null) =>
    set({
      isRunning: running,
      abortController: running ? controller : null,
      error: running ? null : get().error,
    }),

  setError: (error) => set({ error }),

  abort: () => {
    get().abortController?.abort()
    set({ isRunning: false, abortController: null })
  },

  getFS: (): VirtualFS =>
    createMemoryFS(
      () => useAgentStore.getState().files,
      {
        write: (path, content) => useAgentStore.getState().upsertFile(path, content),
        delete: (path) => useAgentStore.getState().removeFile(path),
      },
    ),
}))
