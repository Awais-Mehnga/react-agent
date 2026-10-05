import { useCallback, useEffect, useState } from 'react'
import { Editor } from '../editor/Editor'
import { ViewportBar } from '../editor/ViewportBar'
import { useAgentStore } from '../agent/session/store'
import { usePageEditorStore, VIEWPORTS } from '../page/editorStore'
import { isAllowedWorkspacePath } from '../page/allowedFiles'
import { ExternalLink } from 'lucide-react'

function isHtmlPath(path: string) {
  return /\.html?$/i.test(path)
}

/** Build a clean, fully interactive preview document — no editor scripts, no click interception. */
function buildPreviewDocument(html: string, themeCss: string): string {
  const twUrl = `${window.location.origin}/vendor/tailwind-browser.js`
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style type="text/tailwindcss">
${themeCss}
</style>
<script src="${twUrl}"></script>
<style>
html, body { margin: 0; min-height: 100%; background: #fff; }
</style>
</head>
<body>
${html}
</body>
</html>`
}

export function CodeEditor() {
  const selectedPath = useAgentStore((s) => s.selectedPath)
  const content = useAgentStore((s) => (selectedPath ? s.files[selectedPath] : '') ?? '')
  const setFileContent = useAgentStore((s) => s.setFileContent)
  const themeCss = useAgentStore((s) => s.files['theme.css'] ?? '')
  const mode = usePageEditorStore((s) => s.mode)
  const setMode = usePageEditorStore((s) => s.setMode)
  const viewport = usePageEditorStore((s) => s.viewport)
  const previewHtml = usePageEditorStore((s) => s.previewHtml)
  const previewTheme = usePageEditorStore((s) => s.previewTheme)
  const [localMode, setLocalMode] = useState(mode)

  useEffect(() => {
    setLocalMode(mode)
  }, [mode])

  const openFullPreview = useCallback(() => {
    const html = previewHtml ?? content
    const theme = previewTheme ?? themeCss
    const doc = buildPreviewDocument(html, theme)
    const blob = new Blob([doc], { type: 'text/html; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    // Revoke the object URL after a delay so the tab can load
    if (win) {
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }, [content, themeCss, previewHtml, previewTheme])

  if (!selectedPath || !isAllowedWorkspacePath(selectedPath)) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-900 text-sm text-zinc-500">
        Select page.html or theme.css
      </div>
    )
  }

  const showToggle = isHtmlPath(selectedPath)
  const effectiveMode = showToggle ? localMode : 'code'
  const frameWidth = VIEWPORTS[viewport].width

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2">
        <div className="font-mono text-xs text-zinc-400">{selectedPath}</div>
        <div className="flex flex-wrap items-center gap-2">
          {showToggle && effectiveMode === 'visual' ? <ViewportBar /> : null}
          {showToggle ? (
            <>
              <div className="flex rounded-lg border border-zinc-700 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setLocalMode('visual')
                    setMode('visual')
                  }}
                  className={`rounded-md px-3 py-1 ${
                    effectiveMode === 'visual' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Visual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalMode('code')
                    setMode('code')
                  }}
                  className={`rounded-md px-3 py-1 ${
                    effectiveMode === 'code' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Code
                </button>
              </div>
              <button
                type="button"
                title="Open full interactive preview in new tab"
                onClick={openFullPreview}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                Preview
              </button>
            </>
          ) : (
            <div className="text-[11px] text-zinc-500">CSS · code editor</div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isHtmlPath(selectedPath) && effectiveMode === 'visual' ? (
          <div className="flex h-full min-h-0 justify-center overflow-auto bg-zinc-800/80 p-3">
            <div
              className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-700 bg-white shadow-lg transition-[width] duration-200"
              style={{ width: frameWidth ? `${frameWidth}px` : '100%', maxWidth: '100%' }}
            >
              <Editor
                html={previewHtml ?? content}
                themeCss={previewTheme ?? themeCss}
                onChange={(html) => {
                  if (previewHtml !== null) return
                  setFileContent(selectedPath, html)
                }}
              />
            </div>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setFileContent(selectedPath, e.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none bg-transparent p-4 font-mono text-xs leading-5 text-zinc-200 outline-none"
          />
        )}
      </div>
    </div>
  )
}

