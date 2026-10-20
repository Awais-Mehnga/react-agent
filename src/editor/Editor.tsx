import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, type CanvasHandle } from './Canvas'
import { MediaSelector } from './MediaSelector'
import { usePageEditorStore } from '../page/editorStore'

import { useAgentStore } from '../agent/session/store'

type Props = {
  html: string
  themeCss: string
  onChange: (html: string) => void
}

export function Editor({ html, themeCss, onChange }: Props) {
  const canvasRef = useRef<CanvasHandle>(null)
  const setSelection = usePageEditorStore((s) => s.setSelection)
  const setCanvas = usePageEditorStore((s) => s.setCanvas)
  const isEditing = usePageEditorStore((s) => s.isEditing)
  const isRunning = useAgentStore((s) => s.isRunning)
  const [media, setMedia] = useState<{ kind: 'image' | 'video'; eid: string } | null>(null)

  const freezeAnimations = isEditing || isRunning

  // PORT: register canvas handle once — do not null on every html/theme stream tick
  useLayoutEffect(() => {
    setCanvas(canvasRef.current)
    return () => setCanvas(null)
  }, [setCanvas])

  const onHtmlChange = useCallback(
    (next: string) => {
      onChange(next)
    },
    [onChange],
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-100">
      <Canvas
        ref={canvasRef}
        html={html}
        themeCss={themeCss}
        isEditing={freezeAnimations}
        onHtmlChange={onHtmlChange}
        onSelect={setSelection}
        onRequestMedia={(kind, eid) => setMedia({ kind, eid })}
      />

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
