// GREENFIELD: Zustand session + workspace store (Phase 1 + Phase 2 polish).

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { VirtualFS } from '../fs/types'
import { createMemoryFS } from '../fs/memory-fs'
import { normalizePath } from '../fs/paths'
import { fsaDelete, fsaWrite } from '../fs/fsa-sync'
import themeSeed from '../../styles/theme.css?raw'
import { assertAllowedWorkspacePath, filterAllowedFiles } from '../../page/allowedFiles'

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
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
  'page.html': `<section class="py-24 bg-surface">
  <div class="mx-auto max-w-6xl px-6">
    <h1 class="text-5xl font-bold text-ink animate-fade-in">
      Build something beautiful
    </h1>
    <p class="mt-4 max-w-2xl text-lg text-ink-muted">
      Double-click this text to edit. Double-click the image to replace it. Ask the agent to redesign the page.
    </p>
    <img
      src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80"
      alt="Workspace"
      class="mt-8 w-full rounded-card shadow-lg">
    <div class="mt-10">
      <a href="#" class="inline-block rounded-button bg-brand px-6 py-3 font-medium text-white">
        Get started
      </a>
    </div>
  </div>
</section>

<section class="py-20 bg-surface-muted">
  <div class="mx-auto max-w-6xl px-6">
    <h2 class="text-3xl font-bold text-ink">Latest articles</h2>
    <div
      data-stub="blog-grid"
      data-source="posts"
      data-limit="6"
      data-category="all"
      class="mt-10 grid gap-8 md:grid-cols-3">
      <article data-slot="item" class="rounded-card bg-surface p-6 shadow-sm">
        <img data-field="image" alt="" class="aspect-video w-full rounded-xl object-cover" src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80">
        <h3 data-field="title" class="mt-4 text-xl font-semibold text-ink">Sample post</h3>
        <p data-field="excerpt" class="mt-2 text-ink-muted">A stub card — Laravel fills real posts later.</p>
        <a data-field="url" href="#" class="mt-4 inline-block text-brand">Read more</a>
      </article>
    </div>
  </div>
</section>
`,
  'theme.css': themeSeed,
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
  fsaRoot: FileSystemDirectoryHandle | null
  fsaName: string | null
  mcpServers: Array<{ name: string; url: string; connected: boolean }>
  mcpToolDefs: import('ai').ToolSet

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
  setFsaRoot: (handle: FileSystemDirectoryHandle | null, name?: string | null) => void
  loadFilesFromMap: (files: Record<string, string>) => void
  setMcpServers: (servers: Array<{ name: string; url: string; connected: boolean }>) => void
  setMcpToolDefs: (tools: import('ai').ToolSet) => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  files: { ...SEED_FILES },
  selectedPath: 'page.html',
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
  fsaRoot: null,
  fsaName: null,
  mcpServers: [],
  mcpToolDefs: {},

  selectFile: (path) => {
    assertAllowedWorkspacePath(path)
    set({ selectedPath: normalizePath(path) })
  },

  setFileContent: (path, content) => {
    assertAllowedWorkspacePath(path)
    const key = normalizePath(path)
    set((s) => ({ files: { ...s.files, [key]: content } }))
    const root = get().fsaRoot
    if (root) void fsaWrite(root, key, content).catch(() => undefined)
  },

  upsertFile: (path, content) => {
    assertAllowedWorkspacePath(path)
    const key = normalizePath(path)
    set((s) => ({
      files: { ...s.files, [key]: content },
      selectedPath: key,
    }))
    const root = get().fsaRoot
    if (root) void fsaWrite(root, key, content).catch(() => undefined)
  },

  removeFile: (path) => {
    const key = normalizePath(path)
    set((s) => {
      const next = { ...s.files }
      delete next[key]
      const selectedPath = s.selectedPath === key ? (Object.keys(next)[0] ?? '') : s.selectedPath
      return { files: next, selectedPath }
    })
    const root = get().fsaRoot
    if (root) void fsaDelete(root, key).catch(() => undefined)
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
    const { undoStack, files, fsaRoot } = get()
    if (undoStack.length === 0) return false
    const entry = undoStack[undoStack.length - 1]
    const nextStack = undoStack.slice(0, -1)
    const nextFiles = { ...files }
    if (entry.before === null) {
      delete nextFiles[entry.path]
      if (fsaRoot) void fsaDelete(fsaRoot, entry.path).catch(() => undefined)
    } else {
      nextFiles[entry.path] = entry.before
      if (fsaRoot) void fsaWrite(fsaRoot, entry.path, entry.before).catch(() => undefined)
    }
    set({
      files: nextFiles,
      undoStack: nextStack,
      lastDiff: null,
      selectedPath: entry.path in nextFiles ? entry.path : (Object.keys(nextFiles)[0] ?? ''),
    })
    const root = get().fsaRoot
    if (root) {
      if (entry.before === null) void fsaDelete(root, entry.path).catch(() => undefined)
      else void fsaWrite(root, entry.path, entry.before).catch(() => undefined)
    }
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
    const allowed = filterAllowedFiles(data.files)
    const files = { ...SEED_FILES, ...allowed }
    const selected =
      data.selectedPath && files[normalizePath(data.selectedPath)]
        ? normalizePath(data.selectedPath)
        : 'page.html'
    set({
      files,
      messages: data.messages,
      todos: data.todos,
      selectedPath: selected,
      readSet: new Set<string>(),
      undoStack: [],
      lastDiff: null,
      hydrated: true,
    })
  },

  resetWorkspace: () => {
    set({
      files: { ...SEED_FILES },
      selectedPath: 'page.html',
      messages: [],
      todos: [],
      readSet: new Set<string>(),
      undoStack: [],
      lastDiff: null,
      error: null,
      pendingQuestion: null,
      fsaRoot: null,
      fsaName: null,
    })
  },

  setHydrated: (value) => set({ hydrated: value }),

  setFsaRoot: (handle, name = null) => set({ fsaRoot: handle, fsaName: name }),

  loadFilesFromMap: (files) => {
    const allowed = filterAllowedFiles(files)
    const merged = Object.keys(allowed).length > 0 ? { ...SEED_FILES, ...allowed } : { ...SEED_FILES }
    set({
      files: merged,
      selectedPath: merged['page.html'] ? 'page.html' : Object.keys(merged)[0] ?? '',
      readSet: new Set<string>(),
      undoStack: [],
      lastDiff: null,
    })
  },

  setMcpServers: (servers) => set({ mcpServers: servers }),

  setMcpToolDefs: (tools) => set({ mcpToolDefs: tools }),
}))

export function newTodoId(): string {
  return nanoid(8)
}
