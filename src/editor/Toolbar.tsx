import { useEffect, useState } from 'react'
import { getStubDefinition } from '../stubs'
import type { CanvasSelection } from './Canvas'

type Props = {
  selection: CanvasSelection | null
  onClassChange: (className: string) => void
  onStubAttrChange: (key: string, value: string) => void
  onGenerate: (prompt: string, mode: 'page' | 'section') => void
  onSave: () => void
  generating: boolean
  saving: boolean
}

export function Toolbar({
  selection,
  onClassChange,
  onStubAttrChange,
  onGenerate,
  onSave,
  generating,
  saving,
}: Props) {
  const [prompt, setPrompt] = useState('')
  const [classDraft, setClassDraft] = useState('')

  useEffect(() => {
    setClassDraft(selection?.className ?? '')
  }, [selection?.eid, selection?.className])

  const stub = getStubDefinition(selection?.stubId)

  return (
    <div className="shrink-0 space-y-3 border-b border-zinc-800 bg-zinc-950 p-3 text-zinc-100">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a page or section…"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && prompt.trim() && !generating) {
              onGenerate(prompt.trim(), selection ? 'section' : 'page')
            }
          }}
        />
        <button
          type="button"
          disabled={!prompt.trim() || generating}
          onClick={() => onGenerate(prompt.trim(), 'page')}
          className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          {generating ? 'Generating…' : 'AI page'}
        </button>
        <button
          type="button"
          disabled={!prompt.trim() || !selection || generating}
          onClick={() => onGenerate(prompt.trim(), 'section')}
          className="rounded-lg bg-violet-800 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
          title="Regenerate selected element"
        >
          AI section
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {selection ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs text-zinc-400">
            Selected: <span className="font-mono text-zinc-200">&lt;{selection.tagName}&gt;</span>
            <input
              value={classDraft}
              onChange={(e) => setClassDraft(e.target.value)}
              onBlur={() => {
                if (classDraft !== selection.className) onClassChange(classDraft)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
              }}
              placeholder="Tailwind classes"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-blue-500"
            />
          </label>

          {stub ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
              <div className="mb-2 text-xs font-medium text-zinc-300">{stub.label}</div>
              <div className="space-y-2">
                {stub.fields.map((field) => (
                  <label key={field.key} className="block text-[11px] text-zinc-500">
                    {field.label}
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={selection.stubAttrs[field.key] ?? ''}
                      placeholder={field.placeholder}
                      onChange={(e) => onStubAttrChange(field.key, e.target.value)}
                      className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500">
              Double-click text to edit · Double-click image/video to replace media
            </div>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-zinc-500">
          Click an element to select · Double-click text or media to edit
        </div>
      )}
    </div>
  )
}
