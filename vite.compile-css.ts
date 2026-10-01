import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { compile } from '@tailwindcss/node'

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function send(res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8') {
  res.statusCode = status
  res.setHeader('Content-Type', type)
  res.end(body)
}

/** Only @theme tokens are needed so utilities resolve; helpers ship via theme field. */
function extractThemeBlock(themeCss: string): string {
  const match = themeCss.match(/@theme\s*\{[\s\S]*?\n\}/)
  return match?.[0] ?? themeCss
}

let lastTheme = ''
let compilerCache: Promise<{ build: (candidates: string[]) => string }> | null = null

async function getCompiler(themeCss: string, rootDir: string) {
  if (compilerCache && lastTheme === themeCss) return compilerCache
  lastTheme = themeCss
  const themeBlock = extractThemeBlock(themeCss)
  const input = `
@import "tailwindcss/theme" reference;
@import "tailwindcss/utilities" layer(utilities);
${themeBlock}
`
  compilerCache = compile(input, {
    base: rootDir,
    onDependency: () => {},
  }).then(({ build }) => ({ build }))
  return compilerCache
}

export function compileCssPlugin(rootDir: string): Plugin {
  return {
    name: 'page-builder-compile-css',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url?.startsWith('/api/compile-css') || req.method !== 'POST') return next()

          const raw = await readBody(req)
          const body = JSON.parse(raw) as { candidates?: string[]; theme?: string }
          const candidates = Array.isArray(body.candidates) ? body.candidates : []
          const theme =
            typeof body.theme === 'string'
              ? body.theme
              : fs.readFileSync(path.join(rootDir, 'src/styles/theme.css'), 'utf8')

          const { build } = await getCompiler(theme, rootDir)
          const css = build(candidates)

          return send(res, 200, JSON.stringify({ css }), 'application/json; charset=utf-8')
        } catch (error) {
          return send(res, 500, error instanceof Error ? error.message : String(error))
        }
      })
    },
  }
}
