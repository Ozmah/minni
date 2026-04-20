# Minni

> **Composable context for humans and LLMs.** Local-first. One database. Real active selections. Shared brain.

Minni is an OpenCode plugin for managing context as a set of independent working layers instead of a single flattened state. The current model centers around three active selections:

- **Dev Mode** — how the engineer is working
- **Project** — the concrete system being worked on
- **Canvas** — the freeform surface where working material appears before it deserves structure

The goal is simple: make context easier to **compose, inspect, protect, search, and promote**.

---

## The Three Active Selections

### 1. Dev Mode

Dev Mode represents the current engineering posture.

**Examples:** Backend · Typescript Wizard · PHP · Infra Only · Prod Mode · Tryhard

Dev Mode contains:

- identifying information
- permissions
- associated memories
- **Principles**

> Dev Mode does **not** own project commands or project-specific implementation rules.

---

### 2. Project

Project represents the concrete system.

Contains:

- core project information
- commands
- related memories
- **Conventions**
- **Gotchas**

Project stays intentionally thin. It is the anchor, not the complete context.

---

### 3. Canvas

Canvas is:

- freeform
- visible
- rich-rendered
- useful for human ↔ LLM exchange
- the natural place where context starts

Canvas is where you can dump working material without forcing structure too early.

Canvas pages keep an explicit `type` because rendering depends on it.
Current values are `markdown` and `html`, and this leaves room for richer canvas molds later.

**Typical flow:**

1. Freeform entry
2. Maybe refine with a template/preset
3. Promote when structure becomes necessary

Canvas does not structurally belong to Project or Dev Mode, but its **promotes** are affected by the active selections.

---

## Key Ideas

### Autonomous Memories

Memories are reusable and do not need to belong directly to a project.

A memory can be:

- unaffiliated
- associated to one or more projects
- associated to one or more dev modes

### Commands as First-Class Project Records

Commands are no longer just text buried in markdown. They have structure and meaning.

Each command should quickly answer:

- What is it called?
- What does it do?
- Is it dangerous?
- Should it be front-and-center or hidden?

### One Rule System, Three Product Labels

Minni uses one technical family of rule records, shown in product language as:

| Label           | Belongs to |
| --------------- | ---------- |
| **Principles**  | Dev Mode   |
| **Conventions** | Project    |
| **Gotchas**     | Project    |

### Permissions Everywhere They Matter

Because LLMs can modify real records, permissions stay essential.

| Level       | Description                               |
| ----------- | ----------------------------------------- |
| `open`      | Freely modifiable                         |
| `guarded`   | Default, editable records ask before edit |
| `read_only` | Inspectable, not writable                 |
| `locked`    | Hidden from the LLM and not writable      |

> Canvas pages remain the exception: they stay lightweight and open.

### Persisted Active Selections

The currently active Dev Mode and Project are not UI-only state. They are stored in the database so routing stays deterministic for both human and LLM.

---

## Features

| Feature          | Description                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Dev Modes        | Reusable engineering postures such as PHP, Backend, Infra Only, or Hardass                              |
| Projects         | Concrete systems with commands, conventions, gotchas, and related memories                              |
| Canvas           | Freeform live surface for human ↔ LLM exchange, rendering, and early-stage composition                  |
| Memories         | Autonomous reusable knowledge that can remain unaffiliated or be associated with projects and dev modes |
| Commands         | Structured project commands with meaning, risk, and visibility                                          |
| Rules            | One technical family exposed as Principles, Conventions, and Gotchas                                    |
| Permissions      | Protection layer for LLM-modifiable records                                                             |
| Tags             | Reusable labels for search and grouping                                                                 |
| Memory Relations | Memory-to-memory links for connected knowledge                                                          |
| Search           | Planned global search across the main entities                                                          |
| Promotes         | Planned structured promotion paths from Canvas into durable records                                     |

---

## Database Model

```
dev_modes
projects
memories
  project_memories
  dev_mode_memories
commands
rules
canvas
tags
  memory_tags
memory_relations
settings
active_state          ← working name pending
```

`settings` stores internal Minni configuration and behavior toggles. It is not reusable knowledge.

---

## Active-State Routing

Minni is moving toward a persisted active-state model. At minimum the system stores:

- active project
- active dev mode

This means:

- if the human or the LLM changes the active project → DB changes
- if the human or the LLM changes the active dev mode → DB changes
- tools read from persisted state, not temporary UI-only assumptions

---

## Canvas Promotes

The first clear promote path is **Canvas → Memory**, supporting both affiliated and unaffiliated memories.

Future promote paths likely include:

- Canvas → Principle
- Canvas → Convention
- Canvas → Gotcha
- Canvas → Command

Memory remains the first necessary path.

---

## Permission Model

Permissions prevent LLMs from freely damaging important records.

**Applied to:** projects · dev modes · memories · commands · rules

**Not applied to:** Canvas pages

---

## Search Direction

Global search should eventually cover dev modes, projects, memories, commands, rules, and canvas.

Useful filters:

- entity type, permission level
- memory type
- rule kind and scope
- command group and risk level

---

## UI Direction

The UI should evolve toward a **cockpit** built from the active composition:

- Active Dev Mode
- Active Project
- Current Canvas surface
- Important memories
- Commands
- Principles / Conventions / Gotchas

The lower sidebar status area remains very important.

---

## Quick Start

### 1. Clone into your OpenCode plugins folder

```bash
cd ~/.config/opencode/plugins
git clone git@github.com:Ozmah/minni.git
```

### 2. Install dependencies

Add to `~/.config/opencode/package.json` if needed, then:

```bash
cd ~/.config/opencode
bun install
```

### 3. Build the Viewer

```bash
cd ~/.config/opencode/plugins/minni/viewer
bun install
bun run build
```

### 4. Restart OpenCode

Minni will boot the database and viewer automatically.

- **Viewer:** `http://localhost:8593`
- **Database:** `~/.config/opencode/minni.db`

---

## Architecture

| Principle              | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| **Local-first**        | One local database file as the single source of truth                      |
| **Shared brain**       | Humans and LLMs operate on the same persisted records                      |
| **Composable context** | Context composed from active selections, not dumped monolithically         |
| **Protected mutation** | Important records are gated by permissions because the LLM is a real actor |

---

## Why Minni Exists

> The real problem is not storing information.
> The real problem is making context **usable at the right moment** without drowning the human or the LLM in irrelevant state.

The current pivot pushes Minni toward that goal by making the system think in **Dev Mode**, **Project**, and **Canvas** instead of flattening everything into one overloaded abstraction.
