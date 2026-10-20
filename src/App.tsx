import { useEffect, useState } from 'react'
import { ChatPanel } from './ui/ChatPanel.tsx'
import { CodeEditor } from './ui/CodeEditor.tsx'
import { InspectorPanel } from './ui/InspectorPanel.tsx'
import { QuestionModal } from './ui/QuestionModal.tsx'
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { useAgentStore } from './agent/session/store'

function App() {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const undo = useAgentStore((s) => s.undo)
  const redo = useAgentStore((s) => s.redo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      {leftOpen ? (
        <div className="w-[min(360px,32vw)] shrink-0">
          <ChatPanel onCollapse={() => setLeftOpen(false)} />
        </div>
      ) : (
        <div className="flex w-10 shrink-0 flex-col items-center border-r border-zinc-800 bg-zinc-950 pt-2.5">
          <button
            type="button"
            title="Expand agent"
            onClick={() => setLeftOpen(true)}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <PanelLeftOpen className="size-4" />
          </button>
          <span className="mt-3 text-[10px] tracking-widest text-zinc-600 [writing-mode:vertical-rl]">
            Agent
          </span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <CodeEditor />
      </div>

      {rightOpen ? (
        <div className="w-[min(280px,28vw)] shrink-0">
          <InspectorPanel onCollapse={() => setRightOpen(false)} />
        </div>
      ) : (
        <div className="flex w-10 shrink-0 flex-col items-center border-l border-zinc-800 bg-zinc-950 pt-2.5">
          <button
            type="button"
            title="Expand page panel"
            onClick={() => setRightOpen(true)}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <PanelRightOpen className="size-4" />
          </button>
          <span className="mt-3 text-[10px] tracking-widest text-zinc-600 [writing-mode:vertical-rl]">
            Page
          </span>
        </div>
      )}

      <QuestionModal />
    </div>
  )
}

export default App
