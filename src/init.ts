import { sql } from "drizzle-orm";

import type { MinniDB } from "./helpers";

/**
 * Creates all 7 Minni tables if they don't already exist.
 * Uses raw SQL because Drizzle's schema API does not support
 * CREATE TABLE IF NOT EXISTS declaratively.
 *
 * Also ensures the singleton global_context row exists (id=1).
 * Creates performance indexes for common query patterns.
 *
 * Safe to call on every startup — existing tables and rows are untouched.
 */
export async function initializeDatabase(db: MinniDB): Promise<void> {
	// projects first — global_context references it
	await db.run(sql`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      stack TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      permission TEXT NOT NULL DEFAULT 'guarded',
      default_memory_permission TEXT NOT NULL DEFAULT 'guarded',
      context_summary TEXT,
      context_updated_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    )
  `);

	await db.run(sql`
    CREATE TABLE IF NOT EXISTS global_context (
      id INTEGER PRIMARY KEY DEFAULT 1,
      active_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      identity TEXT,
      preferences TEXT,
      context_summary TEXT,
      context_updated_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    )
  `);

	await db.run(sql`
    INSERT OR IGNORE INTO global_context (id) VALUES (1)
  `);

	await db.run(sql`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      path TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      permission TEXT NOT NULL DEFAULT 'guarded',
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    )
  `);

	await db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    )
  `);

	// Migration: add parent_id column if missing (existing DBs)
	await db
		.run(sql`
    ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE
  `)
		.catch(() => {
			// Column already exists, ignore
		});

	// Migration: drop legacy columns if they exist
	// SQLite doesn't support DROP COLUMN in older versions, so we just ignore them
	// The Drizzle schema won't use goal_id/milestone_id anymore

	// Migration: drop legacy tables (goals, milestones)
	await db.run(sql`DROP TABLE IF EXISTS milestones`);
	await db.run(sql`DROP TABLE IF EXISTS goals`);

	await db.run(sql`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

	await db.run(sql`
    CREATE TABLE IF NOT EXISTS memory_tags (
      memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (memory_id, tag_id)
    )
  `);

	await db.run(sql`
    CREATE TABLE IF NOT EXISTS memory_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      segment TEXT NOT NULL
    )
  `);

	// Performance indexes
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memory_paths_segment ON memory_paths(segment)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memory_paths_memory ON memory_paths(memory_id)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memory_tags_memory ON memory_tags(memory_id)`);
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag_id)`);

	// ============================================================================
	// CORE SKILLS — Opinionated defaults for project descriptions
	// Two skills: Technical (software/hardware) and Human (everything else)
	// ============================================================================

	const SKILL_TECHNICAL = `# Technical Project Descriptions

For software, hardware, and technology projects.

## Core Rules

1. **No title.** First line = short description (card preview uses truncation)
2. **English** unless user specifies otherwise

## First Line Format

\`[What it is/does]. Role: [ROLE] — [boundary explanation]\`

Examples:
- "Plugin for OpenCode providing LLM memory. Role: META — you develop code you execute."
- "CLI tool for database migrations. Role: EXECUTOR — you run migrations directly."
- "Internal API client library. Role: USER — you consume this to call external services."

## Agent Roles

| Role | Meaning | When |
|------|---------|------|
| **Executor** | Agent does the work | Scripts, automation, CLI tools |
| **User** | Agent uses as tool | Libraries, APIs, plugins consumed |
| **Meta** | Agent develops what it runs | Self-hosted, plugins for own env |

## Document Structure

First line - What it is + role (no heading)

Then sections:
- **Stack:** Technologies, frameworks, runtime
- **Locations:** Dev path, runtime/deploy path
- **Workflow:** Build, sync, deploy commands

Followed by numbered sections:
- **1. Data Model** — Entities and relationships
- **2-N. Patterns** — Project-specific conventions
- **N+1. Reference** — Tools, commands, APIs
- **N+2. Dependencies** — Where deps go, runtime context

## Required Sections

| Section | Purpose |
|---------|---------|
| First line | \`[description]. Role: [ROLE] — [context]\` |
| Stack | Technologies used |
| Locations | Dev and runtime paths |
| Workflow | Commands to build/deploy |

## Writing Guidelines

1. **Be terse** — Bullets and code, no prose
2. **Show, don't explain** — Code examples over descriptions
3. **Mark critical** — Use **CRITICAL** or **Rule:** prefixes
4. **Include gotchas** — "Without X, Y won't work"
5. **Number sections** — After header, number all sections

## Anti-patterns

| Bad | Why | Good |
|-----|-----|------|
| \`# Project Name\` | Breaks card preview | Start with description |
| "This is a project..." | Wastes tokens | "Plugin for X that Y" |
| Missing role | Agent doesn't know boundaries | Include role in first line |
| Prose paragraphs | Hard to scan | Bullets, tables, code |
| Missing workflow | Agent can't build/test | Always include commands |`;

	const SKILL_HUMAN = `# Human Project Descriptions

For everything non-technical: recipes, hobbies, collections, personal organization, learning, creative projects.

## Core Rules

1. **No title.** First line = short description (card preview uses truncation)
2. **English** unless user specifies otherwise
3. **Agent guides, human executes** — Physical actions require human hands

## First Line Format

\`[What it is/does]. Role: ADVISOR — [boundary explanation]\`

Examples:
- "Family recipes from three generations. Role: ADVISOR — you guide step-by-step, human cooks."
- "Personal finance tracking system. Role: ADVISOR — you analyze and guide, human decides."
- "Guitar learning journey. Role: ADVISOR — you structure practice, human plays."

## Agent Role

| Role | Meaning | When |
|------|---------|------|
| **Advisor** | Agent guides step-by-step, human executes physically | Always for non-technical projects |

## Document Structure

First line - What it is + role (no heading)

Then sections:
- **Domain:** Knowledge area, scope, context
- **Conventions:** Rules, standards, preferences

Followed by numbered sections:
- **1. Core Structure** — Main entity/concept breakdown
- **2-N. Guidelines** — Project-specific patterns
- **N+1. Resources** — References, sources, tools

## Required Sections

| Section | Purpose |
|---------|---------|
| First line | \`[description]. Role: ADVISOR — [context]\` |
| Domain | Knowledge area and scope |
| Conventions | Rules and preferences |

## Writing Guidelines

1. **Be specific** — "until golden brown" not "cook until done"
2. **Include context** — Origin, why it matters, who taught it
3. **Note variations** — Regional differences, substitutions
4. **Visual cues** — What to look/smell/feel for
5. **Number sections** — After header, number all sections

## Anti-patterns

| Bad | Why | Good |
|-----|-----|------|
| \`# Project Name\` | Breaks card preview | Start with description |
| "This is my collection of..." | Wastes tokens | "Family recipes from..." |
| Missing domain | No context for guidance | Specify area and scope |
| Vague instructions | Can't guide properly | Step-by-step with cues |
| Tech jargon | Wrong skill | Use Technical skill instead |`;

	const now = Date.now();

	// Insert Technical Project Descriptions skill
	await db.run(sql`
		INSERT INTO memories (type, title, content, path, status, permission, created_at, updated_at)
		SELECT 'skill', 'Technical Project Descriptions', ${SKILL_TECHNICAL}, 'Minni -> Projects -> Description', 'proven', 'read_only', ${now}, ${now}
		WHERE NOT EXISTS (
			SELECT 1 FROM memories WHERE title = 'Technical Project Descriptions' AND type = 'skill'
		)
	`);

	// Insert Human Project Descriptions skill
	await db.run(sql`
		INSERT INTO memories (type, title, content, path, status, permission, created_at, updated_at)
		SELECT 'skill', 'Human Project Descriptions', ${SKILL_HUMAN}, 'Minni -> Projects -> Description', 'proven', 'read_only', ${now}, ${now}
		WHERE NOT EXISTS (
			SELECT 1 FROM memories WHERE title = 'Human Project Descriptions' AND type = 'skill'
		)
	`);

	// Insert core tags if they don't exist
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('system')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('core')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('minni')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('projects')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('description')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('technical')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('human')`);

	// Link tags to Technical skill
	await db.run(sql`
		INSERT OR IGNORE INTO memory_tags (memory_id, tag_id)
		SELECT m.id, t.id FROM memories m, tags t
		WHERE m.title = 'Technical Project Descriptions' AND m.type = 'skill'
		AND t.name IN ('system', 'core', 'minni', 'projects', 'description', 'technical')
	`);

	// Link tags to Human skill
	await db.run(sql`
		INSERT OR IGNORE INTO memory_tags (memory_id, tag_id)
		SELECT m.id, t.id FROM memories m, tags t
		WHERE m.title = 'Human Project Descriptions' AND m.type = 'skill'
		AND t.name IN ('system', 'core', 'minni', 'projects', 'description', 'human')
	`);

	// Insert path segments for Technical skill
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 0, 'minni' FROM memories m
		WHERE m.title = 'Technical Project Descriptions' AND m.type = 'skill'
		AND NOT EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id)
	`);
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 1, 'projects' FROM memories m
		WHERE m.title = 'Technical Project Descriptions' AND m.type = 'skill'
		AND EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 0)
		AND NOT EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 1)
	`);
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 2, 'description' FROM memories m
		WHERE m.title = 'Technical Project Descriptions' AND m.type = 'skill'
		AND EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 1)
		AND NOT EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 2)
	`);

	// Insert path segments for Human skill
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 0, 'minni' FROM memories m
		WHERE m.title = 'Human Project Descriptions' AND m.type = 'skill'
		AND NOT EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id)
	`);
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 1, 'projects' FROM memories m
		WHERE m.title = 'Human Project Descriptions' AND m.type = 'skill'
		AND EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 0)
		AND NOT EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 1)
	`);
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 2, 'description' FROM memories m
		WHERE m.title = 'Human Project Descriptions' AND m.type = 'skill'
		AND EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 1)
		AND NOT EXISTS (SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 2)
	`);
}
