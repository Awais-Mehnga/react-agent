# React Agent — OpenCode Research & Implementation Map

Research notes for building a **browser-local coding agent** in `react-agent/`, inspired by OpenCode.  
**Scope for v1:** edit code held in variables / React state / browser storage. LLM calls only leave the browser.  
**No implementation code in this doc** — paths, libraries, and architecture only.

---

## 1. Goal

| Layer | Runs where | Responsibility |
|-------|------------|----------------|
| Virtual filesystem + tools + agent loop + UI | Browser | Read/search/edit code, tool registry, session state |
| LLM API (OpenAI direct or proxy) | Network only | Chat completions / Responses with tool calling |

Future-ready: same tool registry can later host MCP clients, `webfetch` / `websearch`, browser tools, etc., without rewriting the loop.

---

## 2. How OpenCode Works (mental model)

OpenCode is a **tool-calling agent**, not an “LLM writes a full file” agent.

```
User message
  → assemble system prompt (provider + env + AGENTS.md + skills + MCP)
  → stream LLM with tool definitions
  → on tool_call: run local tool → append tool result to messages
  → loop until finish ≠ tool-calls (or max steps / compact)
```

**Surgical edits** mean the model only emits the *changed* text (or a patch DSL), not the whole file. The host applies that change to the real (or virtual) file contents.

There are **two edit strategies** (mutually exclusive per model):

| Strategy | Tool(s) | When OpenCode enables it |
|----------|---------|---------------------------|
| **A. String replace** | `edit` + `write` | Non-GPT, or models matching `gpt-4*` / `oss` |
| **B. Patch DSL** | `apply_patch` only | `modelID` includes `gpt-` but **not** `oss` and **not** `gpt-4` |

Selection lives in:

- `opencode/packages/opencode/src/tool/registry.ts` (≈ lines 297–300)

Your current model (`gpt-4o-mini` in `.env`) matches `includes("gpt-4")` → OpenCode would give it **`edit` + `write`**, not `apply_patch`.

**Recommendation for react-agent v1:** implement **strategy A (`edit` + `write`)** first — simpler JSON args, one file path per call, easy to map onto in-memory state. Add `apply_patch` later if you switch to Codex-style models.

---

## 3. Surgical edit — step by step

### 3.1 Strategy A — `edit` (primary for v1)

**LLM tool arguments (JSON):**

```ts
{
  filePath: string      // path key in the virtual FS
  oldString: string     // exact (or fuzzy-matchable) snippet to find
  newString: string     // replacement (must differ)
  replaceAll?: boolean  // default false; rename/multi-site updates
}
```

**Apply pipeline** (port from OpenCode):

1. Resolve `filePath` against virtual FS / store.
2. Require prior `read` of that file in the session (OpenCode enforces this via tool description + practice).
3. Read current content from memory (preserve line endings).
4. Run fuzzy `replace(content, oldString, newString, replaceAll)` — matchers tried in order until a unique match (unless `replaceAll`).
5. Write new content back to the store / Zustand / File System Access handle.
6. Optionally compute a unified diff (`diff` package) for UI.
7. Return a short success string (+ diagnostics later) as the tool result to the model.

**Empty `oldString`:** create a **new** file only. Overwrite existing files with `write`.

**Source implementation:**

| What | Path |
|------|------|
| Tool + fuzzy replacers | `opencode/packages/opencode/src/tool/edit.ts` |
| Tool description prompt | `opencode/packages/opencode/src/tool/edit.txt` |
| V2 / core variant | `opencode/packages/core/src/tool/edit.ts` |

**Fuzzy replacer order** (copy these; they are the “surgical edit reliability” layer):

1. `SimpleReplacer` — exact substring  
2. `LineTrimmedReplacer` — per-line trim  
3. `BlockAnchorReplacer` — first/last line anchors + Levenshtein on middle (≥0.65)  
4. `WhitespaceNormalizedReplacer`  
5. `IndentationFlexibleReplacer`  
6. `EscapeNormalizedReplacer`  
7. `TrimmedBoundaryReplacer`  
8. `ContextAwareReplacer`  
9. `MultiOccurrenceReplacer`  

Inspiration cited in OpenCode code: Cline diff-apply evals + Gemini CLI `editCorrector`.

**Multiple places in one file:** either one `edit` with `replaceAll: true`, or multiple sequential `edit` calls (each with unique surrounding context). Prefer unique context over fragile single-line matches.

### 3.2 Strategy B — `apply_patch` (OpenAI / Codex-style)

**LLM tool arguments:**

