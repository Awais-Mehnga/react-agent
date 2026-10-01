/** Extract a JSON string field from a partial tool-input JSON buffer (streaming). */
export function extractPartialJsonString(buf: string, key: string): string | null {
  const marker = `"${key}"`
  const keyIdx = buf.indexOf(marker)
  if (keyIdx < 0) return null
  let i = keyIdx + marker.length
  while (i < buf.length && /\s/.test(buf[i]!)) i++
  if (buf[i] !== ':') return null
  i++
  while (i < buf.length && /\s/.test(buf[i]!)) i++
  if (buf[i] !== '"') return null
  i++
  let out = ''
  while (i < buf.length) {
    const c = buf[i]!
    if (c === '\\' && i + 1 < buf.length) {
      const n = buf[i + 1]!
      const map: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        '"': '"',
        '\\': '\\',
        '/': '/',
      }
      out += map[n] ?? n
      i += 2
      continue
    }
    if (c === '"') break
    out += c
    i++
  }
  return out.length > 0 ? out : null
}

/** Strip fenced code from assistant chat text for display. */
export function stripCodeForChat(text: string): string {
  const stripped = text
    .replace(/```[\s\S]*?(?:```|$)/g, '')
    .replace(/^\s*<[!a-zA-Z][\s\S]{80,}$/m, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return stripped
}

/** If the model dumped HTML into chat text, pull a preview candidate. */
export function extractHtmlFromAssistantText(text: string): string | null {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)(?:```|$)/i)
  if (fence?.[1] && /<[a-z][\s\S]*>/i.test(fence[1])) {
    return fence[1].trim()
  }
  const trimmed = text.trim()
  if (/^<(?:!DOCTYPE|html|section|div|main|header|footer|article|form)\b/i.test(trimmed)) {
    return trimmed
  }
  return null
}
