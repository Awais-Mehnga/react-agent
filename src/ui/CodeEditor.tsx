import { Editor } from '../editor/Editor'
import { useAgentStore } from '../agent/session/store'

function isHtmlPath(path: string) {
  return /\.html?$/i.test(path)
}

export function CodeEditor() {
  const selectedPath = useAgentStore((s) => s.selectedPath)
  const content = useAgentStore((s) => (selectedPath ? s.files[selectedPath] : '') ?? '')
  const setFileContent = useAgentStore((s) => s.setFileContent)

  if (!selectedPath) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-900 text-sm text-zinc-500">
        Select a file
      </div>
    )
  }

  if (isHtmlPath(selectedPath)) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-100">
        <div className="border-b border-zinc-800 px-4 py-2 font-mono text-xs text-zinc-400">
          {selectedPath} · visual editor
        </div>
        <div className="min-h-0 flex-1">
          <Editor html={content} onChange={(html) => setFileContent(selectedPath, html)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-100">
      <div className="border-b border-zinc-800 px-4 py-3 font-mono text-xs text-zinc-400">{selectedPath}</div>
      <textarea
        value={content}
        onChange={(e) => setFileContent(selectedPath, e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-5 text-zinc-200 outline-none"
      />
    </div>
  )
}
