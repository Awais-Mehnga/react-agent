/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.txt?raw' {
  const content: string
  export default content
}
