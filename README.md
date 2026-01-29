# Minni

**Persistent structured memory for AI agents.** One database file. Multiple agents. Shared brain.

Minni is a plugin for [OpenCode](https://opencode.ai) that gives your AI agents long-term memory backed by a local [Turso Database](https://docs.turso.tech/introduction) file. Everything your agents learn, whether it's skills, decisions, patterns, anti-patterns, references, all persists across sessions and projects. Copy the file, move it to another machine, and your agents remember everything.

The name comes from Old Norse *minni* which means memory.

> **Status:** VERY Early development. The core plugin works. APIs may change. Right now Turso database is accesible using the Drizzle beta driver with limitations, still no multi access.

> **Models:** I have only tested the system with Anthropic models, will start testing with Kimi and OpenAI soon.

> **Minni Studio** [THIS IS A WORK IN PROGRESS] a quick web tool open and manipulate the database directly

---

https://github.com/user-attachments/assets/052e5e1a-d691-485d-935f-5697c510ca6b

## Why Minni?

I'm sick of having a million markdown files

## But this is just markdown in a database

It may be so, but I think this is better, has more structure and great potential

## Did you use AI to write the code or documentation

Yes but if you see code that sucks, that's mine. You'll notice some parts may have typos as well.

---

## Philosophy

**Your flow, your rules.**

- Nothing is mandatory. No field, no classification, no structure is forced.
- The user decides what to store, when to store it, and how to organize it.
- Minni is infrastructure, not an orchestrator. It does not impose workflows.
- Tools define their own schemas and the LLM reads them and knows how to use them.

---

## Quick Start

### 1. Clone directly into your OpenCode plugins folder

```bash
cd ~/.config/opencode/plugins
git clone git@github.com:Ozmah/minni.git
```

This creates `~/.config/opencode/plugins/minni/` with everything ready.

### 2. Install dependencies

Add these to `~/.config/opencode/package.json`:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "latest",
    "@tursodatabase/database": "^0.4.3",
    "drizzle-orm": "^0.44.2"
  }
}
```

OpenCode runs `bun install` automatically on startup. If it doesn't, run it manually:

```bash
cd ~/.config/opencode && bun install
```

### 3. (Optional) Create your own seed file

The plugin includes `example.seed.ts` with sample data. To use it or create your own:

```bash
cd ~/.config/opencode/plugins/minni/src
cp example.seed.ts seed.ts
# Edit seed.ts with your own data
```

The `seed.ts` file is gitignored so your personal seed won't be tracked in case you include private information.

### 4. Restart OpenCode

Minni registers its tools on startup. After restart, ask the LLM to check minni status

You should see:

```
Minni DB: Connected
Projects: 0
Memories: 0
No active project
```

That's it. One database file at `~/.config/opencode/minni.db`.

---

## Architecture

### Database

A single local Turso Database file (`minni.db`)

**8 tables:**

```
projects          Root containers for everything
memories          All knowledge: skills, decisions, patterns, notes, links
goals             Long-term objectives (belong to a project)
milestones        Checkpoints within a goal
tasks             Actionable items (flexible: project, goal, milestone, or standalone)
tags              Reusable labels (still considering if these will be worth it)
memory_tags       Many-to-many: memories <-> tags
memory_paths      Indexed path segments for classification queries (still considering if these will be worth it)
```

### Planning Hierarchy

```
Project
└── Goal (long-term objective)
    └── Milestone (intermediate checkpoint)
        └── Task (specific action)
