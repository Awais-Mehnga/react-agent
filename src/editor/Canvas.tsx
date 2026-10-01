import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import themeCss from '../styles/theme.css?raw'
import editorCss from '../styles/editor.css?raw'
import { parseHtml, EID_ATTR } from '../html/parser'
import { serializeHtml } from '../html/serializer'
import { SelectionOverlay, type Rect } from './SelectionOverlay'

export type CanvasSelection = {
  eid: string
  tagName: string
  className: string
  stubId: string | null
  stubAttrs: Record<string, string>
  outerHtml: string
  isText: boolean
  isMedia: 'image' | 'video' | null
}

export type CanvasHandle = {
  applyClass: (eid: string, className: string) => void
  applyStubAttr: (eid: string, key: string, value: string) => void
  replaceMediaSrc: (eid: string, url: string) => void
  replaceElementOuterHtml: (eid: string, outerHtml: string) => void
}

type Props = {
  html: string
  onHtmlChange: (html: string) => void
  selection: CanvasSelection | null
  onSelect: (sel: CanvasSelection | null) => void
  onRequestMedia: (kind: 'image' | 'video', eid: string) => void
}

import { TEXT_EDITABLE_TAGS } from './TextEditor'
function buildSrcDoc(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
<style type="text/tailwindcss">
${themeCss}
<\/style>
<style>
${editorCss}
body { margin: 0; min-height: 100vh; }
<\/style>
</head>
<body>
${bodyHtml}
<script>
(function () {
  var selected = null;
  function eidOf(el) {
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute('${EID_ATTR}')) return el;
      el = el.parentElement;
    }
    return null;
  }
  function clearHover() {
    document.querySelectorAll('[data-pb-hover]').forEach(function (n) { n.removeAttribute('data-pb-hover'); });
  }
  function post(type, extra) {
    parent.postMessage(Object.assign({ source: 'pb-canvas', type: type }, extra || {}), '*');
  }
  document.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var el = eidOf(e.target);
    clearHover();
    document.querySelectorAll('[data-pb-selected]').forEach(function (n) { n.removeAttribute('data-pb-selected'); });
    if (!el) { selected = null; post('select', { eid: null }); return; }
    selected = el;
    el.setAttribute('data-pb-selected', '');
    post('select', { eid: el.getAttribute('${EID_ATTR}') });
  }, true);
  document.addEventListener('dblclick', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var el = eidOf(e.target);
    if (!el) return;
    post('dblclick', { eid: el.getAttribute('${EID_ATTR}'), tag: el.tagName });
  }, true);
  document.addEventListener('mouseover', function (e) {
    var el = eidOf(e.target);
    clearHover();
    if (el && el !== selected) el.setAttribute('data-pb-hover', '');
  }, true);
  document.addEventListener('mouseout', function () { clearHover(); }, true);
  window.addEventListener('scroll', function () { post('scroll'); }, true);
  window.addEventListener('resize', function () { post('scroll'); });
  post('ready');
})();
<\/script>
</body>
</html>`
}

function readSelection(el: Element): CanvasSelection {
  const stubRoot = el.closest('[data-stub]')
  const stubAttrs: Record<string, string> = {}
  if (stubRoot) {
    for (const attr of stubRoot.attributes) {
      if (attr.name.startsWith('data-')) stubAttrs[attr.name] = attr.value
    }
  }
  const tag = el.tagName
  let isMedia: CanvasSelection['isMedia'] = null
  if (tag === 'IMG') isMedia = 'image'
  if (tag === 'VIDEO') isMedia = 'video'

  return {
    eid: el.getAttribute(EID_ATTR) || '',
    tagName: tag.toLowerCase(),
    className: (el.getAttribute('class') || '')
      .split(/\s+/)
      .filter((c) => c && c !== 'pb-hover' && c !== 'pb-selected')
      .join(' '),
    stubId: stubRoot?.getAttribute('data-stub') ?? null,
    stubAttrs,
    outerHtml: el.outerHTML,
    isText: TEXT_EDITABLE_TAGS.has(tag),
    isMedia,
  }
}

function measureInIframe(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { html, onHtmlChange, selection, onSelect, onRequestMedia },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastPushedHtml = useRef<string | null>(null)
  const [srcDoc, setSrcDoc] = useState('')
  const [overlayRect, setOverlayRect] = useState<Rect | null>(null)
  const editingEidRef = useRef<string | null>(null)

  const syncFromIframe = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    const next = serializeHtml(doc)
    lastPushedHtml.current = next
    onHtmlChange(next)
  }, [onHtmlChange])

  const refreshOverlay = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !selection?.eid) {
      setOverlayRect(null)
      return
    }
    const el = doc.querySelector(`[${EID_ATTR}="${CSS.escape(selection.eid)}"]`)
    if (!el) {
      setOverlayRect(null)
      return
    }
    setOverlayRect(measureInIframe(el))
  }, [selection?.eid])

  useEffect(() => {
    if (lastPushedHtml.current !== null && html === lastPushedHtml.current) return
    lastPushedHtml.current = html
    const { bodyHtml } = parseHtml(html)
    setSrcDoc(buildSrcDoc(bodyHtml))
    setOverlayRect(null)
  }, [html])

  useImperativeHandle(
    ref,
    () => ({
      applyClass(eid, className) {
        const doc = iframeRef.current?.contentDocument
        const el = doc?.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`)
        if (!el) return
        if (className.trim()) el.setAttribute('class', className.trim())
        else el.removeAttribute('class')
        syncFromIframe()
        onSelect(readSelection(el))
        setOverlayRect(measureInIframe(el))
      },
      applyStubAttr(eid, key, value) {
        const doc = iframeRef.current?.contentDocument
        const el = doc?.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`)
        if (!el) return
        const root = el.closest('[data-stub]') ?? el
        if (value === '') root.removeAttribute(key)
        else root.setAttribute(key, value)
        syncFromIframe()
        onSelect(readSelection(root))
      },
      replaceMediaSrc(eid, url) {
        const doc = iframeRef.current?.contentDocument
        const el = doc?.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`) as
          | HTMLImageElement
          | HTMLVideoElement
          | null
        if (!el) return
        el.setAttribute('src', url)
        syncFromIframe()
        onSelect(readSelection(el))
      },
      replaceElementOuterHtml(eid, outerHtml) {
        const doc = iframeRef.current?.contentDocument
        const el = doc?.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`)
        if (!el || !doc) return
        const wrap = doc.createElement('div')
        wrap.innerHTML = outerHtml
        const next = wrap.firstElementChild
        if (!next) return
        el.replaceWith(next)
        let i = 0
        doc.body.querySelectorAll('*').forEach((node) => {
          node.setAttribute(EID_ATTR, String(++i))
        })
        syncFromIframe()
        onSelect(null)
        setOverlayRect(null)
      },
    }),
    [onSelect, syncFromIframe],
  )

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.source !== 'pb-canvas') return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return

      if (data.type === 'ready' || data.type === 'scroll') {
        refreshOverlay()
        return
      }

      if (data.type === 'select') {
        if (editingEidRef.current) return
        const eid = data.eid as string | null
        if (!eid) {
          onSelect(null)
          setOverlayRect(null)
          return
        }
        const el = doc.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`)
        if (!el) {
          onSelect(null)
          return
        }
        onSelect(readSelection(el))
        setOverlayRect(measureInIframe(el))
        return
      }

      if (data.type === 'dblclick') {
        const eid = data.eid as string
        const el = doc.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`) as HTMLElement | null
        if (!el) return
        const tag = el.tagName
        if (tag === 'IMG') {
          onRequestMedia('image', eid)
          return
        }
        if (tag === 'VIDEO') {
          onRequestMedia('video', eid)
          return
        }
        if (!TEXT_EDITABLE_TAGS.has(tag)) return

        editingEidRef.current = eid
        el.contentEditable = 'true'
        el.focus()
        const finish = () => {
          el.contentEditable = 'false'
          el.removeEventListener('blur', finish)
          el.removeEventListener('keydown', onKey)
          editingEidRef.current = null
          syncFromIframe()
          onSelect(readSelection(el))
          setOverlayRect(measureInIframe(el))
        }
        const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            el.blur()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            el.blur()
          }
        }
        el.addEventListener('blur', finish)
        el.addEventListener('keydown', onKey)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onSelect, onRequestMedia, refreshOverlay, syncFromIframe])

  useEffect(() => {
    refreshOverlay()
  }, [selection, refreshOverlay])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-zinc-800">
      <iframe
        ref={iframeRef}
        title="Page canvas"
        srcDoc={srcDoc}
        className="h-full w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin"
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <SelectionOverlay rect={overlayRect} label={selection ? selection.tagName : undefined} />
      </div>
    </div>
  )
})
