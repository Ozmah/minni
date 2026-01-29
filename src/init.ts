import { sql } from "drizzle-orm";
import type { MinniDB } from "./helpers";

/**
 * Creates all 9 Minni tables if they don't already exist.
 * Uses raw SQL because Drizzle's schema API does not support
 * CREATE TABLE IF NOT EXISTS declaratively.
 *
 * Also ensures the singleton global_context row exists (id=1).
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
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    )
  `);

	await db.run(sql`
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    )
  `);

	await db.run(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
      milestone_id INTEGER REFERENCES milestones(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'todo',
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    )
  `);

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
}