```

Tasks are flexible. They can attach to any level or float standalone:

```
Task → Milestone     (most specific)
Task → Goal          (skip milestones)
Task → Project       (general work)
Task → nothing       (standalone)
```

### Hive Mind [THIS IS NOT WORKING YET AS IT DEPENDS ON TURSO DATABASE MULTI-ACCESS]

Multiple agents share the same database:

```
OpenCode (Claude)  ─┐
Cursor (GPT)       ─┼──→  minni.db  ←── one brain
Custom script      ─┘
```

No authentication. No partitioning. If you have access to the file, you have access to everything. The last agent to save context overwrites it, the brain is shared, not versioned.

---

## Memory Types

Every memory has a **type** that classifies what kind of knowledge it is.

### Technical — Executable knowledge

| Type | What it is |
|------|-----------|
| `skill` | How to do something. Procedural, may contain code. |
| `pattern` | Reusable pattern with trade-offs. |
| `anti_pattern` | What NOT to do and why. |

### Knowledge — Understanding

| Type | What it is |
|------|-----------|
| `decision` | Why you chose X over Y (ADR). |
| `insight` | Discovery, aha moment. |
| `comparison` | A vs B analysis. |
| `note` | Free-form, no structure imposed. |

### Reference — External resources

| Type | What it is |
|------|-----------|
| `article` | Blog post, tweet thread, technical writing. |
| `video` | YouTube, conference talk, tutorial. |
| `documentation` | Official docs, guides, references. |
| `link` | Anything else with a URL and a personal note. |

---

## Path System

Paths classify memories beyond their type using a pipe notation:

```
Category -> Topic -> Context
```

Depth is unlimited. Segments are free text. No predefined vocabulary.

```
Config -> Better Auth -> TanStack Start
Integration -> Turso -> ElysiaJS
Deployment -> Docker -> Production
Troubleshooting -> CORS -> Vite Dev Server
Process -> Invoice -> Tax Filing
Setup -> Oh My Zsh -> Plugins
Config -> Hyprland -> Monitors
```

Paths are optional. A memory works fine without one.

---

## Memory Status

Knowledge matures as it's validated:

| Status | Meaning |
|--------|---------|
| `draft` | Just captured. Not validated. **Default.** |
| `experimental` | Being tested. May work, may not. |
| `proven` | Worked at least once in a real scenario. |
| `battle_tested` | Used successfully across multiple projects. |
| `deprecated` | No longer recommended. Kept for history. |

---

## Permission System

Permissions are enforced programmatically — the LLM cannot bypass them.

| Permission | Read | Write | Change permission |
|------------|------|-------|-------------------|
| `open` | Yes | Yes | Minni Studio only |
| `guarded` | Yes | User confirmation required | Minni Studio only |
| `read_only` | Yes | Blocked | Minni Studio only |
| `locked` | Invisible | Blocked | Minni Studio only |

`locked` memories do not appear in any search, list, or tool response. The LLM does not know they exist.

`guarded` memories trigger OpenCode's native permission UI — the user sees an approval prompt before the write executes.

**Minni Studio** = [WIP] a quick web tool open and manipulate the database directly

---

## Tools

Minni registers **12 tools** that the LLM can use:

| Tool | Action | Writes? |
|------|--------|---------|
| `minni_ping` | Health check + stats | No |
| `minni_project` | Create, update, or list projects | Yes |
| `minni_load` | Boot sequence: briefing with inventory, focus, context | No |
| `minni_find` | Universal search across title, content, tags, paths | No |
| `minni_get` | Read full memory content by ID | No |
| `minni_save` | Create a new memory | Yes |
| `minni_update` | Modify an existing memory (permission enforced) | Yes |
| `minni_delete` | Delete a memory (permission enforced) | Yes |
| `minni_goal` | Create, update, or list goals | Yes |
| `minni_milestone` | Create, update, or list milestones | Yes |
| `minni_task` | Create, update, or list tasks | Yes |
| `minni_summary` | Overwrite project context summary | Yes |

---

## Real-World Examples

Minni is for anything you want your agents to remember. Here are practical examples across different domains.

### Web Frameworks

**TanStack Start — Server functions with Eden Treaty**

```
Type:    skill
Title:   Call Elysia routes from TanStack Start via Eden Treaty
Path:    Integration -> Eden Treaty -> TanStack Start
Tags:    tanstack, elysia, eden, isomorphic
Status:  proven

Content:
Import the Eden client inside a server function. The server function
runs on the server so the Elysia routes are callable directly via
localhost without CORS. Use createServerFn from @tanstack/start and
pass the Eden client as the fetcher...
```

**Next.js — App Router + nuqs for type-safe search params**

```
Type:    pattern
Title:   Type-safe URL state with nuqs in App Router
Path:    State -> URL -> Next.js
Tags:    nextjs, nuqs, url-state, app-router
Status:  battle_tested