```ts
{ patchText: string }  // full envelope below
```

**Format:**

```
*** Begin Patch
*** Add File: path
+line
*** Update File: path
*** Move to: newpath   # optional
@@ context
-old
+new
*** Delete File: path
*** End Patch
```

**Apply pipeline:**

1. `Patch.parsePatch(patchText)` → `Hunk[]` (`add` | `update` | `delete`)  
2. For updates: seek context lines in file (fuzzy trailing-newline retries) → splice  
3. Multi-file write/delete/move in one tool call  
4. Return summary of A/M/D paths  

| What | Path |
|------|------|
| Tool | `opencode/packages/opencode/src/tool/apply_patch.ts` |
| Description | `opencode/packages/opencode/src/tool/apply_patch.txt` |
| Parser / apply engine | `opencode/packages/opencode/src/patch/index.ts` |
| Core variant | `opencode/packages/core/src/tool/apply-patch.ts` |

### 3.3 Full overwrite — `write`

```ts
{ filePath: string, content: string }
```

| What | Path |
|------|------|
| Tool | `opencode/packages/opencode/src/tool/write.ts` |
| Description | `opencode/packages/opencode/src/tool/write.txt` |

Always prefer `edit` for existing files; `write` for create / intentional full replace.

### 3.4 Context before edit — `read`

Returns line-numbered content: `1: ...`, `2: ...`. Model must copy content **without** the `N: ` prefix into `oldString`.

| What | Path |
|------|------|
| Tool | `opencode/packages/opencode/src/tool/read.ts` |
| Description | `opencode/packages/opencode/src/tool/read.txt` |

---

## 4. How OpenCode prompts the LLM

### 4.1 Prompt stack (assembly order)

Implemented around:

- `opencode/packages/opencode/src/session/system.ts`
- `opencode/packages/opencode/src/session/llm/request.ts`
- `opencode/packages/opencode/src/session/instruction.ts`

Typical stack:

1. **Agent prompt** if set, else **provider system prompt** (e.g. `gpt.txt`)  
2. **Environment block** (cwd, platform, date, model) — generated, not a file  
3. **Project instructions** — `AGENTS.md` / optional `CLAUDE.md`  
4. MCP instructions + skills (optional)  
5. User override / plugin `experimental.chat.system.transform`  

### 4.2 Provider / system prompt files

Base: `opencode/packages/opencode/src/session/prompt/`

| File | Role |
|------|------|
| `default.txt` | Fallback |
| `anthropic.txt` | Claude |
| `gemini.txt` | Gemini |
| `gpt.txt` | GPT (default GPT path) — **start here for OpenAI** |
| `gpt-astra.txt` | gpt-6 family |
| `codex.txt` | Codex |
| `beast.txt` | gpt-4 / o1 / o3-style |
| `kimi.txt` | Moonshot / Kimi |
| `trinity.txt` | Trinity |
| `meta.txt` | Muse |
| `copilot-gpt-5.txt` | Copilot GPT-5 |
| `plan.txt` | Plan mode content |
| `plan-mode.txt` | Plan mode |
| `plan-reminder-anthropic.txt` | Anthropic plan reminder |
| `build-switch.txt` | Mode switch |

Reminders injection: `opencode/packages/opencode/src/session/reminders.ts`

### 4.3 Agent prompts

Base: `opencode/packages/opencode/src/agent/`

| File | Role |
|------|------|
| `agent.ts` | Agent registry (`build`, `plan`, `explore`, `general`, …) |
| `prompt/explore.txt` | Explore subagent |
| `prompt/compaction.txt` | Context compaction |
| `prompt/summary.txt` | Summarization |
| `prompt/title.txt` | Session title |
| `generate.txt` | Meta-prompt to generate new agents |

Built-in `build` / `plan` / `general` often rely on provider prompt + permissions rather than a dedicated `.txt`.

### 4.4 Tool description prompts (critical — they teach surgical edits)

Base: `opencode/packages/opencode/src/tool/`

| Tool ID | Description file |
|---------|------------------|
| `edit` | `edit.txt` |
| `write` | `write.txt` |
| `apply_patch` | `apply_patch.txt` |
| `read` | `read.txt` |
| `grep` | `grep.txt` |
| `glob` | `glob.txt` |
| `bash` | `shell/shell.txt` (+ `shell/prompt.ts`) |
| `task` | `task.txt` |
| `todowrite` | `todowrite.txt` |
| `skill` | `skill.txt` |
| `question` | `question.txt` |
| `webfetch` | `webfetch.txt` |
| `websearch` | `websearch.txt` |
| `lsp` | `lsp.txt` |
| `plan_exit` / enter | `plan-exit.txt`, `plan-enter.txt` |

