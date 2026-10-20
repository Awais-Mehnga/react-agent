import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import editorCss from '../styles/editor.css?raw'
import { parseHtml, EID_ATTR } from '../html/parser'
import { morphHtml } from '../html/morphDom'
import { serializeHtml } from '../html/serializer'
import { TEXT_EDITABLE_TAGS } from './TextEditor'

export type CanvasSelection = {
  eid: string
  tagName: string
  className: string
  stubId: string | null
  stubAttrs: Record<string, string>
  attrs: {
    src?: string
    alt?: string
    href?: string
    target?: string
  }
  outerHtml: string
  isText: boolean
  isMedia: 'image' | 'video' | null
  isAnchor: boolean
}

export type CanvasHandle = {
  applyClass: (eid: string, className: string) => void
  applyStubAttr: (eid: string, key: string, value: string) => void
  applyAttr: (eid: string, name: string, value: string) => void
  replaceMediaSrc: (eid: string, url: string) => void
  replaceElementOuterHtml: (eid: string, outerHtml: string) => void
}

type Props = {
  html: string
  themeCss: string
  isEditing?: boolean
  onHtmlChange: (html: string) => void
  onSelect: (sel: CanvasSelection | null) => void
  onRequestMedia: (kind: 'image' | 'video', eid: string) => void
}

const ROOT_ID = 'pb-root'
const THEME_STYLE_ID = 'pb-theme'

