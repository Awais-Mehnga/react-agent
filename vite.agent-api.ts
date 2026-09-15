import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

async function readUrl(req: IncomingMessage): Promise<URL> {
  const host = req.headers.host ?? 'localhost'
  return new URL(req.url ?? '/', `http://${host}`)
}

function send(res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8') {
  res.statusCode = status
  res.setHeader('Content-Type', type)
  res.end(body)
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlToMarkdownLite(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function agentApiPlugin(): Plugin {
  return {
    name: 'react-agent-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url) return next()
          const url = await readUrl(req)

          if (url.pathname === '/api/fetch') {
            const target = url.searchParams.get('url')
            const format = url.searchParams.get('format') || 'markdown'
            if (!target) return send(res, 400, 'url required')
            let href = target
            if (href.startsWith('http://')) href = `https://${href.slice(7)}`
            if (!href.startsWith('https://')) return send(res, 400, 'only https allowed')

            const upstream = await fetch(href, {
              headers: { 'User-Agent': 'react-agent/1.0' },
              redirect: 'follow',
            })
            const raw = await upstream.text()
            if (!upstream.ok) return send(res, upstream.status, raw.slice(0, 2000))

            if (format === 'html') return send(res, 200, raw, 'text/html; charset=utf-8')
            if (format === 'text') return send(res, 200, htmlToText(raw))
            return send(res, 200, htmlToMarkdownLite(raw))
          }

          if (url.pathname === '/api/search') {
            const q = url.searchParams.get('q')
            if (!q) return send(res, 400, 'q required')
            const ddg = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
            const upstream = await fetch(ddg, { headers: { 'User-Agent': 'react-agent/1.0' } })
            const text = await upstream.text()
            return send(res, upstream.status, text, 'application/json; charset=utf-8')
          }

          return next()
        } catch (error) {
          return send(res, 500, error instanceof Error ? error.message : String(error))
        }
      })
    },
  }
}
