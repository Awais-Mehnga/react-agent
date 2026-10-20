# React Agent — Dev Guide (single source of truth)

**Read this file only.** Do not search or explore the repo unless this guide says a path is required for a surgical edit. Research history lives in `react-agent.md` (optional); this guide supersedes it for day-to-day work.

---

## What this product is

Browser-local **visual HTML/Tailwind page builder** + **tool-calling coding agent**.

| Layer | Where | Job |
|-------|--------|-----|
| VirtualFS + tools + agent loop + UI | Browser | Edit workspace, chat, canvas preview |
| LLM | Network via Vite proxy | Chat + tool calls only |

User asks in chat → agent uses tools on an in-memory FS → canvas shows `page.html` live. Keys never go in the browser; Vite proxies `/api/deepseek` and `/api/openai`.

**Dev:** `npm run dev` → port **8002**. Env: `DEEPSEEK_API_KEY` / `OPENAI_API_KEY`, `VITE_LLM_PROVIDER` (`deepseek`|`openai`), `VITE_DEEPSEEK_MODEL` / `VITE_OPENAI_MODEL`.

---

## Golden rules (always)

1. **Workspace = two files:** `page.html` + `theme.css`. Never invent `index.html`, `style.css`, or other paths.
2. **`page.html` = body fragment only** — `<section>` / `<main>` siblings. No `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<link>`, `<script>`, inline `style=""`, or event handlers.
3. **Edit via tools only** — never paste HTML/CSS into chat. Chat = 2–3 short status sentences.
4. **Surgical edits:** `read` → `edit`. Use `write` only for first create or intentional full replace.
5. **Copy before invent** when porting OpenCode: copy into `src/agent/vendor/opencode/`, mark `// PORT:`, wrap thinly in `src/agent/tools/`.

---

## End-to-end flows

### A. User chat turn (`runAgentTurn`)

```
ChatPanel → runAgentTurn(userText)          # src/agent/loop.ts
  → optional compaction if messages ≥ 10
  → append user + empty assistant messages
  → createToolSet(VirtualFS + askEditPermission)
  → streamText({ system, messages, tools }) # MAX_STEPS=20
  → tool-input-start/delta → pending tool parts in timeline (OpenCode V2)
  → optimistic canvas preview (rAF) for page.html|theme.css
  → edit/write/apply_patch → askEditPermission (Accept/Reject/Always)
  → Accept commits VirtualFS + undo; Reject discards
  → doom-loop stop if same tool+args ×3
  → clear preview only if no pending review
```

- System prompt: `buildSystemPrompt()` = `gpt.txt` + page-builder contract + **full page-design skill** + file list + optional canvas selection.
- Selection: if user selected a node on canvas, last user message gets `[Context: User has selected <tag>…]`.
- Chat UI: Cursor-like expandable steps (thinking, tools, Shiki diffs). Code dumps stripped from chat text.

### B. Build / redesign a page (agent workflow)

1. `read` `page.html` and `theme.css`.
2. Commit palette + tokens + keyframes in `theme.css` (`@theme` + semantic utilities).
3. `write` or surgical `edit` on `page.html` (fragment).
4. Reply in chat: creative direction + what changed — **no code fences**.

Vague briefs (“fun”, “cool”): invent a **specific** brand/world first, then theme, then HTML.

### C. Visual editor (human)

- Center: `CodeEditor` → `ReviewBar` + visual `Editor`/`Canvas` or code mode + `DiffPanel`.
- Left: `ChatPanel` (sessions, expandable activity timeline, todos).
- Right: `InspectorPanel` (classes, **img src/alt**, **a href/target**, stubs, save/compile).
- Double-click text → inline edit; double-click image → media picker; click → selection → inspector.
- Agent streaming uses `previewHtml` / `previewTheme` overlay. **FS write only after Accept** (OpenCode permission gate).

### D. Persist / undo / review / FSA / MCP

| Feature | Mechanism |
|---------|-----------|
| Persist | IndexedDB; **skips while `isRunning`**; saves on idle (`session/persist.ts`) |
| Review | `askEditPermission` → Accept / Always / Reject (`ReviewBar` + `DiffPanel`) |
| Undo/Redo | `undoStack` + `redoStack` (before/after pairs), cap 50 |
| Diff UI | `diff` package + **Shiki** (`ui/diffHighlight.ts`, `DiffView`) |
| Sessions | `updateMessage` does **not** mirror into `sessions` every token; `syncCurrentSession` on turn end |
| FSA | Open folder → memory FS + write-through (`fs/fsa-sync.ts`) |
| MCP | HTTP/SSE → dynamic tools `mcp__server__tool` on store |
| Compaction | LLM summary when history long / max steps hit |
| Title | Small model names new sessions |

### E. Save / export CSS

`compilePageCss(html)` → `POST /api/compile-css` with class candidates → returns `{ html, css, theme }`. Theme file ships raw; utilities compiled for Laravel/host.

---

## Architecture map (edit here)

