import { useCallback, useRef, useState } from 'react'
import { generatePage } from '../ai/generatePage'
import { sanitizeHtml } from '../html/sanitize'
import { compilePageCss, type SavedPage } from '../html/compileCss'
import { Canvas, type CanvasHandle, type CanvasSelection } from './Canvas'
import { MediaSelector } from './MediaSelector'
import { Toolbar } from './Toolbar'

type Props = {
  html: string
  onChange: (html: string) => void
}

export function Editor({ html, onChange }: Props) {
  const canvasRef = useRef<CanvasHandle>(null)
  const [selection, setSelection] = useState<CanvasSelection | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSave, setLastSave] = useState<SavedPage | null>(null)
  const [media, setMedia] = useState<{ kind: 'image' | 'video'; eid: string } | null>(null)

  const onHtmlChange = useCallback(
    (next: string) => {
      onChange(next)
    },
    [onChange],
  )

  const onGenerate = async (prompt: string, mode: 'page' | 'section') => {
    setError(null)
    setGenerating(true)
    try {
      if (mode === 'section' && selection) {
        const fragment = await generatePage({
          prompt,
          currentHtml: html,
          selectedHtml: selection.outerHtml,
          mode: 'section',
        })
        canvasRef.current?.replaceElementOuterHtml(selection.eid, fragment)
      } else {
        const page = await generatePage({ prompt, currentHtml: html, mode: 'page' })
        setSelection(null)
        onChange(sanitizeHtml(page))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
    }
  }

  const onSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const saved = await compilePageCss(html)
      setLastSave(saved)
      console.log('[page-builder] SavedPage', saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-100">
      <Toolbar
        selection={selection}
        generating={generating}
        saving={saving}
        onClassChange={(className) => {
          if (!selection) return
          canvasRef.current?.applyClass(selection.eid, className)
        }}
        onStubAttrChange={(key, value) => {
          if (!selection) return
          canvasRef.current?.applyStubAttr(selection.eid, key, value)
        }}
        onGenerate={(p, m) => void onGenerate(p, m)}
        onSave={() => void onSave()}
      />

      {error ? (
        <div className="shrink-0 border-b border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      <Canvas
        ref={canvasRef}
        html={html}
        onHtmlChange={onHtmlChange}
        selection={selection}
        onSelect={setSelection}
        onRequestMedia={(kind, eid) => setMedia({ kind, eid })}
      />

      {lastSave ? (
        <details className="shrink-0 border-t border-zinc-800 bg-zinc-950">
          <summary className="cursor-pointer px-3 py-2 text-xs text-zinc-400">
            Last save — html / css / theme
          </summary>
          <pre className="max-h-40 overflow-auto px-3 pb-3 font-mono text-[10px] leading-4 text-zinc-400">
            {JSON.stringify(
              {
                html: lastSave.html.slice(0, 500) + (lastSave.html.length > 500 ? '…' : ''),
                css: lastSave.css.slice(0, 400) + (lastSave.css.length > 400 ? '…' : ''),
                theme: lastSave.theme.slice(0, 300) + (lastSave.theme.length > 300 ? '…' : ''),
              },
              null,
              2,
            )}
          </pre>
        </details>
      ) : null}

      <MediaSelector
        open={!!media}
        kind={media?.kind ?? 'image'}
        onClose={() => setMedia(null)}
        onSelect={(url) => {
          if (media) canvasRef.current?.replaceMediaSrc(media.eid, url)
          setMedia(null)
        }}
      />
    </div>
  )
}
