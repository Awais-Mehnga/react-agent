# React Agent — Dev Guide (Copy-First)

How to extend this agent without rewriting OpenCode.

Research map: [`../react-agent.md`](../react-agent.md)

---

## Golden rule

**Copy before invent.** If OpenCode already has the logic (fuzzy replace, patch parser, tool descriptions, system prompts), copy that file into `src/agent/vendor/opencode/` and apply the smallest patch. Do not reimplement from memory.

---

## File classification

Before adding or changing agent code, label the work:

| Class | Meaning | Examples |
|-------|---------|----------|
| **COPY** | Verbatim (or near-verbatim) text/assets from OpenCode | `*.txt` prompts |
| **EXTRACT** | Keep pure algorithms; strip Effect / Node FS / LSP / locks | `edit-replace.ts` from `tool/edit.ts` |
| **ADAPT** | Thin wrapper: Zod + VirtualFS + call copied core | `tools/edit.ts`, `tools/read.ts` |
| **GREENFIELD** | No OpenCode equivalent for the browser host | Zustand store, Vite proxy, UI, `loop.ts` |

---

## Attribution & patches

1. Every vendored file starts with a source header, e.g.  
   `// Sourced from opencode/packages/opencode/src/tool/edit.ts`
2. Document each intentional change with `// PORT:` at the change site (one line why).
3. Prefer surgical edits over rewrites. If a patch grows large, stop and re-check whether you should EXTRACT a smaller pure slice instead.

---

## Phase 1 source map

| Action | OpenCode source | Local path |
|--------|-----------------|------------|
| COPY | `packages/opencode/src/session/prompt/gpt.txt` | `src/agent/vendor/opencode/prompts/gpt.txt` |
| COPY | `packages/opencode/src/tool/{edit,write,read,grep,glob}.txt` | `src/agent/vendor/opencode/tools/*.txt` |
| EXTRACT | Pure replacers + `replace()` in `tool/edit.ts` | `src/agent/vendor/opencode/edit-replace.ts` |
| ADAPT | Tool execute bodies | `src/agent/tools/*.ts` |
| GREENFIELD | Loop, FS, session, UI, proxy | `src/agent/{fs,session,loop,llm}.ts`, `src/ui/` |

---

## Forbidden in Phase 1

Do **not** port:

- `effect` / Effect-based `Tool.define`
- Node `fs`, ripgrep binary, `@parcel/watcher`
- LSP, bash/shell, MCP SDK
- Full `session/prompt.ts` Effect loop (inspire semantics only)

---

## Later phases (copy when ready)

| Phase | Copy from OpenCode |
|-------|--------------------|
| 2 | Doom-loop ideas from processor; todo/question tool `.txt` + thin adapters |
| 3 | `tool/apply_patch.ts` + `patch/index.ts` + `apply_patch.txt` (EXTRACT pure parse/apply; ADAPT VirtualFS) |
| 3 | MCP / plugin registration patterns from `tool/registry.ts` + `packages/plugin` |

---

## Adding a new tool

1. Find OpenCode’s `tool/<name>.ts` + `<name>.txt`.
2. **COPY** the `.txt` into `vendor/opencode/tools/`.
3. **EXTRACT** any pure helpers worth keeping.
4. **ADAPT** a thin `src/agent/tools/<name>.ts` that uses `VirtualFS` / browser APIs.
5. Register in `src/agent/tools/registry.ts`.
6. Do not invent a new tool description if OpenCode already has one.

---

## LLM boundary

Only the LLM call leaves the browser (via Vite `/api/openai` proxy). All reads, edits, greps, and workspace state stay local.
