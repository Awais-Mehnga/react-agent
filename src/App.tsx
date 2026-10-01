import { ChatPanel } from './ui/ChatPanel.tsx'
import { CodeEditor } from './ui/CodeEditor.tsx'
import { InspectorPanel } from './ui/InspectorPanel.tsx'
import { QuestionModal } from './ui/QuestionModal.tsx'

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      <div className="w-[min(360px,32vw)] shrink-0">
        <ChatPanel />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <CodeEditor />
      </div>
      <div className="w-[min(280px,28vw)] shrink-0">
        <InspectorPanel />
      </div>
      <QuestionModal />
    </div>
  )
}

export default App
