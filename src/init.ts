import { Result } from "better-result";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/tursodatabase/migrator";
import { join } from "node:path";

import type { MinniDB } from "./helpers";

// ============================================================================
// CORE SKILLS: Opinionated defaults for project descriptions
// Two skills: Technical (software/hardware) and Human (everything else)
// ============================================================================

// NOTE: these are NOT the correct skills yet, first I want
// to bake in the new context equip then I'll create the
// multi-step skills
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

// ============================================================================
// DATABASE INITIALIZATION
//
// Uses drizzle-kit migrations for DDL (tables, indexes).
// Seeds and legacy migration run after as idempotent runtime logic.
// ============================================================================

export async function initializeDatabase(db: MinniDB): Promise<void> {
	const migrationsPath = join(import.meta.dir, "..", "migrations");

	// Handle existing databases that predate drizzle migrations.
	// Check if __drizzle_migrations tracking table exists.
	const hasTracking = await Result.tryPromise(() =>
		db.all(sql`SELECT 1 FROM __drizzle_migrations LIMIT 1`),
	);

	if (hasTracking.isErr()) {
		// No tracking table — could be fresh DB or pre-drizzle DB.
		const hasExistingTables = await Result.tryPromise(() =>
			db.all(sql`SELECT 1 FROM projects LIMIT 1`),
		);

		if (hasExistingTables.isOk()) {
			// Pre-drizzle DB: tables exist but no migration tracking.
			// Drop old canvas (schema changed from single-row to multi-row).
			await db.run(sql`DROP TABLE IF EXISTS canvas`);

			// Create tracking table and mark baseline as applied (skip execution).
			const migrations = readMigrationFiles({ migrationsFolder: migrationsPath });
			const baseline = migrations[0];
			if (baseline) {
				await db.run(sql`
					CREATE TABLE IF NOT EXISTS __drizzle_migrations (
						id INTEGER PRIMARY KEY,
						hash TEXT NOT NULL,
						created_at NUMERIC
					)
				`);
				await db.run(
					sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${baseline.hash}, ${baseline.folderMillis})`,
				);
			}
		}
	}

	// Apply pending migrations (skips already-tracked ones).
	await migrate(db, { migrationsFolder: migrationsPath });

	// Safety net: canvas was dropped during pre-drizzle baseline but the migration
	// that recreates it was marked as already applied. Idempotent — no-ops on fresh DBs.
	await db.run(sql`CREATE TABLE IF NOT EXISTS canvas (
		id TEXT PRIMARY KEY,
		content TEXT NOT NULL,
		type TEXT DEFAULT 'markdown' NOT NULL,
		created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
	)`);
	await db.run(sql`ALTER TABLE canvas ADD COLUMN type TEXT DEFAULT 'markdown' NOT NULL`).catch(() => {});
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_canvas_created_at ON canvas (created_at)`);

	// Ensure global_context singleton row exists
	await db.run(sql`INSERT OR IGNORE INTO global_context (id) VALUES (1)`);

	// Legacy cleanup: drop deprecated tables
	await db.run(sql`DROP TABLE IF EXISTS memory_paths`);
	await db.run(sql`DROP TABLE IF EXISTS milestones`);
	await db.run(sql`DROP TABLE IF EXISTS goals`);

	// Legacy v1 data migration (idempotent, skips on fresh DBs)
	// This is just temporary will be removed and assumed a freshdatabase or simply populated
	await migrateFromV1(db);

	// Seeds
	await seedSettings(db);
	await seedSkills(db);
}

// ============================================================================
// LEGACY DATA MIGRATION
//
// Reads legacy columns via raw SQL (Drizzle schema no longer knows them).
// On fresh databases the SELECT fails → caught → skipped.
// All operations check for existing data before inserting.
// ============================================================================

async function migrateFromV1(db: MinniDB): Promise<void> {
	type LegacyGlobal = {
		identity: string | null;
		preferences: string | null;
		context_summary: string | null;
	};

	const legacyResult = await Result.tryPromise(() =>
		db.all<LegacyGlobal>(
			sql`SELECT identity, preferences, context_summary FROM global_context WHERE id = 1`,
		),
	);

	// Columns don't exist → fresh DB
	if (legacyResult.isErr()) return;

	const legacy = legacyResult.value[0] ?? null;
	if (!legacy) return;

	const now = Date.now();

	// Identity → memory + pointer
	if (legacy.identity) {
		const ctx = await db.all<{ active_identity_id: number | null }>(
			sql`SELECT active_identity_id FROM global_context WHERE id = 1`,
		);
		if (!ctx[0]?.active_identity_id) {
			const firstLine = legacy.identity.split("\n")[0].trim().substring(0, 100);
			const title = firstLine || "Default Identity";

			const result = await db.all<{ id: number }>(
				sql`INSERT INTO memories (type, title, content, status, permission, created_at, updated_at)
					VALUES ('identity', ${title}, ${legacy.identity}, 'proven', 'guarded', ${now}, ${now})
					RETURNING id`,
			);
			if (result[0]) {
				await db.run(
					sql`UPDATE global_context SET active_identity_id = ${result[0].id}, updated_at = ${now} WHERE id = 1`,
				);
			}
		}
	}

	// Preferences → settings
	if (legacy.preferences) {
		const parsed = Result.try(() => JSON.parse(legacy.preferences!) as Record<string, unknown>);
		if (parsed.isOk()) {
			const prefs = parsed.value;
			const mappings: [string, unknown][] = [
				[
					"default_memory_permission",
					(prefs?.memory as Record<string, unknown>)?.defaultPermission,
				],
				["auto_create_tasks", (prefs?.planning as Record<string, unknown>)?.autoCreateTasks],
				["search_default_limit", (prefs?.search as Record<string, unknown>)?.defaultLimit],
			];
			for (const [key, value] of mappings) {
				if (value != null) {
					await db.run(
						sql`INSERT OR REPLACE INTO settings (key, value) VALUES (${key}, ${String(value)})`,
					);
				}
			}
		}
	}

	// Global context_summary → context memory
	if (legacy.context_summary) {
		const existing = await db.all<{ id: number }>(
			sql`SELECT id FROM memories WHERE type = 'context' AND project_id IS NULL LIMIT 1`,
		);
		if (existing.length === 0) {
			await db.run(
				sql`INSERT INTO memories (type, title, content, status, permission, created_at, updated_at)
					VALUES ('context', 'Global Context', ${legacy.context_summary}, 'draft', 'open', ${now}, ${now})`,
			);
		}
	}

	// Project context_summaries → context memories

	type ProjectSummary = { id: number; name: string; context_summary: string };
	const projResult = await Result.tryPromise(() =>
		db.all<ProjectSummary>(
			sql`SELECT id, name, context_summary FROM projects WHERE context_summary IS NOT NULL`,
		),
	);
	if (projResult.isOk()) {
		for (const proj of projResult.value) {
			const existing = await db.all<{ id: number }>(
				sql`SELECT id FROM memories WHERE type = 'context' AND project_id = ${proj.id} LIMIT 1`,
			);
			if (existing.length === 0) {
				await db.run(
					sql`INSERT INTO memories (project_id, type, title, content, status, permission, created_at, updated_at)
						VALUES (${proj.id}, 'context', ${`${proj.name} Context`}, ${proj.context_summary}, 'draft', 'open', ${now}, ${now})`,
				);
			}
		}
	}
}

// ============================================================================
// SEED: SETTINGS
// INSERT OR IGNORE ensures migrated values from v1 preferences are preserved.
// ============================================================================

async function seedSettings(db: MinniDB): Promise<void> {
	const defaults: [string, string][] = [
		["default_identity", "null"],
		["force_identity_on_hud", "false"],
		["ask_before_identity_injection", "true"],
		["default_memory_permission", "guarded"],
		["auto_create_tasks", "false"],
		["search_default_limit", "20"],
		["activate_identity_on_save", "false"],
		["dangerously_skip_memory_permission", "false"],
	];

	for (const [key, value] of defaults) {
		await db.run(sql`INSERT OR IGNORE INTO settings (key, value) VALUES (${key}, ${value})`);
	}
}

// ============================================================================
// SEED: SKILLS + TAGS
// ============================================================================

async function seedSkills(db: MinniDB): Promise<void> {
	const now = Date.now();

	await db.run(sql`
		INSERT INTO memories (type, title, content, status, permission, created_at, updated_at)
		SELECT 'skill', 'Technical Project Descriptions', ${SKILL_TECHNICAL}, 'proven', 'read_only', ${now}, ${now}
		WHERE NOT EXISTS (
			SELECT 1 FROM memories WHERE title = 'Technical Project Descriptions' AND type = 'skill'
		)
	`);

	await db.run(sql`
		INSERT INTO memories (type, title, content, status, permission, created_at, updated_at)
		SELECT 'skill', 'Human Project Descriptions', ${SKILL_HUMAN}, 'proven', 'read_only', ${now}, ${now}
		WHERE NOT EXISTS (
			SELECT 1 FROM memories WHERE title = 'Human Project Descriptions' AND type = 'skill'
		)
	`);

	// Core tags
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('system')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('core')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('minni')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('projects')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('description')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('technical')`);
	await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES ('human')`);

	// Link tags to skills
	await db.run(sql`
		INSERT OR IGNORE INTO memory_tags (memory_id, tag_id)
		SELECT m.id, t.id FROM memories m, tags t
		WHERE m.title = 'Technical Project Descriptions' AND m.type = 'skill'
		AND t.name IN ('system', 'core', 'minni', 'projects', 'description', 'technical')
	`);

	await db.run(sql`
		INSERT OR IGNORE INTO memory_tags (memory_id, tag_id)
		SELECT m.id, t.id FROM memories m, tags t
		WHERE m.title = 'Human Project Descriptions' AND m.type = 'skill'
		AND t.name IN ('system', 'core', 'minni', 'projects', 'description', 'human')
	`);
}
