import { create } from 'zustand'
import type { CanvasHandle, CanvasSelection } from '../editor/Canvas'
import type { SavedPage } from '../html/compileCss'

type EditorMode = 'visual' | 'code'
export type ViewportId = 'desktop' | 'tablet' | 'mobile'

export const VIEWPORTS: Record<ViewportId, { label: string; width: number | null }> = {
  desktop: { label: 'Desktop', width: null },
  tablet: { label: 'Tablet', width: 768 },
  mobile: { label: 'Mobile', width: 390 },
}

type PageEditorState = {
  mode: EditorMode
  viewport: ViewportId
  /** Live agent stream overlay — does not write the workspace until tools commit. */
  previewHtml: string | null
  previewTheme: string | null
  isEditing: boolean
  selection: CanvasSelection | null
  canvas: CanvasHandle | null
  saving: boolean
  lastSave: SavedPage | null
  error: string | null
  setMode: (mode: EditorMode) => void
  setViewport: (viewport: ViewportId) => void
  setPreviewHtml: (html: string | null) => void
  setPreviewTheme: (css: string | null) => void
  setIsEditing: (isEditing: boolean) => void
  clearPreview: () => void
  setSelection: (sel: CanvasSelection | null) => void
  setCanvas: (api: CanvasHandle | null) => void
  setSaving: (saving: boolean) => void
  setLastSave: (save: SavedPage | null) => void
  setError: (error: string | null) => void
  applyClass: (className: string) => void
  applyStubAttr: (key: string, value: string) => void
}

export const usePageEditorStore = create<PageEditorState>((set, get) => ({
  mode: 'visual',
  viewport: 'desktop',
  previewHtml: null,
  previewTheme: null,
  isEditing: false,
  selection: null,
  canvas: null,
  saving: false,
  lastSave: null,
  error: null,
  setMode: (mode) => set({ mode, selection: mode === 'code' ? null : get().selection }),
  setViewport: (viewport) => set({ viewport }),
  setPreviewHtml: (previewHtml) => set({ previewHtml, isEditing: previewHtml !== null }),
  setPreviewTheme: (previewTheme) => set({ previewTheme, isEditing: previewTheme !== null }),
  setIsEditing: (isEditing) => set({ isEditing }),
  clearPreview: () => set({ previewHtml: null, previewTheme: null, isEditing: false }),
  setSelection: (selection) => set({ selection }),
  setCanvas: (canvas) => set({ canvas }),
  setSaving: (saving) => set({ saving }),
  setLastSave: (lastSave) => set({ lastSave }),
  setError: (error) => set({ error }),
  applyClass: (className) => {
    const { selection, canvas } = get()
    if (!selection || !canvas) return
    canvas.applyClass(selection.eid, className)
  },
  applyStubAttr: (key, value) => {
    const { selection, canvas } = get()
    if (!selection || !canvas) return
    canvas.applyStubAttr(selection.eid, key, value)
  },
}))
