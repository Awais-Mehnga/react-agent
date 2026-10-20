/**
 * Lightweight DOM morph — updates only nodes that changed instead of
 * replacing the entire subtree (avoids full-page flicker on stream previews).
 */

const SKIP_ATTRS = new Set(['data-eid', 'data-pb-selected', 'data-pb-hover'])

function sameNode(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false
  if (a.nodeType === Node.TEXT_NODE) return true
  if (a.nodeType !== Node.ELEMENT_NODE) return a.nodeName === b.nodeName
  const ae = a as Element
  const be = b as Element
  if (ae.tagName !== be.tagName) return false
  // Prefer matching by stable identity hints when present
  const aStub = ae.getAttribute('data-stub')
  const bStub = be.getAttribute('data-stub')
  if (aStub && bStub) return aStub === bStub
  const aId = ae.getAttribute('id')
  const bId = be.getAttribute('id')
  if (aId && bId) return aId === bId
  return true
}

function morphAttrs(from: Element, to: Element) {
  const toNames = new Set<string>()
  for (const attr of Array.from(to.attributes)) {
    toNames.add(attr.name)
    if (SKIP_ATTRS.has(attr.name)) continue
    if (from.getAttribute(attr.name) !== attr.value) {
      from.setAttribute(attr.name, attr.value)
    }
  }
  for (const attr of Array.from(from.attributes)) {
    if (SKIP_ATTRS.has(attr.name)) continue
    if (!toNames.has(attr.name)) {
      from.removeAttribute(attr.name)
    }
  }
}

function morphNode(from: Node, to: Node): void {
  if (from.nodeType === Node.TEXT_NODE || from.nodeType === Node.COMMENT_NODE) {
    if (from.nodeValue !== to.nodeValue) {
      from.nodeValue = to.nodeValue
    }
    return
  }

  if (from.nodeType !== Node.ELEMENT_NODE || to.nodeType !== Node.ELEMENT_NODE) {
    from.parentNode?.replaceChild(to.cloneNode(true), from)
    return
  }

  const fromEl = from as Element
  const toEl = to as Element
  morphAttrs(fromEl, toEl)
  morphChildren(fromEl, toEl)
}

function morphChildren(fromParent: Element, toParent: Element) {
  const fromNodes: ChildNode[] = Array.from(fromParent.childNodes)
  const toNodes = Array.from(toParent.childNodes)
  const max = Math.max(fromNodes.length, toNodes.length)

  for (let i = 0; i < max; i++) {
    const from = fromNodes[i]
    const to = toNodes[i]

    if (from && to) {
      if (sameNode(from, to)) {
        morphNode(from, to)
      } else {
        // Try to find a matching later sibling to reuse
        let reused = false
        for (let j = i + 1; j < fromNodes.length; j++) {
          const candidate = fromNodes[j]
          if (candidate && sameNode(candidate, to)) {
            fromParent.insertBefore(candidate, from)
            morphNode(candidate, to)
            fromNodes.splice(j, 1)
            fromNodes.splice(i, 0, candidate)
            reused = true
            break
          }
        }
        if (!reused) {
          const clone = to.cloneNode(true) as ChildNode
          fromParent.replaceChild(clone, from)
          fromNodes[i] = clone
        }
      }
    } else if (to && !from) {
      fromParent.appendChild(to.cloneNode(true))
    } else if (from && !to) {
      fromParent.removeChild(from)
    }
  }
}

/** Morph `fromRoot` children to match parsed `toHtml` body contents. */
export function morphHtml(fromRoot: Element, toHtml: string, doc: Document): void {
  const wrap = doc.createElement('div')
  wrap.innerHTML = toHtml
  morphChildren(fromRoot, wrap)
}
