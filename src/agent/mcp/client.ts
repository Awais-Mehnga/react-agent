// GREENFIELD: browser HTTP/SSE MCP client → AI SDK tools

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { useAgentStore } from '../session/store'

const STORAGE_KEY = 'react-agent-mcp-servers'

export type McpServerConfig = { name: string; url: string }

type Connected = {
  name: string
  url: string
  client: Client
}

const connected = new Map<string, Connected>()

export function loadMcpConfigs(): McpServerConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as McpServerConfig[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMcpConfigs(configs: McpServerConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

function jsonSchemaToZodLoose(schema: Record<string, unknown> | undefined) {
  // PORT: MCP tools expose JSON Schema; for Phase 3 accept unknown object args
  void schema
  return z.record(z.string(), z.unknown())
}

async function connectWithTransports(url: URL): Promise<Client> {
  const client = new Client({ name: 'react-agent', version: '0.3.0' })
  try {
    const transport = new StreamableHTTPClientTransport(url)
    await client.connect(transport)
    return client
  } catch {
    const transport = new SSEClientTransport(url)
    const fallback = new Client({ name: 'react-agent', version: '0.3.0' })
    await fallback.connect(transport)
    return fallback
  }
}

export async function connectMcpServer(config: McpServerConfig): Promise<void> {
  await disconnectMcpServer(config.name)
  const client = await connectWithTransports(new URL(config.url))
  connected.set(config.name, { ...config, client })
  await refreshMcpToolsInStore()
}

export async function disconnectMcpServer(name: string): Promise<void> {
  const existing = connected.get(name)
  if (existing) {
    try {
      await existing.client.close()
    } catch {
      // ignore
    }
    connected.delete(name)
  }
  await refreshMcpToolsInStore()
}

export async function refreshMcpToolsInStore(): Promise<void> {
  const tools: ToolSet = {}
  const servers = loadMcpConfigs().map((c) => ({
    ...c,
    connected: connected.has(c.name),
  }))

  for (const [serverName, conn] of connected) {
    const listed = await conn.client.listTools()
    for (const t of listed.tools) {
      const id = `mcp__${serverName}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')
      tools[id] = tool({
        description: `[MCP:${serverName}] ${t.description ?? t.name}`,
        inputSchema: jsonSchemaToZodLoose(t.inputSchema as Record<string, unknown> | undefined),
        execute: async (input) => {
          const result = await conn.client.callTool({
            name: t.name,
            arguments: (input ?? {}) as Record<string, unknown>,
          })
          const content = Array.isArray(result.content)
            ? result.content
                .map((part) => {
                  if (part.type === 'text') return part.text
                  return JSON.stringify(part)
                })
                .join('\n')
            : JSON.stringify(result)
          return content
        },
      })
    }
  }

  useAgentStore.getState().setMcpServers(servers)
  useAgentStore.getState().setMcpToolDefs(tools)
}

export function getConnectedMcpNames(): string[] {
  return [...connected.keys()]
}
