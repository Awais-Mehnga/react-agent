import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bindPersistSubscription, hydrateFromIdb } from './agent/session/persist'

function Root() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let unbind = () => {}
    void hydrateFromIdb().then(() => {
      unbind = bindPersistSubscription()
      setReady(true)
    })
    return () => unbind()
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Loading workspace…
      </div>
    )
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
