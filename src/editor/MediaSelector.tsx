import { useEffect, useState } from 'react'
import { listMedia, uploadMedia, type MediaItem } from '../media/mediaApi'

type Props = {
  kind: 'image' | 'video'
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
}

export function MediaSelector({ kind, open, onClose, onSelect }: Props) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void listMedia(kind).then(setItems)
  }, [open, kind])

  if (!open) return null

  const onUpload = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const item = await uploadMedia(file)
      setItems((prev) => [item, ...prev])
      onSelect(item.url)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-medium text-zinc-100">
            Select {kind === 'image' ? 'image' : 'video'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 border-b border-zinc-800 p-4">
          <label className="block text-xs text-zinc-400">
            Paste URL
            <div className="mt-1 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                disabled={!url.trim()}
                onClick={() => {
                  onSelect(url.trim())
                  onClose()
                }}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                Use
              </button>
            </div>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">
            {busy ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              accept={kind === 'image' ? 'image/*' : 'video/*'}
              className="hidden"
              disabled={busy}
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.url)
                  onClose()
                }}
                className="group overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-left hover:border-blue-500"
              >
                {item.type === 'image' || item.thumb ? (
                  <img
                    src={item.thumb ?? item.url}
                    alt={item.label}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center text-xs text-zinc-500">
                    Video
                  </div>
                )}
                <div className="truncate px-2 py-1.5 text-[11px] text-zinc-400 group-hover:text-zinc-200">
                  {item.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