```
src/
  App.tsx                         # 3-pane shell
  agent/
    loop.ts                       # streamText + tool-input timeline + preview rAF
    llm.ts                        # createAgentModel / provider / model ids
    streamPreview.ts              # partial JSON + HTML leak helpers
    prompts/system.ts             # system prompt assembly
    prompts/title.ts | max-steps.txt
    skills/page-design.md         # injected into system prompt (design law)
    tools/
      registry.ts                 # builtins + MCP; onToolResult hook
      model-tools.ts              # useApplyPatchOnly(modelId)
      types.ts                    # ToolContext + askEditPermission
      read|edit|write|glob|grep.ts
      apply_patch|todowrite|question.ts
      webfetch|websearch|task.ts
    vendor/opencode/              # COPY/EXTRACT from OpenCode
      prompts/gpt.txt | tools/*.txt | edit-replace.ts | patch.ts
    fs/ | session/store.ts | persist.ts | compaction.ts | mcp/
  page/allowedFiles.ts | editorStore.ts
  editor/                         # Canvas (applyAttr, preserve selection)
  html/ | stubs/
  ui/
    ChatPanel.tsx                 # expandable activity timeline
    CodeEditor.tsx | ReviewBar.tsx | DiffPanel.tsx | DiffView.tsx
    diffHighlight.ts              # Shiki
    InspectorPanel.tsx            # img/a attrs + classes + stubs
  styles/theme.css
vite.config.ts | vite.agent-api.ts
```

**Stores**

- `useAgentStore` — files, messages, sessions, todos, **pendingChanges**, **pendingEditPermission**, undo/redo, MCP, FSA.
- `usePageEditorStore` — mode, viewport, preview overlay, selection, `applyClass` / `applyStubAttr` / `applyAttr`.

### Review gate (OpenCode permission)

1. Tool computes `before`/`after` + unified diff (never writes first).
2. `askEditPermission` → live preview + `ReviewBar` / `DiffPanel`.
3. **Accept** / **Always** → `commitChange` (FS + undo). **Reject** → discard.
4. `autoAcceptEdits` skips the modal for the rest of the session.

### Store / render rules

- Do **not** copy `messages` into `sessions` on every stream tick — call `syncCurrentSession` on turn end.
- Prefer narrow Zustand selectors (path keys, not whole `files`).
- Canvas: stable iframe `srcDoc`; in-place HTML patch; preserve selection eid across previews.

**Seed files** (`SEED_FILES` in `store.ts`): starter `page.html` + `theme.css` from `styles/theme.css`.

---

## Tools (what the LLM can call)

Registered in `tools/registry.ts`. Model gating (`model-tools.ts`):

- **`apply_patch` only** when `modelId` includes `gpt-` and **not** `oss` and **not** `gpt-4`.
- Else: **`edit` + `write`** (DeepSeek / gpt-4* / oss) — `apply_patch` hidden.

| Tool | Role |
|------|------|
| `read` | Line-numbered content; marks file read |
| `edit` | Fuzzy string replace (OpenCode replacers); read-before-edit enforced |
| `write` | Full file; read-before-overwrite if exists; HTML normalized |
| `apply_patch` | Begin/End Patch DSL (gated models) |
| `glob` / `grep` | In-memory path / content search |
| `todowrite` | Todo list in UI |
| `question` | Blocks on `QuestionModal` |
| `webfetch` / `websearch` | Via `/api/fetch`, `/api/search` |
| `task` | Nested subagent (`explore`\|`general`), max 10 steps, no recursive `task` |
| `mcp__*` | Dynamic from connected MCP servers |

**Edit args:** `{ filePath, oldString, newString, replaceAll? }`. Empty `oldString` creates a new file only.  
**Write args:** `{ filePath, content }`.  
HTML paths run through `normalizePageHtml` (strip document chrome, fence markers, sanitize).

**Allowed paths:** `assertAllowedWorkspacePath` → only `*.html` / `*.css`. Product contract still: prefer only `page.html` + `theme.css`.

**Replacer order** (in `edit-replace.ts`): Simple → LineTrimmed → BlockAnchor → WhitespaceNormalized → IndentationFlexible → EscapeNormalized → TrimmedBoundary → ContextAware → MultiOccurrence.

---

## Page builder contract (complete)

### `page.html`

- Body fragment: sections/main only.
- Tailwind utility classes + theme token classes (`bg-brand`, `text-ink`, `bg-surface`, `rounded-card`, …).
- Images: real `https://` URLs (e.g. Unsplash).
- No scripts, no external CSS files, no React components in markup.

### `theme.css`

Define `@theme` tokens before big HTML work:

- `--color-brand` (+ shades 50–900), `--color-surface`, `--color-surface-muted`, `--color-ink`, `--color-ink-muted`
- `--radius-card`, `--radius-button`, fonts
- Keyframes + helpers: `.animate-fade-in`, `.animate-slide-up`, custom semantic names

