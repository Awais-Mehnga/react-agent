/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LLM_PROVIDER?: string
  readonly VITE_OPENAI_MODEL?: string
  readonly VITE_DEEPSEEK_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.txt?raw' {
  const content: string
  export default content
}

declare module '*.css?raw' {
  const content: string
  export default content
}
