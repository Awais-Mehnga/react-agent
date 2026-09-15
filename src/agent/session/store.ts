// GREENFIELD: Zustand session + workspace store (Phase 1 + Phase 2 polish).

import { create } from 'zustand'
import { nanoid } from 'nanoid'
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

export type TodoItem = {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

export type UndoEntry = {
  path: string
  before: string | null
}

export type LastDiff = {
  path: string
  patch: string
}

export type QuestionOption = {
  label: string
  description?: string
}

export type QuestionPrompt = {
  question: string
  header?: string
  options: QuestionOption[]
  multiple?: boolean
  custom?: boolean
}

export type PendingQuestion = {
  questions: QuestionPrompt[]
  resolve: (answers: string[][]) => void
  reject: (reason?: Error) => void
}

export const SEED_FILES: Record<string, string> = {
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

const UNDO_CAP = 50

type AgentState = {
  files: Record<string, string>
  selectedPath: string
  messages: ChatMessage[]
  todos: TodoItem[]
  isRunning: boolean
  error: string | null
  readSet: Set<string>
  abortController: AbortController | null
  undoStack: UndoEntry[]
  lastDiff: LastDiff | null
  pendingQuestion: PendingQuestion | null
  hydrated: boolean

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

  pushUndo: (path: string, before: string | null) => void
  undo: () => boolean
  setLastDiff: (diff: LastDiff | null) => void
  setTodos: (todos: TodoItem[]) => void
  askQuestion: (questions: QuestionPrompt[]) => Promise<string[][]>
  answerQuestion: (answers: string[][]) => void
  cancelQuestion: () => void
  hydrate: (data: {
    files: Record<string, string>
    messages: ChatMessage[]
    todos: TodoItem[]
    selectedPath: string
  }) => void
  resetWorkspace: () => void
  setHydrated: (value: boolean) => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  files: { ...SEED_FILES },
  selectedPath: 'src/App.tsx',
  messages: [],
  todos: [],
  isRunning: false,
  error: null,
  readSet: new Set<string>(),
  abortController: null,
  undoStack: [],
  lastDiff: null,
  pendingQuestion: null,
  hydrated: false,

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
    get().cancelQuestion()
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

  pushUndo: (path, before) => {
    const key = normalizePath(path)
    set((s) => ({
      undoStack: [...s.undoStack, { path: key, before }].slice(-UNDO_CAP),
    }))
  },

  undo: () => {
    const { undoStack, files } = get()
    if (undoStack.length === 0) return false
    const entry = undoStack[undoStack.length - 1]
    const nextStack = undoStack.slice(0, -1)
    const nextFiles = { ...files }
    if (entry.before === null) {
      delete nextFiles[entry.path]
    } else {
      nextFiles[entry.path] = entry.before
    }
    set({
      files: nextFiles,
      undoStack: nextStack,
      lastDiff: null,
      selectedPath: entry.path in nextFiles ? entry.path : (Object.keys(nextFiles)[0] ?? ''),
    })
    return true
  },

  setLastDiff: (diff) => set({ lastDiff: diff }),

  setTodos: (todos) => set({ todos }),

  askQuestion: (questions) =>
    new Promise<string[][]>((resolve, reject) => {
      set({
        pendingQuestion: {
          questions,
          resolve,
          reject,
        },
      })
    }),

  answerQuestion: (answers) => {
    const pending = get().pendingQuestion
    if (!pending) return
    set({ pendingQuestion: null })
    pending.resolve(answers)
  },

  cancelQuestion: () => {
    const pending = get().pendingQuestion
    if (!pending) return
    set({ pendingQuestion: null })
    pending.reject(new Error('Question cancelled'))
  },

  hydrate: (data) => {
    set({
      files: data.files,
      messages: data.messages,
      todos: data.todos,
      selectedPath: data.selectedPath || Object.keys(data.files)[0] || '',
      readSet: new Set<string>(),
      undoStack: [],
      lastDiff: null,
      hydrated: true,
    })
  },

  resetWorkspace: () => {
    set({
      files: { ...SEED_FILES },
      selectedPath: 'src/App.tsx',
      messages: [],
      todos: [],
      readSet: new Set<string>(),
      undoStack: [],
      lastDiff: null,
      error: null,
      pendingQuestion: null,
    })
  },

  setHydrated: (value) => set({ hydrated: value }),
}))

export function newTodoId(): string {
  return nanoid(8)
}