/** Stable shell: local Tailwind browser runtime (same origin). Page HTML goes into #pb-root. */
function buildShell(themeCss: string, tailwindScriptUrl: string): string {
  const { css, fontUrls } = extractFontImports(themeCss)
  const fontLinks = fontUrls
    .map((href) => `<link rel="stylesheet" href="${href}" ${FONT_LINK_ATTR} />`)
    .join('\n')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${fontLinks}
<style type="text/tailwindcss" id="${THEME_STYLE_ID}">
${css}
</style>
<script src="${tailwindScriptUrl}"></script>
<style>
${editorCss}
html[data-pb-editing="true"] *,
html[data-pb-editing="true"] *::before,
html[data-pb-editing="true"] *::after,
body[data-pb-editing="true"] *,
body[data-pb-editing="true"] *::before,
body[data-pb-editing="true"] *::after {
  animation-play-state: paused !important;
  transition: none !important;
}


html, body { margin: 0; min-height: 100%; background: #fff; }
#${ROOT_ID} { min-height: 100vh; }
</style>
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
</script>
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

  const attrs: CanvasSelection['attrs'] = {}
  const src = el.getAttribute('src')
  const alt = el.getAttribute('alt')
  const href = el.getAttribute('href')
  const target = el.getAttribute('target')
  if (src != null) attrs.src = src
  if (alt != null) attrs.alt = alt
  if (href != null) attrs.href = href
  if (target != null) attrs.target = target

  return {
    eid: el.getAttribute(EID_ATTR) || '',
    tagName: tag.toLowerCase(),
    className: (el.getAttribute('class') || '')
      .split(/\s+/)
      .filter((c) => c && c !== 'pb-hover' && c !== 'pb-selected')
      .join(' '),
    stubId: stubRoot?.getAttribute('data-stub') ?? null,
    stubAttrs,
    attrs,
    outerHtml: el.outerHTML,
    isText: TEXT_EDITABLE_TAGS.has(tag),
    isMedia,
    isAnchor: tag === 'A',
  }
}

function getRoot(doc: Document): HTMLElement | null {
  return doc.getElementById(ROOT_ID)
}

const FONT_LINK_ATTR = 'data-pb-font'

/**
 * `@import` inside `type="text/tailwindcss"` breaks the Tailwind browser runtime
 * (tokens / utilities never apply → unstyled HTML). Load fonts via <link> instead.
 */
function extractFontImports(themeCss: string): { css: string; fontUrls: string[] } {
  const fontUrls: string[] = []
  const css = themeCss.replace(
    /@import\s+url\(["']?([^"')]+)["']?\)\s*;?/gi,
    (_full, href: string) => {
      fontUrls.push(href)
      return ''
    },
  )
  return { css: css.trim(), fontUrls }
}

function syncFontLinks(doc: Document, fontUrls: string[]) {
  const head = doc.head || doc.getElementsByTagName('head')[0]
  if (!head) return
  head.querySelectorAll(`link[${FONT_LINK_ATTR}]`).forEach((n) => n.remove())
  for (const href of fontUrls) {
    const link = doc.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.setAttribute(FONT_LINK_ATTR, '')
    head.insertBefore(link, head.firstChild)
  }
}

function refreshTailwind(doc: Document, themeCss?: string) {
  const head = doc.head || doc.getElementsByTagName('head')[0]
  if (!head) return
  const oldStyle = doc.getElementById(THEME_STYLE_ID)
  // Only re-extract fonts when a full theme payload is provided — otherwise
  // oldStyle already has @import stripped and we'd wipe the <link> tags.
  let css = oldStyle?.textContent ?? ''
  if (themeCss != null) {
    const extracted = extractFontImports(themeCss)
    css = extracted.css
    syncFontLinks(doc, extracted.fontUrls)
  }
  const newStyle = doc.createElement('style')
  newStyle.type = 'text/tailwindcss'
  newStyle.id = THEME_STYLE_ID
  newStyle.textContent = css
  if (oldStyle && oldStyle.parentNode) {
    oldStyle.parentNode.replaceChild(newStyle, oldStyle)
  } else {
    head.appendChild(newStyle)
  }
}

let lastStreamTwRefresh = 0

function writeRootHtml(doc: Document, html: string, streaming = false) {
  const root = getRoot(doc)
  if (!root) return
  // Streaming previews skip DOMPurify — partial tags would otherwise vanish.
  const { bodyHtml } = parseHtml(html, { sanitize: !streaming })
  const next = bodyHtml ?? ''

  // Morph in place when the canvas already has content — only touched nodes update.
  // Full replace only on empty root (first paint) to avoid wholesale reflows/flicker.
  if (root.childNodes.length > 0 && next.trim().length > 0) {
    morphHtml(root, next, doc)
  } else {
    root.innerHTML = next
  }
  assignEids(root)
  if (!streaming) {
    refreshTailwind(doc)
    return
  }
  // Stream: rebuild Tailwind on a short throttle so new utility classes paint live
  const now = Date.now()
  if (!doc.getElementById(THEME_STYLE_ID) || now - lastStreamTwRefresh > 180) {
    lastStreamTwRefresh = now
    refreshTailwind(doc)
  }
}

function writeTheme(doc: Document, themeCss: string) {
  refreshTailwind(doc, themeCss)
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { html, themeCss, isEditing, onHtmlChange, onSelect, onRequestMedia },
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

  const streamingRef = useRef(Boolean(isEditing))
  streamingRef.current = Boolean(isEditing)

  const applyPending = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !readyRef.current) return

    if (pendingTheme.current !== lastTheme.current) {
      writeTheme(doc, pendingTheme.current)
      lastTheme.current = pendingTheme.current
    }

    if (pendingHtml.current !== lastPushedHtml.current) {
      const prevEid =
        doc.querySelector('[data-pb-selected]')?.getAttribute(EID_ATTR) ?? null
      writeRootHtml(doc, pendingHtml.current, streamingRef.current)
      lastPushedHtml.current = pendingHtml.current
      if (prevEid) {
        const el = doc.querySelector(`[${EID_ATTR}="${CSS.escape(prevEid)}"]`)
        if (el) {
          el.setAttribute('data-pb-selected', '')
          onSelect(readSelection(el))
        }
      }
    }
  }, [onSelect])

  // Keep pending props; patch live DOM without reloading the Tailwind CDN shell
  useEffect(() => {
    pendingHtml.current = html
    pendingTheme.current = themeCss
    applyPending()
  }, [html, themeCss, applyPending])

  // Suppress animations while editing; resume cleanly once editing completes
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    if (isEditing) {
      doc.body.setAttribute('data-pb-editing', 'true')
      doc.documentElement?.setAttribute('data-pb-editing', 'true')
      doc.querySelectorAll('video, audio').forEach((el) => {
        try {
          ;(el as HTMLMediaElement).pause()
        } catch {}
      })
    } else {
      doc.body.removeAttribute('data-pb-editing')
      doc.documentElement?.removeAttribute('data-pb-editing')
    }
  }, [isEditing])

  useImperativeHandle(
    ref,
    () => ({
      applyClass(eid, className) {
        const doc = iframeRef.current?.contentDocument
        const el = doc?.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`)
        if (!el || !doc) return
        if (className.trim()) el.setAttribute('class', className.trim())
        else el.removeAttribute('class')
        refreshTailwind(doc)
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
      applyAttr(eid, name, value) {
        const doc = iframeRef.current?.contentDocument
        const el = doc?.querySelector(`[${EID_ATTR}="${CSS.escape(eid)}"]`)
        if (!el || !doc) return
        if (value === '') el.removeAttribute(name)
        else el.setAttribute(name, value)
        if (name === 'src' || name === 'href') refreshTailwind(doc)
        syncFromIframe()
        onSelect(readSelection(el))
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
        refreshTailwind(doc)
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
