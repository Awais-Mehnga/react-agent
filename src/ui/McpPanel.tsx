import { useEffect, useState } from 'react'
import { useAgentStore } from '../agent/session/store'
import {
  connectMcpServer,
  disconnectMcpServer,
  loadMcpConfigs,
  saveMcpConfigs,
  type McpServerConfig,
  refreshMcpToolsInStore,
} from '../agent/mcp/client'

export function McpPanel() {
  const servers = useAgentStore((s) => s.mcpServers)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const configs = loadMcpConfigs()
    useAgentStore.getState().setMcpServers(configs.map((c) => ({ ...c, connected: false })))
    void refreshMcpToolsInStore().catch(() => undefined)
  }, [])

  const persist = (configs: McpServerConfig[]) => {
    saveMcpConfigs(configs)
    useAgentStore.getState().setMcpServers(
      configs.map((c) => ({
        ...c,
        connected: servers.find((s) => s.name === c.name)?.connected ?? false,
      })),
    )
  }

  const add = () => {
    const n = name.trim()
    const u = url.trim()
    if (!n || !u) return
    const configs = loadMcpConfigs().filter((c) => c.name !== n)
    configs.push({ name: n, url: u })
    persist(configs)
    setName('')
    setUrl('')
  }

  const remove = async (serverName: string) => {
    setBusy(serverName)
    setError(null)
    try {
      await disconnectMcpServer(serverName)
      persist(loadMcpConfigs().filter((c) => c.name !== serverName))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const toggle = async (server: { name: string; url: string; connected: boolean }) => {
    setBusy(server.name)
    setError(null)
    try {
      if (server.connected) await disconnectMcpServer(server.name)
      else await connectMcpServer({ name: server.name, url: server.url })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100">
      <div className="mb-2 text-xs font-medium tracking-wide text-zinc-400">MCP</div>
      <div className="mb-2 flex flex-col gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name"
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-600"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/sse"
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-600"
        />
        <button
          type="button"
          onClick={add}
          className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
        >
          Add server
        </button>
      </div>
      {error ? <div className="mb-2 text-[10px] text-red-400">{error}</div> : null}
      <ul className="space-y-1">
        {servers.map((s) => (
          <li key={s.name} className="rounded border border-zinc-800 px-2 py-1.5">
            <div className="truncate font-mono text-[11px] text-zinc-200">{s.name}</div>
            <div className="truncate font-mono text-[10px] text-zinc-500" title={s.url}>
              {s.url}
            </div>
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                disabled={busy === s.name}
                onClick={() => void toggle(s)}
                className="rounded px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {s.connected ? 'Disconnect' : 'Connect'}
              </button>
              <button
                type="button"
                disabled={busy === s.name}
                onClick={() => void remove(s.name)}
                className="rounded px-1.5 py-0.5 text-[10px] text-red-400/80 hover:bg-zinc-800 disabled:opacity-50"
              >
                Remove
              </button>
              <span className={`ml-auto text-[10px] ${s.connected ? 'text-emerald-500' : 'text-zinc-600'}`}>
                {s.connected ? 'on' : 'off'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
