# Minni System Design

**Working source of truth for the current Minni pivot.**

This document is intentionally dense. It is not a README, not a marketing page, and not a quick-start guide. It exists to capture the current conceptual model of Minni after the pivot from the old project/task-centric model.

---

## 1. Core idea

Minni is no longer being treated as a single-axis memory system.

The active context of the system is now understood as the composition of **three independent selections**:

- **Dev Mode**
- **Project**
- **Canvas**

These are not the same kind of thing and must not be collapsed into one entity.

### Why this matters

Previous attempts tried to flatten everything into one dimension, usually around project or around an abstract profile. That created a mismatch because:

- a **Dev Mode** is not a project
- a **Project** is not a working posture
- **Canvas** is not either of those; it is a live surface

So the correct framing is:

> **Active context = Dev Mode + Project + Canvas**

Then other pieces attach to that composition:

- memories
- commands
- rules
- tags
- relations
- search
- promotes

---

## 2. The three active selections

## 2.1 Dev Mode

Dev Mode represents **how the engineer is working right now**.

Examples:

- Backend
- PHP
- Infra Only
- Prod Mode
- Hardass

A Dev Mode is not “the project configuration”. It is a reusable engineering posture.

### Dev Mode contains

- identifying information
- permission
- associated memories
- principles

### Dev Mode does not contain

- project commands
- project conventions
- project gotchas
- project-specific operational details

### Dev Mode exists to answer

- what kind of engineer am I being right now?
- what rules of work apply globally to this posture?
- what reusable memories should be near at hand while working this way?

---

## 2.2 Project

Project represents **the concrete system being worked on**.

A Project is intentionally kept thinner than older versions of Minni.

### Project contains

- core project information
- permission
- commands
- conventions
- gotchas
- related memories

### Project exists to answer

- what is this thing?
- how do I run it?
- what commands matter?
- what conventions define work inside this codebase?
- what gotchas will hurt me if I forget them?

### Project does not represent

- engineer posture
- coding mood
- cross-project mindset
- temporary freeform composition

That belongs elsewhere.

---

## 2.3 Canvas

Canvas remains **Canvas**.

The name does not change.

Canvas is the live, unstructured, low-friction surface where context can appear before it deserves structure.

Canvas pages keep an explicit `type` because rendering depends on it.
Current values are `markdown` and `html`, and this leaves room for richer template-driven canvas surfaces later.

### Canvas is

- a freeform entry point
- a staging area
- a live presentation surface
- a renderer for markdown/html/moldes
- a place where human and LLM can exchange working material
- the place where something begins before it becomes durable

### Canvas is not

- a project-owned table
- a dev-mode-owned structure
- a durable model of record for reusable knowledge

### The role of Canvas

Canvas is where things start with minimal consequences.

Flow:

1. freeform content
2. maybe a molde/template for refinement
3. promote if structure becomes necessary

### Important nuance

Canvas itself is not structurally attached to Project or Dev Mode.

But **Canvas actions are affected by the active selections**.

Examples:

- promote to **Principle** → current Dev Mode
- promote to **Convention** → current Project
- promote to **Gotcha** → current Project
- promote to **Command** → current Project
- promote to **Memory with affiliation** → selected Project or selected Dev Mode
- promote to **Memory without affiliation** → autonomous path remains valid

That distinction is critical:

> Canvas is free, but promotes are context-aware.

---

## 3. Supporting concepts

## 3.1 Memories

Memories remain one of the strongest parts of Minni.

They are reusable, durable knowledge.

### Memories are autonomous

That is now an explicit design decision.

A memory:

- can exist without project affiliation
- can be associated with one or more projects
- can be associated with one or more dev modes

So the old design where memories carried `project_id` directly is no longer the preferred shape.

### Memory evolution

Memory status remains functional because it models knowledge maturity:

- `draft`
- `experimental`
- `proven`
- `battle_tested`
- `deprecated`

This is not administrative fluff. It is semantic information about confidence.

### Memory promote/demote actions

Minni should support easy movement through the lifecycle:

- draft → experimental
- experimental → proven
- proven → battle_tested
- any relevant item → deprecated

---

## 3.2 Commands

Commands are project-owned operational entries.

They are not raw notes buried in markdown anymore.

A Command exists to make project operation easy for both human and LLM.

### Commands answer

- what do I run?
- what does this command do?
- is it safe or dangerous?
- should it be prominent or hidden?

### Commands always belong to a project

This is fixed.
No command belongs to Dev Mode.

---

## 3.3 Rules

A single technical table can support three product concepts.

### Product labels

- Dev Mode → **Principles**
- Project → **Conventions**
- Project → **Gotchas**

### Single table rationale

This keeps the model simple while preserving good product language.

Technical storage can be one family of records with:

- scope type
- scope id
- kind

### Meanings

- **Principles** → Dev Mode rules of work
- **Conventions** → Project-specific ways of doing things
- **Gotchas** → Project-specific traps, caveats, and sharp edges

---

## 3.4 Permissions

