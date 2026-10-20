import { useCallback } from 'react'
import { Editor } from '../editor/Editor'
import { ViewportBar } from '../editor/ViewportBar'
import { useAgentStore } from '../agent/session/store'
import { usePageEditorStore, VIEWPORTS } from '../page/editorStore'
import { isAllowedWorkspacePath } from '../page/allowedFiles'
import { ExternalLink } from 'lucide-react'
import { DiffPanel } from './DiffPanel'

function isHtmlPath(path: string) {
  return /\.html?$/i.test(path)
}

/** Build a clean, fully interactive preview document — no editor scripts, no click interception. */
function buildPreviewDocument(html: string, themeCss: string): string {
  const twUrl = `${window.location.origin}/vendor/tailwind-browser.js`
  // @import inside text/tailwindcss breaks the browser runtime — load fonts as <link>
  const fontUrls: string[] = []
  const css = themeCss.replace(
    /@import\s+url\(["']?([^"')]+)["']?\)\s*;?/gi,
    (_full, href: string) => {
      fontUrls.push(href)
      return ''
    },
  )
  const fontLinks = fontUrls
    .map((href) => `<link rel="stylesheet" href="${href}" />`)
    .join('\n')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${fontLinks}
<style type="text/tailwindcss">
${css.trim()}
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
  const effectiveMode = showToggle ? mode : 'code'
  const frameWidth = VIEWPORTS[viewport].width

  const activeContent =
    selectedPath === 'page.html' && previewHtml !== null
      ? previewHtml
      : selectedPath === 'theme.css' && previewTheme !== null
        ? previewTheme
        : content

  const isStreamingPreview =
    (selectedPath === 'page.html' && previewHtml !== null) ||
    (selectedPath === 'theme.css' && previewTheme !== null)

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">{selectedPath}</span>
          {isStreamingPreview && (
            <span className="inline-flex items-center gap-1 rounded bg-sky-950/80 px-1.5 py-0.5 font-mono text-[10px] text-sky-400 border border-sky-800/50 animate-pulse">
              updating live…
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showToggle && effectiveMode === 'visual' ? <ViewportBar /> : null}
          {showToggle ? (
            <>
              <div className="flex rounded-lg border border-zinc-700 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('visual')}
                  className={`rounded-md px-3 py-1 ${
                    effectiveMode === 'visual' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Visual
                </button>
                <button
                  type="button"
                  onClick={() => setMode('code')}
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

      <div className="relative min-h-0 flex-1">
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
            value={activeContent}
            readOnly={isStreamingPreview}
            onChange={(e) => setFileContent(selectedPath, e.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none bg-transparent p-4 font-mono text-xs leading-5 text-zinc-200 outline-none"
          />
        )}
      </div>
      <DiffPanel />
    </div>
  )
}

