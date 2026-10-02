import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import editorCss from '../styles/editor.css?raw'
import { parseHtml, EID_ATTR } from '../html/parser'
import { serializeHtml } from '../html/serializer'
import { TEXT_EDITABLE_TAGS } from './TextEditor'

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
  themeCss: string
  onHtmlChange: (html: string) => void
  onSelect: (sel: CanvasSelection | null) => void
  onRequestMedia: (kind: 'image' | 'video', eid: string) => void
}

const ROOT_ID = 'pb-root'
const THEME_STYLE_ID = 'pb-theme'

/** Stable shell: local Tailwind browser runtime (same origin). Page HTML goes into #pb-root. */
function buildShell(themeCss: string, tailwindScriptUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="${tailwindScriptUrl}"><\/script>
<style type="text/tailwindcss" id="${THEME_STYLE_ID}">
${themeCss}
<\/style>
<style>
${editorCss}
html, body { margin: 0; min-height: 100%; background: #fff; }
#${ROOT_ID} { min-height: 100vh; }
<\/style>
</head>
<body>
<div id="${ROOT_ID}"></div>
<script>
(function () {
  var selected = null;
  var root = document.getElementById('${ROOT_ID}');
  function eidOf(el) {
    while (el && el !== root && el !== document.body) {
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
  post('ready');
})();
<\/script>
</body>
</html>`
}

function assignEids(root: ParentNode) {
  let i = 0
  root.querySelectorAll('*').forEach((el) => {
    el.setAttribute(EID_ATTR, String(++i))
  })
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

function getRoot(doc: Document): HTMLElement | null {
  return doc.getElementById(ROOT_ID)
}

function writeRootHtml(doc: Document, html: string) {
  const root = getRoot(doc)
  if (!root) return
  const { bodyHtml } = parseHtml(html)
  root.innerHTML = bodyHtml
  assignEids(root)
}

function writeTheme(doc: Document, themeCss: string) {
  const style = doc.getElementById(THEME_STYLE_ID)
  if (!style) return
  style.textContent = themeCss
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { html, themeCss, onHtmlChange, onSelect, onRequestMedia },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastPushedHtml = useRef<string | null>(null)
  const lastTheme = useRef<string | null>(null)
  const readyRef = useRef(false)
  const pendingHtml = useRef(html)
  const pendingTheme = useRef(themeCss)
  const [srcDoc] = useState(() => {
    const twUrl = `${window.location.origin}/vendor/tailwind-browser.js`
    return buildShell(themeCss, twUrl)
  })
  const editingEidRef = useRef<string | null>(null)

  const syncFromIframe = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    const root = doc ? getRoot(doc) : null
    if (!root) return
    const next = serializeHtml(root)
    lastPushedHtml.current = next
    onHtmlChange(next)
  }, [onHtmlChange])

  const applyPending = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !readyRef.current) return

    if (pendingTheme.current !== lastTheme.current) {
      writeTheme(doc, pendingTheme.current)
      lastTheme.current = pendingTheme.current
    }

    if (pendingHtml.current !== lastPushedHtml.current) {
      writeRootHtml(doc, pendingHtml.current)
      lastPushedHtml.current = pendingHtml.current
      onSelect(null)
    }
  }, [onSelect])

  // Keep pending props; patch live DOM without reloading the Tailwind CDN shell
  useEffect(() => {
    pendingHtml.current = html
    pendingTheme.current = themeCss
    applyPending()
  }, [html, themeCss, applyPending])

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
        const root = doc ? getRoot(doc) : null
        if (!el || !doc || !root) return
        const wrap = doc.createElement('div')
        wrap.innerHTML = outerHtml
        const next = wrap.firstElementChild
        if (!next) return
        el.replaceWith(next)
        assignEids(root)
        syncFromIframe()
        onSelect(null)
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

      if (data.type === 'ready') {
        readyRef.current = true
        applyPending()
        return
      }

      if (data.type === 'select') {
        if (editingEidRef.current) return
        const eid = data.eid as string | null
        if (!eid) {
          onSelect(null)
          return
        }
        const el = doc.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`)
        if (!el) {
          onSelect(null)
          return
        }
        onSelect(readSelection(el))
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
  }, [onSelect, onRequestMedia, syncFromIframe, applyPending])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-zinc-800">
      <iframe
        ref={iframeRef}
        title="Page canvas"
        srcDoc={srcDoc}
        className="h-full w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
})
