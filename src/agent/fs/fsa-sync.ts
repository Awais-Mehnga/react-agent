// GREENFIELD: File System Access API — load folder into memory, write-through on mutate

import { normalizePath } from './paths'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vite', 'coverage'])
const TEXT_EXT = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'md',
  'txt',
  'css',
  'scss',
  'html',
  'htm',
  'svg',
  'yml',
  'yaml',
  'toml',
  'env',
  'gitignore',
  'dockerignore',
  'rs',
  'go',
  'py',
  'rb',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'sql',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'xml',
  'vue',
  'svelte',
])

const MAX_FILE_BYTES = 512_000

export type FsaRoot = {
  handle: FileSystemDirectoryHandle
  name: string
}

function isTextPath(name: string): boolean {
  if (name.startsWith('.') && !name.includes('.')) return true
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (!ext) return ['Dockerfile', 'Makefile', 'LICENSE', 'README'].some((x) => name === x || name.startsWith(x))
  return TEXT_EXT.has(ext)
}

async function walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: Record<string, string>,
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'directory') {
      if (SKIP_DIRS.has(name)) continue
      await walk(handle as FileSystemDirectoryHandle, prefix ? `${prefix}/${name}` : name, out)
      continue
    }
    if (!isTextPath(name)) continue
    const fileHandle = handle as FileSystemFileHandle
    const file = await fileHandle.getFile()
    if (file.size > MAX_FILE_BYTES) continue
    const text = await file.text()
    // skip likely binary
    if (text.includes('\u0000')) continue
    const path = normalizePath(prefix ? `${prefix}/${name}` : name)
    out[path] = text
  }
}

export async function readDirectoryToFiles(root: FileSystemDirectoryHandle): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  await walk(root, '', files)
  return files
}

export async function pickDirectory(): Promise<FsaRoot | null> {
  const w = window as Window & {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }
  if (!w.showDirectoryPicker) {
    throw new Error('File System Access API is not supported in this browser')
  }
  const handle = await w.showDirectoryPicker({ mode: 'readwrite' })
  return { handle, name: handle.name }
}

async function ensureParent(
  root: FileSystemDirectoryHandle,
  parts: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root
  for (const part of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  return dir
}

export async function fsaWrite(root: FileSystemDirectoryHandle, path: string, content: string): Promise<void> {
  const parts = normalizePath(path).split('/').filter(Boolean)
  if (parts.length === 0) throw new Error('Invalid path')
  const dir = await ensureParent(root, parts)
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function fsaDelete(root: FileSystemDirectoryHandle, path: string): Promise<void> {
  const parts = normalizePath(path).split('/').filter(Boolean)
  if (parts.length === 0) throw new Error('Invalid path')
  const dir = await ensureParent(root, parts)
  await dir.removeEntry(parts[parts.length - 1])
}

const FSA_DB = 'react-agent-fsa'
const FSA_STORE = 'handles'
const FSA_KEY = 'root'

export async function saveFsaHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(FSA_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(FSA_STORE)) db.createObjectStore(FSA_STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(FSA_STORE, 'readwrite')
      tx.objectStore(FSA_STORE).put(handle, FSA_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function loadFsaHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open(FSA_DB, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(FSA_STORE)) db.createObjectStore(FSA_STORE)
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(FSA_STORE, 'readonly')
        const get = tx.objectStore(FSA_STORE).get(FSA_KEY)
        get.onsuccess = () => resolve((get.result as FileSystemDirectoryHandle | undefined) ?? null)
        get.onerror = () => reject(get.error)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function clearFsaHandle(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(FSA_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(FSA_STORE)) db.createObjectStore(FSA_STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(FSA_STORE, 'readwrite')
      tx.objectStore(FSA_STORE).delete(FSA_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function ensureFsaPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const anyHandle = handle as FileSystemDirectoryHandle & {
    queryPermission?: (desc: { mode: string }) => Promise<PermissionState>
    requestPermission?: (desc: { mode: string }) => Promise<PermissionState>
  }
  if (anyHandle.queryPermission) {
    let state = await anyHandle.queryPermission({ mode: 'readwrite' })
    if (state === 'granted') return true
    if (anyHandle.requestPermission) {
      state = await anyHandle.requestPermission({ mode: 'readwrite' })
      return state === 'granted'
    }
  }
  return true
}
