import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { agentApiPlugin } from './vite.agent-api.ts'
import { compileCssPlugin } from './vite.compile-css.ts'
import { tailwindBrowserPlugin } from './vite.tailwind-browser.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  const openaiKey = env.OPENAI_API_KEY ?? ''
  const deepseekKey = env.DEEPSEEK_API_KEY ?? ''

  return {
    plugins: [
      react(),
      tailwindcss(),
      agentApiPlugin(),
      compileCssPlugin(rootDir),
      tailwindBrowserPlugin(rootDir),
    ],
    server: {
      port: 8002,
      host: true,
      proxy: {
        // PORT: keep OPENAI_API_KEY server-side; browser calls /api/openai only
        '/api/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/openai/, '/v1'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (openaiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${openaiKey}`)
              }
            })
          },
        },
        // PORT: DeepSeek OpenAI-compatible API — key stays server-side
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/deepseek/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (deepseekKey) {
                proxyReq.setHeader('Authorization', `Bearer ${deepseekKey}`)
              }
            })
          },
        },
      },
    },
  }
})
