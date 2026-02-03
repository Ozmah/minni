# Minni

**Persistent structured memory for AI agents.** One database file. Multiple agents. Shared brain.

Currently available as an [OpenCode](https://opencode.ai) plugin. Everything your agents learn persists across sessions and projects, backed by a local [Turso Database](https://docs.turso.tech/introduction) file. Copy the file, move it to another machine, and your agents remember everything.

The name comes from Old Norse _minni_ which means memory.

> **Status:** Early development. Changes are still very wide and breaking across all application.

> **Testing Models:** Works good with Opus and Sonnet, good enough with GPT 5.2 and inconsistent with Kimi K2.5 model.

---

## Features

- **Memories** — Skills, patterns, decisions, insights, links, and more
- **Projects** — Organize work with context summaries that persist between sessions
- **Tasks** — Track work items with unlimited subtask hierarchy
- **Viewer** — Real-time web UI with canvas for LLM-to-human communication
- **Permission System** — Protect sensitive memories from modification
- **Session Compaction** — Inject context when OpenCode compacts conversations
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
    "@tursodatabase/database": "^0.4.3",
    "drizzle-orm": "^1.0.0-beta.12-a5629fb"
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
Minni DB: Connected
Projects: 0
Memories: 2  (default skills)
Mode: Global
```

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

### Database

A single local Turso Database file (`minni.db`) with 7 tables:

| Table            | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `projects`       | Root containers with context summaries                   |
| `global_context` | Singleton for identity, preferences, active project      |
| `memories`       | All knowledge: skills, decisions, patterns, notes, links |
| `tasks`          | Work items with optional subtask hierarchy               |
| `tags`           | Reusable labels                                          |
| `memory_tags`    | Many-to-many: memories ↔ tags                            |
| `memory_paths`   | Indexed path segments for classification queries         |

### Viewer

A React web app served by Bun on port 8593. Built with TanStack Router + Query + Store.

Features:
- **Canvas** — Real-time markdown display via SSE with exponential backoff
- **Project/Memory/Task views** — Browse and inspect all data
- **Detail drawers** — Click any item to see full details

The viewer runs in the same process as the plugin, sharing the database instance.

---

## Tools

Minni registers **11 tools**:

| Tool            | Description                                   | Writes? |
| --------------- | --------------------------------------------- | ------- |
| `minni_ping`    | Health check + stats                          | No      |
| `minni_project` | CRUD projects                                 | Yes     |
| `minni_load`    | Load project context or switch to global mode | No      |
| `minni_find`    | Search memories by title/content/tags/path    | No      |
| `minni_get`     | Read full memory by ID                        | No      |
| `minni_save`    | Create a new memory                           | Yes     |
| `minni_update`  | Modify an existing memory                     | Yes     |
| `minni_delete`  | Delete a memory                               | Yes     |
| `minni_task`    | CRUD tasks with subtask support               | Yes     |
| `minni_summary` | Save context summary for project or global    | Yes     |
| `minni_canvas`  | Send/read/clear markdown in Viewer canvas     | Mixed   |

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

---

## Path System

Paths classify memories using arrow notation:

```
Category -> Topic -> Context
```

Examples:

```
Config -> Better Auth -> TanStack Start
Troubleshooting -> CORS -> Vite Dev Server
Setup -> Oh My Zsh -> Plugins
```

Depth is unlimited. Segments are indexed for efficient querying.

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

1. **Global identity and preferences** (if configured)
2. **Project context summary** (if a project is loaded)

This ensures compacted sessions retain project awareness.

---

## File Structure

```
~/.config/opencode/plugins/minni/
├── minni.ts              # Entry point: DB init, compaction hook, tools
├── package.json          # Plugin manifest
├── src/
│   ├── schema/           # Drizzle table definitions (modular)
│   │   ├── base.ts       # Centralized enums and types
│   │   ├── projects.ts
│   │   ├── memories.ts
│   │   ├── tasks.ts
│   │   └── ...
│   ├── server/           # HTTP API + SSE for viewer
│   ├── tools/            # MCP tool implementations
│   ├── helpers.ts        # Utilities and type helpers
│   └── init.ts           # Database bootstrap + default skills
└── viewer/
    ├── src/              # React app (TanStack Router/Query/Store)
    │   ├── routes/       # File-based routing
    │   ├── stores/       # TanStack Store
    │   ├── components/   # UI components
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

# Sync to plugins folder
bun run sync

# Restart OpenCode to test changes
```

The `sync` script rsyncs source files to `~/.config/opencode/plugins/minni/`.

---

## Roadmap

Minni is still changing too much. Exploring the idea of moving towards a more general-purpose shared brain for AI agents with a primary focus on OpenCode. No clear roadmap yet.

---

## License

MIT

Made with love by [Ozmah](https://github.com/Ozmah)
