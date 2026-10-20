// GREENFIELD: Zustand session + workspace store (streaming timeline + undo/redo).

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { VirtualFS } from '../fs/types'
import { createMemoryFS } from '../fs/memory-fs'
import { normalizePath } from '../fs/paths'
import { fsaDelete, fsaWrite } from '../fs/fsa-sync'
import themeSeed from '../../styles/theme.css?raw'
import { assertAllowedWorkspacePath, filterAllowedFiles } from '../../page/allowedFiles'

export type ChatRole = 'user' | 'assistant' | 'system'

export type ToolPartStatus = 'pending' | 'running' | 'done' | 'error'

export type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | {
      type: 'tool'
      id: string
      callId?: string
      toolName: string
      status: ToolPartStatus
      raw?: string
      args?: unknown
      result?: string
      metadata?: {
        filepath?: string
        diff?: string
        files?: Array<{ filepath: string; diff: string }>
      }
    }
  | { type: 'compaction'; summary: string }

export type ChatMessage = {
  id: string
  role: ChatRole
  parts: ChatPart[]
}

export type SessionItem = {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
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
  after: string | null
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
  'page.html': `<section class="relative min-h-[85vh] overflow-hidden bg-surface">
  <div class="mx-auto grid min-h-[85vh] max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-12">
    <div class="lg:col-span-5 animate-slide-up">
      <p class="font-sans text-sm font-medium tracking-wide text-brand uppercase">RemoteShifts</p>
      <h1 class="font-display mt-4 text-5xl font-bold leading-[1.05] tracking-tight text-ink md:text-6xl">
        Shifts that feel human again
      </h1>
      <p class="font-sans mt-5 max-w-md text-lg text-ink-muted">
        Double-click copy to edit. Ask the agent to redesign — it must pick expressive fonts and a real brand direction.
      </p>
      <div class="mt-8 flex flex-wrap items-center gap-4">
        <a href="#" class="font-sans inline-block rounded-button bg-brand px-6 py-3 text-sm font-medium text-white transition duration-200 hover:-translate-y-0.5">
          Start a schedule
        </a>
        <a href="#stories" class="font-sans text-sm font-medium text-ink underline decoration-brand/40 underline-offset-4">
          Read stories
        </a>
      </div>
    </div>
    <div class="lg:col-span-7 animate-fade-in">
      <img
        src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1400&q=80"
        alt="Team collaborating across a long table"
        class="h-full min-h-[280px] w-full rounded-card object-cover shadow-lg">
    </div>
  </div>
</section>

<section id="stories" class="bg-surface-muted py-20">
  <div class="mx-auto max-w-6xl px-6">
    <div class="flex items-end justify-between gap-6">
      <h2 class="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">Latest articles</h2>
      <p class="font-sans hidden max-w-xs text-sm text-ink-muted md:block">Stub grid — Laravel fills real posts later.</p>
    </div>
    <div
      data-stub="blog-grid"
      data-source="posts"
      data-limit="6"
      data-category="all"
      class="mt-10 grid gap-8 md:grid-cols-2">
      <article data-slot="item" class="md:col-span-1">
        <img data-field="image" alt="" class="aspect-[16/10] w-full rounded-card object-cover" src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80">
        <h3 data-field="title" class="font-display mt-4 text-2xl font-semibold text-ink">Sample post</h3>
        <p data-field="excerpt" class="font-sans mt-2 text-ink-muted">A stub card — platform fills real posts later.</p>
        <a data-field="url" href="#" class="font-sans mt-4 inline-block text-brand">Read more</a>
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
  sessions: SessionItem[]
  currentSessionId: string
  messages: ChatMessage[]
  todos: TodoItem[]
  isRunning: boolean
  error: string | null
  readSet: Set<string>
  abortController: AbortController | null
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
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
  syncCurrentSession: () => void
  createSession: (title?: string) => string
  switchSession: (id: string) => void
  deleteSession: (id: string) => void
  updateSessionTitle: (id: string, title: string) => void
  compactCurrentSession: (summary: string) => void
  setRunning: (running: boolean, controller?: AbortController | null) => void
  setError: (error: string | null) => void
  abort: () => void
  getFS: () => VirtualFS

  pushUndo: (path: string, before: string | null, after?: string | null) => void
  undo: () => boolean
  redo: () => boolean
  setLastDiff: (diff: LastDiff | null) => void
  setTodos: (todos: TodoItem[]) => void
  askQuestion: (questions: QuestionPrompt[]) => Promise<string[][]>
  answerQuestion: (answers: string[][]) => void
  cancelQuestion: () => void
  hydrate: (data: {
    files: Record<string, string>
    sessions?: SessionItem[]
    currentSessionId?: string
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

const defaultSessionId = nanoid()

export const useAgentStore = create<AgentState>((set, get) => ({
  files: { ...SEED_FILES },
  selectedPath: 'page.html',
  sessions: [
    {
      id: defaultSessionId,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  currentSessionId: defaultSessionId,
  messages: [],
  todos: [],
  isRunning: false,
  error: null,
  readSet: new Set<string>(),
  abortController: null,
  undoStack: [],
  redoStack: [],
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
      selectedPath: s.selectedPath ? s.selectedPath : key,
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

  // PORT: do not mirror sessions on every token — sync on turn end
  updateMessage: (id, updater) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? updater(m) : m)),
    })),

  syncCurrentSession: () => {
    const { currentSessionId, messages, sessions } = get()
    set({
      sessions: sessions.map((sess) =>
        sess.id === currentSessionId ? { ...sess, messages, updatedAt: Date.now() } : sess,
      ),
    })
  },

  createSession: (title = 'New Chat') => {
    const id = nanoid()
    const newSession: SessionItem = {
      id,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((s) => {
      const sessions = s.sessions.map((sess) =>
        sess.id === s.currentSessionId ? { ...sess, messages: s.messages } : sess,
      )
      return {
        sessions: [newSession, ...sessions],
        currentSessionId: id,
        messages: [],
        error: null,
      }
    })
    return id
  },

  switchSession: (id) => {
    const { sessions, currentSessionId, messages } = get()
    if (id === currentSessionId) return
    const syncedSessions = sessions.map((sess) =>
      sess.id === currentSessionId ? { ...sess, messages } : sess,
    )
    const target = syncedSessions.find((sess) => sess.id === id)
    if (!target) return
    set({
      sessions: syncedSessions,
      currentSessionId: id,
      messages: target.messages,
      error: null,
    })
  },

  deleteSession: (id) => {
    const { sessions, currentSessionId } = get()
    const remaining = sessions.filter((s) => s.id !== id)
    if (remaining.length === 0) {
      const freshId = nanoid()
      const fresh: SessionItem = {
        id: freshId,
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set({
        sessions: [fresh],
        currentSessionId: freshId,
        messages: [],
        error: null,
      })
      return
    }

    if (currentSessionId === id) {
      const nextSession = remaining[0]!
      set({
        sessions: remaining,
        currentSessionId: nextSession.id,
        messages: nextSession.messages,
        error: null,
      })
    } else {
      set({ sessions: remaining })
    }
  },

  updateSessionTitle: (id, title) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title, updatedAt: Date.now() } : sess,
      ),
    }))
  },

  compactCurrentSession: (summary) => {
    const { currentSessionId, messages } = get()
    const keepCount = Math.min(2, messages.length)
    const recent = messages.slice(messages.length - keepCount)
    const compactionMsg: ChatMessage = {
      id: nanoid(),
      role: 'assistant',
      parts: [{ type: 'compaction', summary }],
    }
    const compactedMessages = [compactionMsg, ...recent]
    set((s) => ({
      messages: compactedMessages,
      sessions: s.sessions.map((sess) =>
        sess.id === currentSessionId
          ? { ...sess, messages: compactedMessages, updatedAt: Date.now() }
          : sess,
      ),
    }))
  },

  setRunning: (running, controller = null) => {
    set({
      isRunning: running,
      abortController: running ? controller : null,
      error: running ? null : get().error,
    })
    if (!running) get().syncCurrentSession()
  },

  setError: (error) => set({ error }),

  abort: () => {
    get().abortController?.abort()
    get().cancelQuestion()
    set({ isRunning: false, abortController: null })
    get().syncCurrentSession()
  },

  getFS: (): VirtualFS =>
    createMemoryFS(
      () => useAgentStore.getState().files,
      {
        write: (path, content) => useAgentStore.getState().upsertFile(path, content),
        delete: (path) => useAgentStore.getState().removeFile(path),
      },
    ),

  pushUndo: (path, before, after = null) => {
    const key = normalizePath(path)
    set((s) => ({
      undoStack: [...s.undoStack, { path: key, before, after }].slice(-UNDO_CAP),
      redoStack: [],
    }))
  },

  undo: () => {
    const { undoStack, files, fsaRoot, redoStack } = get()
    if (undoStack.length === 0) return false
    const entry = undoStack[undoStack.length - 1]!
    const nextStack = undoStack.slice(0, -1)
    const currentAfter = files[entry.path] ?? null
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
      redoStack: [...redoStack, { path: entry.path, before: entry.before, after: currentAfter }].slice(-UNDO_CAP),
      lastDiff: null,
      selectedPath: entry.path in nextFiles ? entry.path : (Object.keys(nextFiles)[0] ?? ''),
    })
    return true
  },

  redo: () => {
    const { redoStack, files, fsaRoot, undoStack } = get()
    if (redoStack.length === 0) return false
    const entry = redoStack[redoStack.length - 1]!
    const nextRedo = redoStack.slice(0, -1)
    const currentBefore = files[entry.path] ?? null
    const nextFiles = { ...files }
    if (entry.after === null) {
      delete nextFiles[entry.path]
      if (fsaRoot) void fsaDelete(fsaRoot, entry.path).catch(() => undefined)
    } else {
      nextFiles[entry.path] = entry.after
      if (fsaRoot) void fsaWrite(fsaRoot, entry.path, entry.after).catch(() => undefined)
    }
    set({
      files: nextFiles,
      redoStack: nextRedo,
      undoStack: [...undoStack, { path: entry.path, before: currentBefore, after: entry.after }].slice(-UNDO_CAP),
      selectedPath: entry.path in nextFiles ? entry.path : (Object.keys(nextFiles)[0] ?? ''),
    })
    return true
  },

  setLastDiff: (diff) => set({ lastDiff: diff }),

  setTodos: (todos) => set({ todos }),

  askQuestion: (questions) =>
    new Promise<string[][]>((resolve, reject) => {
      set({ pendingQuestion: { questions, resolve, reject } })
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

    let sessions = data.sessions ?? []
    let currentSessionId = data.currentSessionId ?? ''
    let messages = data.messages ?? []

    if (sessions.length === 0) {
      const defaultId = nanoid()
      sessions = [
        {
          id: defaultId,
          title: messages.length > 0 ? 'Chat 1' : 'New Chat',
          messages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]
      currentSessionId = defaultId
    } else {
      const active = sessions.find((s) => s.id === currentSessionId) ?? sessions[0]!
      currentSessionId = active.id
      messages = active.messages
    }

    set({
      files,
      sessions,
      currentSessionId,
      messages,
      todos: data.todos,
      selectedPath: selected,
      readSet: new Set<string>(),
      undoStack: [],
      redoStack: [],
      lastDiff: null,
      hydrated: true,
    })
  },

  resetWorkspace: () => {
    set({
      files: { ...SEED_FILES },
      selectedPath: 'page.html',
      todos: [],
      readSet: new Set<string>(),
      undoStack: [],
      redoStack: [],
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
      redoStack: [],
      lastDiff: null,
    })
  },

  setMcpServers: (servers) => set({ mcpServers: servers }),
  setMcpToolDefs: (tools) => set({ mcpToolDefs: tools }),
}))

export function newTodoId(): string {
  return nanoid(8)
}
