import { Monitor, Smartphone, Tablet } from 'lucide-react'
import { usePageEditorStore, VIEWPORTS, type ViewportId } from '../page/editorStore'

const ICONS: Record<ViewportId, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
}

export function ViewportBar() {
  const viewport = usePageEditorStore((s) => s.viewport)
  const setViewport = usePageEditorStore((s) => s.setViewport)

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-700 p-0.5">
      {(Object.keys(VIEWPORTS) as ViewportId[]).map((id) => {
        const Icon = ICONS[id]
        const active = viewport === id
        return (
          <button
            key={id}
            type="button"
            title={VIEWPORTS[id].label}
            onClick={() => setViewport(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${
              active ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{VIEWPORTS[id].label}</span>
          </button>
        )
      })}
    </div>
  )
}
