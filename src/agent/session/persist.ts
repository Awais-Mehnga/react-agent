// GREENFIELD: IndexedDB persistence for workspace + chat + todos

import { useAgentStore, type ChatMessage, type TodoItem } from './store'

const DB_NAME = 'react-agent'
const STORE_NAME = 'session'
const KEY = 'react-agent-v1'

export type PersistedSession = {
  files: Record<string, string>
  messages: ChatMessage[]
  todos: TodoItem[]
  selectedPath: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
  })
}

export async function loadSession(): Promise<PersistedSession | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(KEY)
    req.onsuccess = () => resolve((req.result as PersistedSession | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('Failed to read session'))
  })
}

export async function saveSession(data: PersistedSession): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save session'))
  })
}

export async function clearSession(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear session'))
  })
}

export async function hydrateFromIdb(): Promise<void> {
  try {
    const data = await loadSession()
    if (data?.files && Object.keys(data.files).length > 0) {
      useAgentStore.getState().hydrate({
        files: data.files,
        messages: data.messages ?? [],
        todos: data.todos ?? [],
        selectedPath: data.selectedPath,
      })
    } else {
      useAgentStore.getState().setHydrated(true)
    }
  } catch {
    useAgentStore.getState().setHydrated(true)
  }
}

export function bindPersistSubscription(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const unsub = useAgentStore.subscribe((state) => {
    if (!state.hydrated) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void saveSession({
        files: state.files,
        messages: state.messages,
        todos: state.todos,
        selectedPath: state.selectedPath,
      })
    }, 300)
  })

  return () => {
    if (timer) clearTimeout(timer)
    unsub()
  }
}

export async function resetPersistedWorkspace(): Promise<void> {
  useAgentStore.getState().resetWorkspace()
  await clearSession()
  await saveSession({
    files: useAgentStore.getState().files,
    messages: [],
    todos: [],
    selectedPath: useAgentStore.getState().selectedPath,
  })
}
