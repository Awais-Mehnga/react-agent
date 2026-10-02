import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/** Serve @tailwindcss/browser from the Vite origin so the canvas iframe can load it reliably. */
export function tailwindBrowserPlugin(rootDir: string): Plugin {
  const source = path.join(rootDir, 'node_modules/@tailwindcss/browser/dist/index.global.js')
  const route = '/vendor/tailwind-browser.js'

  function serve(reqUrl: string | undefined, res: import('node:http').ServerResponse, next: () => void) {
    if (!reqUrl?.startsWith(route)) return next()
    if (!fs.existsSync(source)) {
      res.statusCode = 404
      res.end('tailwind browser bundle missing — run npm install')
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60')
    fs.createReadStream(source).pipe(res)
  }

  return {
    name: 'serve-tailwind-browser',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        serve(req.url, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        serve(req.url, res, next)
      })
    },
    closeBundle() {
      const outDir = path.join(rootDir, 'dist/vendor')
      fs.mkdirSync(outDir, { recursive: true })
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, path.join(outDir, 'tailwind-browser.js'))
      }
    },
  }
}