Do not sprinkle raw hex in HTML; use semantic utilities.

### Functional stubs (platform-owned behavior)

Use attributes only — no custom JS:

| `data-stub` | Purpose |
|-------------|---------|
| `blog-grid` | Post grid (`data-source`, `data-limit`, `data-category`) |
| `form` | Form |
| `collection` | Collection |
| `navigation` | Nav |
| `search` | Search |
| `pagination` | Pagination |

Inside: `data-slot`, `data-field` for Laravel fill-in. Registry: `src/stubs/*`.

### Design law (anti-slop) — follow exactly

**Forbidden**

- Cookie-cutter 3-feature icon card grids
- Generic AI copy (“Unlock your potential”, “Supercharge…”, “Welcome to…”)
- Purple→indigo gradient text, glow orbs, glassmorphism spam, emoji headings, pill badge clusters
- Centered-everything with no layout rhythm
- Useless card chrome
- `animate-bounce` / decorative `animate-pulse` / `animate-ping` / `animate-spin`

**Required quality**

- Editorial type hierarchy; asymmetric splits / bento; story sections (hero → proof → mechanism → deep-dive → CTA)
- Tactile hovers (`transition-all duration-200 ease-out hover:-translate-y-0.5…`)
- Motion budget **2–3** patterns; keyframes in `theme.css` only
- Vague brief → invent specific product + palette first

Same content is embedded at runtime from `src/agent/skills/page-design.md` (and mirrored under `.cursor/skills/page-design/`).

---

## LLM / proxy boundary

| Browser call | Server |
|--------------|--------|
| `/api/deepseek` | DeepSeek (OpenAI-compatible) |
| `/api/openai` | OpenAI `/v1` |
| `/api/fetch?url=&format=` | HTTPS fetch → markdown/text/html |
| `/api/search?q=` | DuckDuckGo Instant Answer JSON |
| `/api/compile-css` | Tailwind compile for save |

`createAgentModel(purpose)` — purposes: `code` | `reading` | `small` | `title` | `compaction` | `explore`. Aux tasks use small model env vars.

---

## Extending the agent (OpenCode port classes)

| Class | Meaning |
|-------|---------|
| **COPY** | Prompts `*.txt` into `vendor/opencode/` |
| **EXTRACT** | Pure algorithms (edit-replace, patch) — strip Effect/Node FS |
| **ADAPT** | Thin Zod + VirtualFS tool in `tools/*.ts` |
| **GREENFIELD** | Browser-only: loop, store, UI, Vite proxies |

**Add a tool:** copy OpenCode `.txt` → extract helpers → adapt `tools/<name>.ts` → register in `registry.ts` `allBuiltins`. Do not invent descriptions if OpenCode has them.

**Forbidden ports:** Effect `Tool.define`, Node `fs`, ripgrep binary, LSP, bash/shell as real shell.

Header every vendored file: `// Sourced from opencode/...` and `// PORT:` at each intentional change.

---

## Cursor agent: how to execute “build / redesign / fix page” commands

When the user asks to build or change a page **in this app**:

1. You already have this guide — **do not** glob/search the tree.
2. Operate as the in-app agent would: change only `page.html` and `theme.css` contents in the running app’s workspace (via the app’s agent chat, or by editing those seeded paths if you are coding seeds/fixtures).
3. If coding the **react-agent product itself** (loop, tools, UI): jump straight to the path in the Architecture map; change the smallest file; keep COPY/ADAPT discipline.
4. Never dump full HTML into chat replies to the user.
5. For design tasks, obey the Design law section above — no exploration of `SKILL.md` required; it is summarized here and loaded into the LLM at runtime.

### Common change recipes

| Ask | Touch |
|-----|--------|
| Redesign landing page | Agent tools on `theme.css` then `page.html` |
| Tweak selected element | Selection is injected; `read` + `edit` that markup/classes |
| New stub region | HTML with `data-stub` + fields from stubs table |
| New agent tool | `vendor` txt + `tools/<id>.ts` + `registry.ts` |
| System prompt / design rules | `prompts/system.ts` and/or `skills/page-design.md` |
| Model / provider | `llm.ts` + `.env` + `vite.config.ts` proxy |
| Preview / canvas bugs | `loop.ts` preview helpers, `CodeEditor.tsx`, `editor/Canvas.tsx` |
| Persist / sessions | `session/store.ts`, `persist.ts` |

---

## Loop constants

- `MAX_STEPS = 20` → then compact or max-steps note  
- `DOOM_LOOP_THRESHOLD = 3` identical tool+args → abort turn  
- Subagent `task`: max 10 steps  

---

## Bottom line

Same contract as OpenCode: **tool-calling + surgical string edits** (or gated `apply_patch`), with **permission before write**, streaming tool args into the timeline, and Shiki diffs for review. VirtualFS is a **two-file page builder**; canvas shows live preview; Accept commits. For “build something”: follow the page-builder contract + design law → `read` → `theme.css` → `page.html` → short chat status.
