import { ChatPanel } from './ui/ChatPanel'
import { CodeEditor } from './ui/CodeEditor'
import { FileList } from './ui/FileList'

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      <div className="w-52 shrink-0">
        <FileList />
      </div>
      <div className="min-w-0 flex-1">
        <CodeEditor />
      </div>
      <div className="w-[min(420px,40vw)] shrink-0">
        <ChatPanel />
      </div>
    </div>
  )
}

export default App