Content:
Use nuqs parseAsString / parseAsInteger in a client component.
Wrap the layout with NuqsAdapter. The search params become reactive
state that survives navigation and is shareable via URL...
```

**SolidJS — Nested reactive stores**

```
Type:    anti_pattern
Title:   Never spread a SolidJS store into a new object
Path:    Reactivity -> Store -> SolidJS
Tags:    solidjs, reactivity, store
Status:  proven

Content:
Spreading a store ({ ...store }) breaks reactivity. The spread
creates a plain object snapshot — fine for reading, but any component
receiving it loses granular tracking. Use store directly or
unwrap() if you explicitly need a snapshot...
```

### Authentication

**Better Auth — OAuth setup with multiple providers**

```
Type:    skill
Title:   Configure Better Auth with GitHub + Google OAuth
Path:    Config -> Better Auth -> OAuth
Tags:    auth, oauth, github, google
Status:  proven

Content:
In auth.ts, pass socialProviders to betterAuth(). Each provider needs
clientId and clientSecret from env. The callback URL pattern is
/api/auth/callback/{provider}. For TanStack Start, mount the handler
in an API route at routes/api/auth/$.ts using the Hono adapter...
```

### Build Tools & Formatting

**Vite — Custom plugin for auto-importing**

```
Type:    skill
Title:   Write a Vite plugin that auto-imports components
Path:    Plugin -> Vite -> Auto Import
Tags:    vite, plugin, dx
Status:  experimental
```

**oxfmt — Formatter configuration for monorepos**

```
Type:    skill
Title:   Configure oxfmt per-workspace in a Turborepo
Path:    Config -> oxfmt -> Monorepo
Tags:    oxfmt, formatter, turborepo
Status:  draft
```

### System Administration & Dotfiles

**Oh My Zsh — Full setup from scratch**

```
Type:    skill
Title:   Bootstrap Oh My Zsh with plugins and custom theme
Path:    Setup -> Oh My Zsh -> Full Install
Tags:    zsh, terminal, shell, dotfiles
Status:  battle_tested

Content:
1. Install: sh -c "$(curl -fsSL https://raw.github.com/...)"
2. Set ZSH_THEME="powerlevel10k/powerlevel10k" in .zshrc
3. Plugins: plugins=(git zsh-autosuggestions zsh-syntax-highlighting fzf)
4. Custom aliases go in ~/.oh-my-zsh/custom/aliases.zsh
5. For Chezmoi: template the .zshrc and add to chezmoi source...
```

**chezmoi — Dotfile management across machines**

```
Type:    skill
Title:   Manage machine-specific configs with chezmoi templates
Path:    Config -> chezmoi -> Templates
Tags:    dotfiles, chezmoi, portable
Status:  proven

Content:
Use .tmpl extension for files that differ between machines.
chezmoi data provides hostname, os, arch. In .zshrc.tmpl:
{{ if eq .chezmoi.hostname "workstation" }}
export EDITOR="zed --wait"
{{ else }}
export EDITOR="nvim"
{{ end }}
Run chezmoi apply to render. chezmoi diff to preview changes...
```

**Hyprland — Multi-monitor Wayland setup**

```
Type:    skill
Title:   Configure dual monitors with different refresh rates in Hyprland
Path:    Config -> Hyprland -> Monitors
Tags:    wayland, hyprland, linux, display
Status:  proven

Content:
In ~/.config/hypr/hyprland.conf:
monitor=DP-1,2560x1440@144,0x0,1
monitor=HDMI-A-1,1920x1080@60,2560x0,1
For workspaces bound to monitors:
workspace=1,monitor:DP-1,default:true
workspace=9,monitor:HDMI-A-1,default:true
Use wlr-randr to list available outputs if names don't match...
```

**Arch Linux — Post-install essentials**

```
Type:    skill
Title:   Arch post-install: AUR helper + essential packages
Path:    Setup -> Arch Linux -> Post Install
Tags:    arch, linux, pacman, aur
Status:  battle_tested

