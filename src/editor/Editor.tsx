import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, type CanvasHandle } from './Canvas'
import { MediaSelector } from './MediaSelector'
import { usePageEditorStore } from '../page/editorStore'

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
  const [media, setMedia] = useState<{ kind: 'image' | 'video'; eid: string } | null>(null)

  useLayoutEffect(() => {
    setCanvas(canvasRef.current)
    return () => setCanvas(null)
  }, [setCanvas, html, themeCss])

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
        isEditing={isEditing}
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
