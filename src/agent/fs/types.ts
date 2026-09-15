// GREENFIELD: VirtualFS interface for browser-local workspace.

export interface VirtualFS {
  read(path: string): string
  write(path: string, content: string): void
  exists(path: string): boolean
  list(): string[]
  delete(path: string): void
  /** Line-numbered content matching OpenCode read.txt (`N: content`). */
  readLines(path: string, offset?: number, limit?: number): string
}