### 4.5 Command templates

- `opencode/packages/opencode/src/command/template/initialize.txt`
- `opencode/packages/opencode/src/command/template/review.txt`

### 4.6 What to port for react-agent v1 system prompt

Adapt ideas from `gpt.txt` (editing philosophy, autonomy, minimal diffs) + shorten for browser:

- You edit a **virtual workspace** in the browser (paths are keys, not OS paths).  
- Prefer `read` then `edit`; use `write` only for new/full files.  
- Smallest correct change; no drive-by refactors.  
- Parallelize independent tool calls when the API supports it.

Do **not** copy shell/git/destructive-command sections verbatim until those tools exist.

---

## 5. Agent loop & LLM wiring (OpenCode paths)

| Role | Path |
|------|------|
| Outer loop (`while true`) | `opencode/packages/opencode/src/session/prompt.ts` (`runLoop`) |
| Stream → message parts | `opencode/packages/opencode/src/session/processor.ts` |
| LLM stream entry | `opencode/packages/opencode/src/session/llm.ts` |
| Request / system / tools prep | `opencode/packages/opencode/src/session/llm/request.ts` |
| AI SDK adapter | `opencode/packages/opencode/src/session/llm/ai-sdk.ts` |
| Tools → AI SDK `tool({ execute })` | `opencode/packages/opencode/src/session/tools.ts` |
| Tool registry | `opencode/packages/opencode/src/tool/registry.ts` |
| Tool type / `Tool.define` | `opencode/packages/opencode/src/tool/tool.ts` |
| System assembly | `opencode/packages/opencode/src/session/system.ts` |
| Max-steps prompt | `@opencode-ai/core/session/runner/max-steps` (core package) |
| V2 runner (future OpenCode) | `opencode/packages/core/src/session/runner/` |
| V2 tool design spec | `opencode/specs/v2/tools.md` |
| Session schemas | `opencode/packages/schema/src/v1/session.ts` |
| Native LLM package | `opencode/packages/llm/` |
| Plugin tool API | `opencode/packages/plugin/src/tool.ts` |

**Loop finish rule:** continue while `finish ∈ { "tool-calls", "unknown" }` or unfinished tool parts remain; else idle.

**Doom-loop guard:** identical tool call repeated ~3× → permission / stop (see processor / permission path).

---

## 6. Complete OpenCode tool inventory

### 6.1 Implementations (primary: `packages/opencode/src/tool/`)

| ID | Implementation | Port to browser v1? |
|----|----------------|---------------------|
| `read` | `read.ts` | **Yes** (virtual FS) |
| `edit` | `edit.ts` | **Yes** |
| `write` | `write.ts` | **Yes** |
| `glob` | `glob.ts` | **Yes** (in-memory path list / minimatch) |
| `grep` | `grep.ts` | **Yes** (scan string contents; no ripgrep binary) |
| `apply_patch` | `apply_patch.ts` + `../patch/index.ts` | Later (GPT/Codex) |
| `todowrite` | `todo.ts` | Nice-to-have |
| `question` | `question.ts` | Nice-to-have (UI modal) |
| `invalid` | `invalid.ts` | Yes (bad tool-call repair) |
| `bash` / shell | `shell.ts` | No (unless WebContainer later) |
| `task` | `task.ts` | Later (subagents) |
| `webfetch` | `webfetch.ts` | Later |
| `websearch` | `websearch.ts` | Later |
| `skill` | `skill.ts` | Later |
| `lsp` | `lsp.ts` | Later / experimental |
| `execute` (codemode) | `code-mode.ts` | Later |
| `plan_exit` | `plan.ts` | Later |

Core duplicates (Effect-based V2 direction): `opencode/packages/core/src/tool/*`

### 6.2 Extensibility hooks (room for MCP / plugins)

| Mechanism | Path |
|-----------|------|
| Tool registry + plugin tools | `tool/registry.ts` |
| Plugin `tool({ description, args, execute })` | `packages/plugin/src/tool.ts` |
| MCP wiring into session tools | `packages/opencode/src/session/tools.ts`, `packages/opencode/src/mcp/` |
| Workspace custom tools | `.opencode/tool/*.ts` (e.g. `github-triage.ts`) |
| V2 registration model | `opencode/specs/v2/tools.md` |

**Browser pattern:** define a single `ToolRegistry` with `register(name, def)` so v1 tools and future MCP/browser tools share one interface:

