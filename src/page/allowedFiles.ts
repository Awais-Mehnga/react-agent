import { normalizePath } from '../agent/fs/paths'

export function isAllowedWorkspacePath(path: string): boolean {
  return /\.(html?|css)$/i.test(normalizePath(path))
}

export function assertAllowedWorkspacePath(path: string): void {
  if (!isAllowedWorkspacePath(path)) {
    throw new Error(`Only .html and .css files are allowed in this workspace (got: ${path})`)
  }
}

export function filterAllowedFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    if (isAllowedWorkspacePath(path)) out[normalizePath(path)] = content
  }
  return out
}
