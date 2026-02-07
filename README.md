# Minni

**Persistent structured memory for AI agents.** One database file. Multiple agents. Shared brain.

The philosophy behind Minni is simple: **reduce the distance between the LLM and the context it needs.** Agents shouldn't dump everything into context hoping something is relevant. They should know what exists, ask for what they need, and load only that. Six tools. Zero bloat.

Currently available as an [OpenCode](https://opencode.ai) plugin. Everything your agents learn persists across sessions and projects, backed by a local [Turso Database](https://docs.turso.tech/introduction) file. Copy the file, move it to another machine, and your agents remember everything.

The name comes from Old Norse _minni_ which means memory.

> **Status:** Early development. Changes are still wide and breaking across the application.

> **Testing Models:** Works really good with Opus and Sonnet models, good enough with GPT 5.2 (pending tests with 5.3) and inconsistent with Kimi K2.5 model.

---

## Features

- **Composable Context** — Agents discover what exists, then load only what they need
- **Everything is a Memory** — Identity, context, scratchpads, skills, decisions — all follow the same system
- **Projects** — Organize work with descriptions, stack info, and scoped tasks
- **Tasks** — Track work items with unlimited subtask hierarchy
- **Viewer** — Real-time web UI with canvas for LLM-to-human communication
- **Permission System** — Protect sensitive memories from modification, enforced programmatically
- **Session Compaction** — Inject identity and project context when OpenCode compacts conversations
- **Settings** — Key-value configuration the LLM cannot read or modify
- **Default Skills** — Two built-in skills for writing project descriptions (technical & human projects)

---

## Quick Start

### 1. Clone into your OpenCode plugins folder

```bash
cd ~/.config/opencode/plugins
git clone git@github.com:Ozmah/minni.git
```

### 2. Install dependencies

Add to `~/.config/opencode/package.json`:

```json
{
	"dependencies": {
		"@opencode-ai/plugin": "latest",
		"@tursodatabase/database": "^0.4.4",
		"better-result": "^2.7.0",
		"drizzle-orm": "^1.0.0-beta.9-e89174b",
		// will be removed when updating to drizzle beta 15+
		"drizzle-zod": "^0.8.3",
		"zod": "^4.3.6"
	}
}
```

Then install:

```bash
cd ~/.config/opencode && bun install
```

### 3. Build the Viewer

```bash
cd ~/.config/opencode/plugins/minni/viewer
bun install
bun run build
```

### 4. Restart OpenCode

After restart, ask the LLM to check Minni status. You should see:

```
[HUD]
project: global
identity: none
counts: 0P 0T(0/0/0) 2M 0C
[/HUD]
```

The 2 memories are the default description skills seeded on first run.

Database file: `~/.config/opencode/minni.db`
Viewer: `http://localhost:8593`

---

## Human Projects, Not Just Code

Minni is designed for **human projects** — not just software development. Projects can be:

- **Technical** — Software, hardware, automation (Role: Executor/User/Meta)
- **Non-technical** — Recipes, hobbies, learning, collections (Role: Advisor)

The key difference is the **agent role**:

- **Executor/User/Meta**: Agent does or uses the work directly
- **Advisor**: Agent guides step-by-step, human executes physically

Two default skills are installed automatically to help write effective project descriptions for both types.

---

## Architecture

### Composable Context Model

Traditional memory systems dump everything into context and hope the LLM figures out what's relevant. Minni inverts this. The agent gets a lightweight state snapshot, discovers what exists, and loads specific pieces on demand.

```
minni_hud    → "I have 3 projects, 14 memories, identity is X"
minni_memory → "find me skills tagged 'deployment'"
minni_equip  → "load memories 5, 8, and 12 into my context"
```

This keeps context windows lean while maintaining full access to the knowledge base.

### Everything is a Memory

Identity, context summaries, and scratchpads are memory types — not special system fields. They follow the same permission system, tagging, and search as any other knowledge.

| Special Type | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `identity`   | Who the user/agent/swarm is. Activated via global pointer. |
| `context`    | Session continuity. One per project scope.                 |
| `scratchpad` | Ephemeral workspace. Forced open permission.               |

### Database

A single local Turso Database file (`minni.db`) with 8 tables:

| Table              | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `projects`         | Root containers with description, stack, permissions |
| `global_context`   | Singleton: active project and identity pointers      |
| `memories`         | All knowledge: skills, decisions, patterns, identity |
| `tasks`            | Work items with optional subtask hierarchy           |
| `tags`             | Reusable labels                                      |
| `memory_tags`      | Many-to-many: memories <> tags                       |
| `memory_relations` | Many-to-many: memories <> memories                   |
| `settings`         | Key-value config, invisible to the LLM               |

### Hive Mind

The `minni.db` file is the source of truth. Any agent, tool, or human can modify the database at any time. This enables the hive mind pattern: multiple agents sharing one brain, each contributing knowledge the others can find and use.

Two known patterns:

- **Solo agent** — One LLM, one brain. Personal assistant with perfect memory.
- **Swarm** — Multiple agents, one brain. True swarm intelligence, many drones, one mind.

Both share the same principle: agents are ephemeral, the brain persists.

### Viewer

A React web app served by Bun on port 8593. Built with TanStack Router + Query + Store.

Features:

- **Canvas** — Real-time markdown display via SSE with exponential backoff
- **Project/Memory/Task views** — Browse and inspect all data
- **Detail drawers** — Click any item to see full details
- **Delete operations** — Remove projects, memories, and tasks with confirmation

The viewer runs in the same process as the plugin, sharing the database instance.

---

## Tools

Minni registers **6 tools**:

| Tool            | Description                                                    | Writes? |
| --------------- | -------------------------------------------------------------- | ------- |
| `minni_hud`     | State snapshot: project, identity, counts. Cheap, call often.  | No      |
| `minni_equip`   | Load memories, identity, project, or task into working memory. | No      |
| `minni_memory`  | CRUD knowledge. Find to discover, equip to read.               | Yes     |
| `minni_project` | CRUD projects. Load action switches project context.           | Yes     |
| `minni_task`    | CRUD work items with subtask support.                          | Yes     |
| `minni_canvas`  | Send/read/clear markdown in Viewer canvas.                     | Mixed   |

---

## Memory Types

| Type            | What it is                                         |
| --------------- | -------------------------------------------------- |
| `skill`         | How to do something. Procedural, may contain code. |
| `pattern`       | Reusable pattern with trade-offs.                  |
| `anti_pattern`  | What NOT to do and why.                            |
| `decision`      | Why you chose X over Y (ADR).                      |
| `insight`       | Discovery, aha moment.                             |
| `comparison`    | A vs B analysis.                                   |
| `note`          | Free-form, no structure imposed.                   |
| `link`          | URL with personal context.                         |
| `article`       | Blog post, tweet thread, technical writing.        |
| `video`         | YouTube, conference talk, tutorial.                |
| `documentation` | Official docs, guides, references.                 |
| `identity`      | Who the user/agent/swarm is.                       |
| `context`       | Session continuity summary.                        |
| `scratchpad`    | Ephemeral workspace.                               |

---

## Memory Status

Knowledge matures as it's validated:

| Status          | Meaning                                     |
| --------------- | ------------------------------------------- |
| `draft`         | Just captured. Not validated. **Default.**  |
| `experimental`  | Being tested. May work, may not.            |
| `proven`        | Worked at least once in a real scenario.    |
| `battle_tested` | Used successfully across multiple projects. |
| `deprecated`    | No longer recommended. Kept for history.    |

---

## Permission System

Permissions are enforced **programmatically**, not by asking the LLM nicely.

| Permission  | Read      | Write             | Notes                           |
| ----------- | --------- | ----------------- | ------------------------------- |
| `open`      | Yes       | Yes               | No restrictions                 |
| `guarded`   | Yes       | User confirmation | Triggers OpenCode permission UI |
| `read_only` | Yes       | Blocked           | Direct DB access only           |
| `locked`    | Invisible | Blocked           | LLM cannot see these exist      |

Permission cascade for new memories:

1. Explicit permission in args
2. Project's `defaultMemoryPermission`
3. `settings.default_memory_permission`
4. Fallback: `"guarded"`

---

## Canvas

The canvas is a real-time communication channel from LLM to human.

```bash
# Send markdown to canvas
minni_canvas content: "# Hello World"

# Read latest page
minni_canvas action: read

# Read all pages
minni_canvas action: read_all

# Clear all pages
minni_canvas action: clear
```

View at `http://localhost:8593` (opens automatically with `action: open`).

---

## Session Compaction

When OpenCode compacts a session, Minni injects:

1. **Active identity** — Loaded from the identity memory pointed to by global context
2. **Project context** — Description, stack, and status of the active project

This ensures compacted sessions retain awareness of who they are and what they're working on.

---

## File Structure

```
~/.config/opencode/plugins/minni/
├── minni.ts              # Entry point: DB init, compaction hook, tools
├── package.json          # Plugin manifest
├── src/
│   ├── schema/           # Drizzle table definitions
│   │   ├── base.ts       # Centralized enums and types
│   │   ├── projects.ts
│   │   ├── memories.ts
│   │   ├── tasks.ts
│   │   ├── settings.ts
│   │   ├── memory-relations.ts
│   │   └── ...
│   ├── server/           # HTTP API + SSE for viewer
│   ├── tools/            # MCP tool implementations
│   │   ├── hud.ts        # State snapshot
│   │   ├── equip.ts      # Context loader
│   │   ├── memory.ts     # Knowledge CRUD
│   │   ├── project.ts    # Project CRUD + load
│   │   ├── task.ts       # Task CRUD
│   │   └── canvas.ts     # Viewer canvas
│   ├── helpers.ts        # Utilities, permission enforcement, project resolution
│   └── init.ts           # Database bootstrap, migrations, seeds
└── viewer/
    ├── src/              # React app (TanStack Router/Query/Store)
    │   ├── routes/       # File-based routing
    │   ├── stores/       # TanStack Store (UI state)
    │   ├── components/   # UI components (Modal, DeleteConfirmModal, etc.)
    │   └── lib/          # API client, utils, config
    └── dist/             # Built viewer (served by Bun)
```

---

## Development

If you're developing Minni itself:

```bash
# Clone to a dev directory (not plugins folder)
git clone git@github.com:Ozmah/minni.git ~/dev/minni
cd ~/dev/minni

# Install dependencies
bun install
cd viewer && bun install && bun run build && cd ..

# Run all checks (lint + format + typecheck root + typecheck viewer)
bun run glados

# Sync to plugins folder
bun run sync

# Restart OpenCode to test changes
```

The `sync` script rsyncs source files to `~/.config/opencode/plugins/minni/`.

Pre-commit hooks run lint and format checks. Pre-push hooks run typecheck and viewer build.

---

## Roadmap

Minni is still changing fast. The core idea is a shared brain for AI agents with a primary focus on OpenCode. No fixed roadmap yet. Still experimenting with how LLMs handle comprehension of tools as well as the details of handling large contexts.

---

## License

MIT

Made with love by [Ozmah](https://github.com/Ozmah)