```ts
// Conceptual shape (not implementing yet)
type ToolDef = {
  id: string
  description: string
  parameters: ZodSchema | JSONSchema
  execute: (args, ctx) => Promise<{ output: string; metadata?: unknown }>
}
```

---

## 7. Libraries — OpenCode vs what react-agent should use

### 7.1 Already in `react-agent/package.json`

- `react`, `react-dom`
- `zustand` — session + virtual FS + messages store
- `tailwindcss`, `@tailwindcss/vite`
- `lucide-react`
- `vite`, `typescript`

### 7.2 Libraries to add for v1 (browser agent)

| Library | Why |
|---------|-----|
| `ai` (Vercel AI SDK) | Streaming + tool calling loop (`streamText` / `generateText`) — same default path OpenCode uses |
| `@ai-sdk/openai` | OpenAI provider (direct or custom `baseURL` proxy) |
| `zod` | Tool parameter schemas → JSON Schema for the model |
| `diff` | Unified diffs for UI / confirmation (`createTwoFilesPatch`, `diffLines`) — OpenCode uses this |
| `ulid` or `nanoid` | Message / tool-call IDs |
| `minimatch` | Browser-friendly `glob` without Node `fs` |
| `partial-json` (optional) | Parse streaming tool args if needed |

### 7.3 Port / copy as source (not npm packages)

These are OpenCode’s own modules — **copy/adapt** the algorithms into `react-agent/src/agent/`:

| Logic | Source |
|-------|--------|
| Fuzzy string replace | `opencode/packages/opencode/src/tool/edit.ts` (replacer exports) |
| Patch parser | `opencode/packages/opencode/src/patch/index.ts` |
| Tool description `.txt` content | `opencode/packages/opencode/src/tool/*.txt` |
| GPT system prompt tone | `opencode/packages/opencode/src/session/prompt/gpt.txt` |

### 7.4 OpenCode deps — **skip for browser v1**

| Dependency | Reason to skip |
|------------|----------------|
| `effect` | Heavy; use plain async/await + Zustand unless you want Effect later |
| `web-tree-sitter` / bash grammars | Shell AST for permission extraction only |
| `@parcel/watcher`, `chokidar` | Native FS watching |
| `@modelcontextprotocol/sdk` | Add when MCP is in scope |
| `@opencode-ai/*` monorepo packages | Not browser-bundled as-is |
| Ripgrep binary | Replace with in-memory search |
| LSP client | Optional later |

### 7.5 Browser-only storage / FS adapters (future)

| API | Use |
|-----|-----|
| Zustand + `Map<path, string>` | v1 virtual workspace |
| `localStorage` / `IndexedDB` | Persist workspace between reloads |
| [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) | Edit real local folders when user grants permission |
| OPFS | Larger offline workspaces |

Abstract behind `VirtualFS { read, write, exists, list, delete }` so tools never care about the backend.

---

## 8. Suggested react-agent architecture (scalable)

```
react-agent/src/
  agent/
    loop.ts              # while tools pending → LLM → execute → append
    llm.ts               # OpenAI via AI SDK (baseURL switch for proxy)
    prompts/
      system.ts          # adapted from gpt.txt (browser wording)
      tools/
        edit.txt | write.txt | read.txt | grep.txt | glob.txt
    tools/
      registry.ts        # register / list / getOpenAITools()
      types.ts           # ToolDef, ToolContext, ToolResult
      read.ts
      edit.ts            # port fuzzy replacers from OpenCode
      write.ts
      glob.ts
      grep.ts
      invalid.ts
    fs/
      types.ts           # VirtualFS interface
      memory-fs.ts       # Map / Zustand-backed
      # later: idb-fs.ts, fsa-fs.ts
    session/
      types.ts           # messages, parts, tool states
      store.ts           # Zustand
  ui/
    chat/, editor/, diff/
  App.tsx
```

### 8.1 Data flow (v1)

1. UI holds/edits files in Zustand (`files: Record<path, content>`).  
2. User sends chat message → `agent.loop`.  
3. LLM sees system prompt + tool schemas + message history.  
4. Model calls `read` / `grep` / `edit` / …  
5. Tools mutate the same Zustand FS.  
6. React re-renders editor from store.  
7. Only `fetch` to OpenAI (or your proxy) leaves the browser.

### 8.2 LLM transport

| Mode | How |
|------|-----|
| Direct OpenAI | `@ai-sdk/openai` + `OPENAI_API_KEY` (dev only; keys in browser are leaky) |
| Proxied | Same SDK with `baseURL: https://your-proxy/...` — **preferred for production** |