Permissions remain important and are now treated as system-wide protection for all LLM-modifiable records.

### Why permissions stay

Because Minni is explicitly a system where the LLM can modify real records.
That means protection cannot be optional.

### Permission values

- `open`
- `guarded`
- `read_only`
- `locked`

### Default

Everything modifiable by the LLM starts as:

- `guarded`

### Where permissions apply

- projects
- dev_modes
- memories
- commands
- rules

### Where permissions do not currently apply

Canvas pages themselves remain open and direct by design.

Canvas already behaves like a scratch/live surface with direct actions such as copy/delete, and that behavior remains valuable.

---

## 3.5 Active selections

Active selections must be persisted in the database.

This is a hard rule.

### Why

Because Minni should not rely on UI-only state for routing context.

When human or LLM changes:

- active Dev Mode
- active Project

that must immediately become system state, not temporary UI state.

### Practical consequence

There must be an active-state table storing at least:

- active project
- active dev mode

### Meaning

If the human or the LLM changes the Dev Mode, it writes the database.
If the human or the LLM changes the Project, it writes the database.
Everything downstream resolves from persisted state.

This makes the system deterministic.

---

## 3.6 Tags and memory relations

These stay.

### Tags

Tags exist to improve search, grouping, and discovery.

### Memory relations

Memory relations exist to connect memories to other memories.
They do not store new knowledge; they store relationship structure.

Examples:

- a pattern can point to a decision
- a note can point to documentation
- a warning can point to an anti-pattern

This remains valuable and should not be removed.

---

## 3.7 Settings

Settings also stay.

They are not reusable knowledge and not cockpit content.
They are internal/system configuration for Minni itself.

Examples of the kind of thing settings cover:

- defaults
- behavior toggles
- internal plugin/runtime options

---

## 4. Database model — high-level

Below is the intended database shape after the pivot.
This is conceptual, not the final Drizzle schema.

---

## `dev_modes`

Stores engineering working modes.

```ts
dev_modes {
  id: integer pk
  name: text not null unique
  description: text null
  permission: 'open' | 'guarded' | 'read_only' | 'locked'
  created_at: timestamp
  updated_at: timestamp
}
```

### Field meanings

- `id` → unique identifier
- `name` → visible name of the mode
- `description` → concise explanation of the mode
- `permission` → protection level for LLM modifications
- `created_at` → creation timestamp
- `updated_at` → last modification timestamp

---

## `projects`

Stores concrete projects.

```ts
projects {
  id: integer pk
  name: text not null unique
  description: text null
  stack: text null
  permission: 'open' | 'guarded' | 'read_only' | 'locked'
  created_at: timestamp
  updated_at: timestamp
}
```

### Field meanings

- `id` → unique identifier
- `name` → visible/normalized project name
- `description` → short project summary
- `stack` → main technologies
- `permission` → protection level for LLM modifications
- timestamps → normal audit fields

---

## `memories`

Stores reusable autonomous knowledge.

```ts
memories {
  id: integer pk
  type: 'skill' | 'pattern' | 'anti_pattern' | 'decision' | 'insight' | 'comparison' | 'note' | 'link' | 'article' | 'video' | 'documentation' | 'identity' | 'context'
  title: text not null
  content: text not null
  status: 'draft' | 'experimental' | 'proven' | 'battle_tested' | 'deprecated'
  permission: 'open' | 'guarded' | 'read_only' | 'locked'
  created_at: timestamp
  updated_at: timestamp
}
```

### Important note

`project_id` is removed from `memories`.
Memories are autonomous and associations move to pivot tables.

---

## `project_memories`

Associates memories with projects.

```ts
project_memories {
  project_id: fk -> projects.id
  memory_id: fk -> memories.id
  sort_order: integer default 0

  pk(project_id, memory_id)
}
```

### Meaning

A memory can be linked to one or more projects without losing autonomy.

---

## `dev_mode_memories`

Associates memories with dev modes.

```ts
dev_mode_memories {
  dev_mode_id: fk -> dev_modes.id
  memory_id: fk -> memories.id
  sort_order: integer default 0

  pk(dev_mode_id, memory_id)
}
```

### Meaning

A Dev Mode can carry a set of reusable memories that fit that posture.

---

## `commands`

Stores project commands.

```ts
commands {
  id: integer pk
  project_id: fk -> projects.id not null
  key: text not null
  command: text not null
  summary: text null
  group: 'run' | 'quality' | 'build' | 'test' | 'db' | 'infra' | 'worker' | 'setup' | 'misc'
  risk: 'safe' | 'mutating' | 'destructive'
  visibility: 'primary' | 'secondary' | 'hidden'
  permission: 'open' | 'guarded' | 'read_only' | 'locked'
  notes: text null
  sort_order: integer default 0
  created_at: timestamp
  updated_at: timestamp

  unique(project_id, key)
}
```

### Important note

`status` is intentionally not included unless a real functional need is identified.
The previous tendency to add generic lifecycle fields everywhere was part of the older flattening problem.

