// GREENFIELD: VirtualFS factory over a files map getter (Zustand-backed)

import type { VirtualFS } from './types'
import { normalizePath } from './paths'

export function createMemoryFS(
  getFiles: () => Record<string, string>,
  mutate: {
    write: (path: string, content: string) => void
    delete: (path: string) => void
  },
): VirtualFS {
  return {
    read(path) {
      const key = normalizePath(path)
      const files = getFiles()
      if (!(key in files)) throw new Error(`File ${key} not found`)
      return files[key]
    },
    write(path, content) {
      mutate.write(normalizePath(path), content)
    },
    exists(path) {
      return normalizePath(path) in getFiles()
    },
    list() {
      return Object.keys(getFiles()).sort()
    },
    delete(path) {
      mutate.delete(normalizePath(path))
    },
    readLines(path, offset = 1, limit = 2000) {
      const content = this.read(path)
      const lines = content.split('\n')
      const start = Math.max(1, offset)
      const end = Math.min(lines.length, start + limit - 1)
      const out: string[] = []
      for (let i = start; i <= end; i++) {
        let line = lines[i - 1] ?? ''
        if (line.length > 2000) line = line.slice(0, 2000)
        out.push(`${i}: ${line}`)
      }
      return out.join('\n')
    },
  }
}