Content:
1. Install paru: git clone https://aur.archlinux.org/paru.git && cd paru && makepkg -si
2. Essentials: paru -S base-devel git neovim ripgrep fd bat eza zoxide
3. Enable services: systemctl enable --now NetworkManager bluetooth
4. For Wayland: paru -S hyprland waybar wofi swww
5. Fonts: paru -S ttf-jetbrains-mono-nerd noto-fonts-cjk...
```

### Decision Records

**Database choice across projects**

```
Type:    decision
Title:   Chose Turso over Postgres for embedded local-first apps
Path:    Database -> Turso vs Postgres
Tags:    database, turso, postgres, architecture
Status:  battle_tested

Content:
Context: Needed a database for apps that run locally but could
eventually sync. Postgres requires a running server, connection
management, and isn't embeddable.

Decision: Turso (libSQL fork of SQLite). Single file, zero config,
full SQLite compatibility, with multi-write beta for future sync.

Consequences: No LISTEN/NOTIFY, no native JSON columns (use TEXT),
limited concurrent write performance. Acceptable for our scale...
```

### Cross-Domain — Non-Programming

Minni is not limited to code. The `stack` field on projects and the path system are free-form.

```
Type:    note
Title:   Best temp and time for sourdough dutch oven
Path:    Baking -> Sourdough -> Dutch Oven
Tags:    cooking, bread
Status:  proven
Project: (none — global memory)

Content:
Preheat dutch oven at 260°C for 45 min. Score dough, drop in,
lid on. 20 min at 260°C, remove lid, 20 min at 230°C.
The steam from the lid is what makes the crust...
```

---

## Global Context

Global context provides a persistent identity layer that loads regardless of which project is active. It stores user preferences, cross-project knowledge, and agent instructions that should always be available.

This is the foundation that unifies the entire system — the layer that makes every session start with "I know who you are" before "I know what you're working on."

More details coming soon.

---

## Configuration

> [!NOTE]
> **🔧 IN DEVELOPMENT** — Configuration via `minni.config.json` is planned but not yet implemented. Current behavior uses sensible defaults.

Planned configuration file at `~/.config/opencode/minni.config.json`:

---

## Session Compaction

When OpenCode compacts a session, Minni hooks into the process:

1. **Injects project context** — If a project is loaded, its `contextSummary` is included in the compaction input so the compacted session retains project awareness.
2. **Custom prompts** *(planned)* — Replace OpenCode's default compaction prompt with a project-specific or global prompt that generates structured summaries.
3. **Auto-capture** *(planned)* — Automatically save the compaction result back to the project's `contextSummary`, so the next session picks up where this one left off.

---

## Minni Studio [THIS IS NOT WORKING YET AS IT DEPENDS ON TURSO DATABASE MULTI-ACCESS]

Direct database access for operations the LLM cannot perform:

- View all memories including `locked`
- Change permissions on any memory
- Edit content directly
- Full database visibility and control

**Current implementation:** Open `minni.db` with [Beekeeper Studio](https://www.beekeeperstudio.io/), [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview), or any SQLite-compatible tool.

A dedicated Minni Studio app is on the roadmap.

---

## File Structure

```
~/.config/opencode/plugins/minni/
├── minni.ts              ← Entry point: DB connection, init, compaction hook, tool registration
├── package.json          ← Plugin dependencies
└── src/
    ├── schema.ts         ← 8 Drizzle table definitions with JSDoc
    ├── helpers.ts        ← Types, constants, state management, utility functions
    ├── init.ts           ← CREATE TABLE IF NOT EXISTS (raw SQL bootstrap)
    ├── tools.ts          ← All 12 tools
    ├── example.seed.ts   ← Sample data (copy to seed.ts for your own)
    └── seed.ts           ← Your personal seed (gitignored)
```

---

## Roadmap

- [ ] Global context — persistent identity and preferences layer
- [ ] `dangerously_allow_full_memory_access` — bypass all permission enforcement
- [ ] `minni.config.json` — full configuration support
- [ ] Custom compaction prompts (global + per-project)
- [ ] Auto-capture compaction results as project context
- [ ] Auto-extract decisions and tasks from compaction output
- [ ] Dedicated Minni Studio application
- [ ] Export/import for sharing memory sets
- [ ] MCP server adapter for non-OpenCode editors

---

## License

MIT

Made with love by [Ozmah](https://github.com/Ozmah)
