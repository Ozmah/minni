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
	// CORE SKILLS — Opinionated defaults, created on first run
	// ============================================================================

	const SKILL_PROJECT_DESCRIPTION = `A good project description answers:

1. **What it is** — One line
2. **Agent role** — Executor | User | Advisor | Meta
3. **Context relationship** — Does it affect available tools? Is it code I run?
4. **Stack/domain** — Technologies or work area
5. **How to work** — Conventions, constraints, preferences

Write descriptions in English unless the user specifies otherwise.

## Agent Roles

- **Executor** — Agent does the work (develops, creates, modifies)
- **User** — Agent uses the project as a tool
- **Meta** — Agent develops something it uses itself
- **Advisor** — Agent only guides the human, no direct agency

## Example: Minni (role: meta)

"OpenCode plugin providing the minni_* tools in your prompt.
Role: META — you develop the code you execute.
Stack: TypeScript/Bun/Drizzle/Turso.
Changes here affect your own functionality."

## Example: Recipe Book (role: advisor)

"Family recipe collection.
Role: ADVISOR — you guide the human, you don't cook. Yet.
Domain: Mexican home cooking."

## Anti-patterns

- "Minni is a memory project" ← Doesn't connect to agent context
- "My cooking app" ← No role, no stack, no guidance`;

	const now = Date.now();

	// Insert core skill if it doesn't exist
	await db.run(sql`
		INSERT INTO memories (type, title, content, path, status, permission, created_at, updated_at)
		SELECT 'skill', 'How to write effective project descriptions', ${SKILL_PROJECT_DESCRIPTION}, 'Minni -> Projects -> Description', 'battle_tested', 'read_only', ${now}, ${now}
		WHERE NOT EXISTS (
			SELECT 1 FROM memories WHERE title = 'How to write effective project descriptions' AND type = 'skill'
		)
	`);

	// Insert core tags if they don't exist
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('system')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('core')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('minni')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('projects')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('onboarding')`);

	// Link tags to the core skill (if skill exists and links don't)
	await db.run(sql`
		INSERT OR IGNORE INTO memory_tags (memory_id, tag_id)
		SELECT m.id, t.id FROM memories m, tags t
		WHERE m.title = 'How to write effective project descriptions' AND m.type = 'skill'
		AND t.name IN ('system', 'core', 'minni', 'projects', 'onboarding')
	`);

	// Insert path segments for the core skill
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 0, 'minni' FROM memories m
		WHERE m.title = 'How to write effective project descriptions' AND m.type = 'skill'
		AND NOT EXISTS (
			SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id
		)
	`);
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 1, 'projects' FROM memories m
		WHERE m.title = 'How to write effective project descriptions' AND m.type = 'skill'
		AND EXISTS (
			SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 0
		)
		AND NOT EXISTS (
			SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 1
		)
	`);
	await db.run(sql`
		INSERT INTO memory_paths (memory_id, position, segment)
		SELECT m.id, 2, 'description' FROM memories m
		WHERE m.title = 'How to write effective project descriptions' AND m.type = 'skill'
		AND EXISTS (
			SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 1
		)
		AND NOT EXISTS (
			SELECT 1 FROM memory_paths mp WHERE mp.memory_id = m.id AND mp.position = 2
		)
	`);
}