Vite env: `VITE_OPENAI_API_KEY`, `VITE_OPENAI_MODEL`, `VITE_OPENAI_BASE_URL` (do not commit secrets).

---

## 9. OpenCode packages map (reference)

| Package | Role |
|---------|------|
| `packages/opencode` | **Main agent** — prompts, tools, loop, patch |
| `packages/core` | Shared Effect services, V2 runner, core tools |
| `packages/llm` | Native multi-provider streaming |
| `packages/plugin` | External tool/hook API |
| `packages/schema` | Session / message schemas |
| `packages/codemode` | Sandboxed `execute` tool |
| `packages/sdk` / `sdk-next` / `server` / `protocol` | HTTP & client surfaces |
| `packages/app` / `session-ui` / `tui` / `ui` | Frontends (patterns only) |

---

## 10. Tests worth reading before implementing

| Area | Path |
|------|------|
| Edit / fuzzy match | `opencode/packages/opencode/test/tool/edit.test.ts` |
| Apply patch | `opencode/packages/opencode/test/tool/apply_patch.test.ts` |
| Write | `opencode/packages/opencode/test/tool/write.test.ts` |
| Read | `opencode/packages/opencode/test/tool/read.test.ts` |
| Registry / GPT tool swap | `opencode/packages/opencode/test/tool/registry.test.ts` |

---

## 11. Implementation phases (no code yet — roadmap)

### Phase 0 — this doc  
Done: map prompts, tools, edit mechanics, libraries.

### Phase 1 — v1 simple agent (your ask)

**Copy-first porting rules:** [`react-agent/DEV_GUIDE.md`](react-agent/DEV_GUIDE.md)

1. `VirtualFS` + Zustand  
2. Tools: `read`, `edit` (with OpenCode replacers), `write`, `glob`, `grep`  
3. System prompt adapted from `gpt.txt` + tool `.txt` descriptions  
4. Agent loop via `ai` + `@ai-sdk/openai`  
5. Minimal chat + file list + code viewer UI  

### Phase 2 — polish

**Done.** Undo + DiffPanel, `todowrite` / `question`, IndexedDB persistence, doom-loop + max-steps. See [`react-agent/DEV_GUIDE.md`](react-agent/DEV_GUIDE.md).

- Diff preview after apply / undo stack  
- `todowrite`, `question`  
- Persist FS to IndexedDB  
- Doom-loop detection + max steps  

### Phase 3 — OpenCode parity extensions

**Done.** `apply_patch` (model-gated), File System Access workspace sync, `webfetch`/`websearch` (+ Vite proxies), HTTP/SSE MCP client tools, nested `task` subagent. See [`react-agent/DEV_GUIDE.md`](react-agent/DEV_GUIDE.md) Phase 3 map.

- `apply_patch` for Codex-class models  
- MCP client tools in the same registry  
- `webfetch` / `websearch`  
- File System Access API workspace  
- Subagents (`task`)  

---

## 12. Quick “copy these files” checklist

**Must read / port for surgical edits:**

1. `opencode/packages/opencode/src/tool/edit.ts`  
2. `opencode/packages/opencode/src/tool/edit.txt`  
3. `opencode/packages/opencode/src/tool/write.ts` + `write.txt`  
4. `opencode/packages/opencode/src/tool/read.ts` + `read.txt`  
5. `opencode/packages/opencode/src/session/prompt/gpt.txt`  
6. `opencode/packages/opencode/src/tool/tool.ts` (interface shape)  
7. `opencode/packages/opencode/src/tool/registry.ts` (model→tool selection)  
8. `opencode/packages/opencode/src/session/prompt.ts` (loop semantics)  

**Optional next:**

9. `opencode/packages/opencode/src/patch/index.ts` + `apply_patch.ts` + `apply_patch.txt`  
10. `opencode/packages/opencode/src/tool/grep.ts` + `glob.ts` (+ `.txt`)  
11. `opencode/specs/v2/tools.md` (scalable registry design)  
12. `opencode/packages/plugin/src/tool.ts` (future plugins/MCP-shaped tools)  

---

## 13. Bottom line

OpenCode does **not** use AST rewriting for agent edits. The model proposes a **small string replacement** (`edit`) or a **Begin/End Patch** blob (`apply_patch`); the host finds the target with fuzzy matchers and writes the new file contents. Streaming tool-calling (`ai` SDK) + a pluggable tool registry is the entire agent. For a browser-local react-agent, keep that same contract, swap Node FS for an in-memory / IndexedDB / File System Access backend, and keep the LLM as the only remote dependency.
