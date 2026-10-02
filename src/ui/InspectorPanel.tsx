import { useEffect, useState } from 'react'
import { getStubDefinition } from '../stubs'
import { useAgentStore } from '../agent/session/store'
import { usePageEditorStore } from '../page/editorStore'
import { isAllowedWorkspacePath } from '../page/allowedFiles'
import { compilePageCss } from '../html/compileCss'
import { resetPersistedWorkspace } from '../agent/session/persist'
import { PanelRightClose, RotateCcw } from 'lucide-react'

type Props = {
  onCollapse?: () => void
}

export function InspectorPanel({ onCollapse }: Props) {
  const files = useAgentStore((s) => s.files)
  const selectedPath = useAgentStore((s) => s.selectedPath)
  const selectFile = useAgentStore((s) => s.selectFile)
  const selection = usePageEditorStore((s) => s.selection)
  const mode = usePageEditorStore((s) => s.mode)
  const saving = usePageEditorStore((s) => s.saving)
  const lastSave = usePageEditorStore((s) => s.lastSave)
  const error = usePageEditorStore((s) => s.error)
  const applyClass = usePageEditorStore((s) => s.applyClass)
  const applyStubAttr = usePageEditorStore((s) => s.applyStubAttr)
  const setSaving = usePageEditorStore((s) => s.setSaving)
  const setLastSave = usePageEditorStore((s) => s.setLastSave)
  const setError = usePageEditorStore((s) => s.setError)

  const [classDraft, setClassDraft] = useState('')
  const paths = Object.keys(files).filter(isAllowedWorkspacePath).sort()
  const stub = getStubDefinition(selection?.stubId)
  const html = files['page.html'] ?? ''

  useEffect(() => {
    setClassDraft(selection?.className ?? '')
  }, [selection?.eid, selection?.className])

  const onSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const saved = await compilePageCss(html)
      // Prefer workspace theme.css if present
      const theme = files['theme.css']
      const payload = theme ? { ...saved, theme } : saved
      setLastSave(payload)
      console.log('[page-builder] SavedPage', payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-1">
          {onCollapse ? (
            <button
              type="button"
              title="Collapse page panel"
              onClick={onCollapse}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <PanelRightClose className="size-4" />
            </button>
          ) : null}
          <div className="text-sm font-medium tracking-wide text-zinc-300">Page</div>
        </div>
        <button
          type="button"
          title="Reset to seed"
          onClick={() => void resetPersistedWorkspace()}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      <ul className="shrink-0 space-y-0.5 border-b border-zinc-800 p-2">
        {paths.map((path) => (
          <li key={path}>
            <button
              type="button"
              onClick={() => selectFile(path)}
              className={`w-full rounded px-2 py-1.5 text-left font-mono text-xs ${
                selectedPath === path ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              {path}
            </button>
          </li>
        ))}
      </ul>

      <div className="shrink-0 border-b border-zinc-800 p-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save { html, css, theme }'}
        </button>
        {error ? <p className="mt-2 text-[11px] text-red-400">{error}</p> : null}
        {lastSave ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-zinc-500">Last save preview</summary>
            <pre className="mt-1 max-h-28 overflow-auto font-mono text-[10px] leading-4 text-zinc-500">
              {JSON.stringify(
                {
                  html: lastSave.html.slice(0, 200) + '…',
                  css: lastSave.css.slice(0, 160) + '…',
                  theme: lastSave.theme.slice(0, 120) + '…',
                },
                null,
                2,
              )}
            </pre>
          </details>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {mode !== 'visual' || !/\.html?$/i.test(selectedPath) ? (
          <p className="text-[11px] text-zinc-500">
            Switch to Visual on an HTML file to inspect selection, classes, and stubs.
          </p>
        ) : selection ? (
          <div className="space-y-3">
            <div className="font-mono text-xs text-zinc-300">
              &lt;{selection.tagName}&gt;
            </div>
            <label className="block text-[11px] text-zinc-500">
              Classes
              <textarea
                value={classDraft}
                onChange={(e) => setClassDraft(e.target.value)}
                onBlur={() => {
                  if (classDraft !== selection.className) applyClass(classDraft)
                }}
                rows={3}
                className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100 outline-none focus:border-blue-500"
              />
            </label>
            {stub ? (
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="text-xs font-medium text-zinc-300">{stub.label}</div>
                {stub.fields.map((field) => (
                  <label key={field.key} className="block text-[11px] text-zinc-500">
                    {field.label}
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={selection.stubAttrs[field.key] ?? ''}
                      placeholder={field.placeholder}
                      onChange={(e) => applyStubAttr(field.key, e.target.value)}
                      className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-blue-500"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">
                Double-click text to edit · Double-click image/video for media
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">
            Click an element to inspect classes and stubs. Ask the agent (left) to redesign the page.
          </p>
        )}
      </div>
    </div>
  )
}