If command lifecycle truly matters later, it can be added with a concrete semantic purpose.

---

## `rules`

Single table for principles, conventions, and gotchas.

```ts
rules {
  id: integer pk
  scope_type: 'dev_mode' | 'project'
  scope_id: integer not null
  kind: 'principle' | 'convention' | 'gotcha'
  statement: text not null
  rationale: text null
  severity: 'critical' | 'strong' | 'default'
  permission: 'open' | 'guarded' | 'read_only' | 'locked'
  example: text null
  sort_order: integer default 0
  created_at: timestamp
  updated_at: timestamp
}
```

### Meaning of fields

- `scope_type` → whether it belongs to a Dev Mode or Project
- `scope_id` → which Dev Mode/Project it belongs to
- `kind` → principle vs convention vs gotcha
- `statement` → short direct rule text
- `rationale` → why it exists
- `severity` → importance level
- `permission` → protection level
- `example` → optional supporting example
- `sort_order` → manual display order

---

## `canvas`

Persistent live pages.

```ts
canvas {
  id: text pk
  content: text not null
  type: 'markdown' | 'html'
  created_at: timestamp
}
```

### Important note

Canvas remains intentionally simple.
It is not being redesigned into a structured contextual entity.

Canvas pages do **not** use permissions.

---

## `tags`

Reusable memory tags.

```ts
tags {
  id: integer pk
  name: text not null unique
}
```

---

## `memory_tags`

Tag pivot.

```ts
memory_tags {
  memory_id: fk -> memories.id
  tag_id: fk -> tags.id

  pk(memory_id, tag_id)
}
```

---

## `memory_relations`

Memory-to-memory associations.

```ts
memory_relations {
  memory_id: fk -> memories.id
  related_id: fk -> memories.id

  pk(memory_id, related_id)
}
```

---

## `settings`

Internal system settings.

```ts
settings {
  key: text pk
  value: text not null
}
```

---

## `active_state` (working name)

Stores active selections.

```ts
active_state {
  id: integer pk default 1
  active_project_id: fk -> projects.id null
  active_dev_mode_id: fk -> dev_modes.id null
  created_at: timestamp
  updated_at: timestamp
}
```

### Note

The final technical name is still open. It may remain `global_context` for migration convenience or be renamed.
But conceptually, it is an **active selection table**, not semantic “global context”.

---

## 5. Product/UI model

## 5.1 Cockpit

Cockpit is not a table.
It is the human-facing UI representation of the current active composition.

### Cockpit shows

- active Dev Mode
- active Project
- visible Canvas
- important memories
- commands
- principles/conventions/gotchas

### Cockpit is not

- “the project page only”
- “the dev mode page only”
- “a generic dashboard without state”

It is the view of the **current operative composition**.

---

## 5.2 HUD / sidebar state

The existing lower sidebar area remains important.

It should show at least:

- active Project
- active Dev Mode
- counts of important entities

This is no longer decoration. It is the visible expression of current system routing state.

---

## 5.3 Permissions in UI

Every entity that supports permissions should show them compactly and be editable inline.

### Design intent

- small icon/dropdown control
- visible enough to prevent mistakes
- compact enough to avoid visual noise

### Default behavior

All modifiable entities default to:

- `guarded`

---

## 5.4 Search

Search must become global.

### Searchable entities

- projects
- dev modes
- memories
- commands
- rules
- canvas

### Useful filters

- entity type
- permission
- memory type
- rule kind
- rule scope
- command group
- command risk

---

## 6. Tooling / routing implications

Minni tools must stop assuming one flattened active context.

Routing should resolve from persisted active selections.

### Minimum active routing inputs

- current Dev Mode
- current Project

### Tool examples that likely remain or evolve

- `minni_hud`
- `minni_memory`
- `minni_project`
- `minni_canvas`
- `minni_equip`
- likely new tools for Dev Mode / Command / Rule / Search

### Still-open questions

- exact tool contract for changing Dev Mode
- exact tool contract for changing Project
- what the return payload should be after a change
- how Canvas should contribute to extracts without becoming over-structured

---

## 7. Explicit removals

## Tasks are removed

This includes:

- task table
- task tool
- task routes
- task UI
- task HUD counts
- task assumptions in docs

Tasks did not serve the real workflow and only added maintenance burden.

---

## 8. Current open questions

These are the main gaps still worth discussing before implementation hardens:

1. final technical name of the active selection table
2. exact promote flows from Canvas beyond Memory
3. whether Commands truly need a functional lifecycle field later or not
4. whether Canvas eventually gains `updated_at`
5. exact shape of the first search experience

---

## 9. Summary

The current pivot can be summarized as:

- **Dev Mode** = how the engineer works
- **Project** = the concrete system
- **Canvas** = the live freeform surface
- **Memory** = autonomous reusable knowledge
- **Commands** = project operations
- **Rules** = principles, conventions, gotchas
- **Permissions** = protection against unsafe LLM modification
- **Active-state table** = persisted routing truth

That is the current source-of-truth direction for Minni.
