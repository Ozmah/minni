import { Result } from "better-result";
import { sql, eq, ne, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";

import {
	projects,
	tags,
	memoryTags,
	globalContext,
	memories,
	settings,
	type Permission,
	type Memory,
} from "./schema";

export type MinniDB = ReturnType<typeof drizzle>;

export type ActiveProject = { id: number; name: string } | null;

/** Validates a value against an allowed set. Returns the value if valid, or an error string. */
export function validateEnum(
	value: string,
	allowed: readonly string[],
	fieldName: string,
): string | null {
	if (allowed.includes(value)) return null;
	return `Invalid ${fieldName}: "${value}". Allowed: ${allowed.join(", ")}`;
}

/**
 * Normalizes a project name for storage and lookup.
 * Lowercases, trims, replaces spaces/underscores with hyphens,
 * strips anything that isn't alphanumeric or hyphen, and collapses
 * consecutive hyphens.
 */
export function normalizeProjectName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Returns the currently loaded project, or null if none is active (global mode).
 */
export async function getActiveProject(db: MinniDB): Promise<ActiveProject> {
	const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);

	if (!ctx[0]?.activeProjectId) {
		return null;
	}

	const proj = await db
		.select()
		.from(projects)
		.where(eq(projects.id, ctx[0].activeProjectId))
		.limit(1);

	return proj[0] ? { id: proj[0].id, name: proj[0].name } : null;
}

/**
 * Sets the active project and persists to global_context.
 * Pass null to switch to global mode (no active project).
 */
export async function setActiveProject(db: MinniDB, project: ActiveProject): Promise<void> {
	await db
		.update(globalContext)
		.set({
			activeProjectId: project?.id ?? null,
			updatedAt: new Date(),
		})
		.where(eq(globalContext.id, 1));
}

/**
 * Resolves a project by name, falling back to the active project.
 * Returns null if no project is found and no active project is set.
 */
export async function resolveProject(db: MinniDB, name?: string): Promise<ActiveProject> {
	if (name) {
		const normalized = normalizeProjectName(name);
		const found = await db.select().from(projects).where(eq(projects.name, normalized)).limit(1);
		return found[0] ? { id: found[0].id, name: found[0].name } : null;
	}
	return getActiveProject(db);
}

/**
 * Persists tag associations for a memory.
 * Tags are normalized, inserted if new (via INSERT OR IGNORE),
 * and linked through the memory_tags join table.
 */
export async function saveTags(db: MinniDB, memoryId: number, tagNames: string[]): Promise<void> {
	for (const name of tagNames) {
		const normalized = name.toLowerCase().trim();
		// TODO need to investigate if this is possible using drizzle alone
		await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES (${normalized})`);
		const tag = await db.select().from(tags).where(eq(tags.name, normalized)).limit(1);
		if (tag[0]) {
			await db.insert(memoryTags).values({ memoryId, tagId: tag[0].id }).onConflictDoNothing();
		}
	}
}

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Reads a setting from the settings table.
 * Returns null if the key doesn't exist.
 */
export async function getSetting(db: MinniDB, key: string): Promise<string | null> {
	const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
	return row[0]?.value ?? null;
}

// ============================================================================
// IDENTITY
// ============================================================================

/**
 * Resolves the active identity memory.
 * Cascade: active_identity_id pointer → default_identity setting → null.
 */
export async function getActiveIdentity(db: MinniDB): Promise<Memory | null> {
	const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);

	let identityId = ctx[0]?.activeIdentityId ?? null;

	// Fallback to default_identity setting (stores identity title)
	if (!identityId) {
		const defaultName = await getSetting(db, "default_identity");
		if (defaultName && defaultName !== "null") {
			const mem = await db
				.select()
				.from(memories)
				.where(
					and(
						eq(memories.type, "identity"),
						eq(memories.title, defaultName),
						ne(memories.permission, "locked"),
					),
				)
				.limit(1);
			if (mem[0]) identityId = mem[0].id;
		}
	}

	if (!identityId) return null;

	const mem = await db.select().from(memories).where(eq(memories.id, identityId)).limit(1);
	return mem[0] ?? null;
}

// ============================================================================
// PERMISSION SYSTEM
// ============================================================================

/**
 * Entity protected by the permission system.
 * Only memories and projects have permissions; tasks are always open.
 */
export type ProtectedEntity = {
	id: number;
	name: string;
	type: "memory" | "project";
	permission: Permission;
};

export type ActionType = "read" | "update" | "delete";

/**
 * OpenCode tool context type (subset we need for permission checks).
 */
export type ToolContext = {
	ask: (opts: {
		permission: string;
		patterns: string[];
		always: string[];
		metadata: Record<string, unknown>;
	}) => Promise<void>;
};

/**
 * Centralized permission enforcement for all protected entities.
 *
 * Permission matrix:
 * ┌─────────────┬─────────┬─────────┬─────────┐
 * │ Permission  │  READ   │ UPDATE  │ DELETE  │
 * ├─────────────┼─────────┼─────────┼─────────┤
 * │ locked      │ BLOCK   │ BLOCK   │ BLOCK   │
 * │ read_only   │ ALLOW   │ BLOCK   │ BLOCK   │
 * │ guarded     │ ALLOW   │ ASK     │ ASK     │
 * │ open        │ ALLOW   │ ALLOW   │ ALLOW   │
 * └─────────────┴─────────┴─────────┴─────────┘
 *
 * If dangerously_skip_memory_permission is "true", bypasses ALL checks.
 */
export async function guardedAction<T>(
	db: MinniDB,
	context: ToolContext,
	entity: ProtectedEntity,
	action: ActionType,
	executor: () => Promise<T>,
) {
	const execWithError = () =>
		Result.tryPromise({
			try: () => executor(),
			catch: (e) =>
				`ERROR: Failed to ${action} ${entity.type} [${entity.id}]: ${e instanceof Error ? e.message : String(e)}`,
		});

	// Nuclear bypass: skip ALL permission checks
	const skipAll = await getSetting(db, "dangerously_skip_memory_permission");
	if (skipAll === "true") return execWithError();

	const { permission, id, name, type } = entity;

	if (permission === "locked") {
		return Result.err(`BLOCKED: ${type} [${id}] is locked. Use Minni to view its content.`);
	}

	if (permission === "read_only" && action !== "read") {
		return Result.err(
			`BLOCKED: ${type} [${id}] "${name}" is read-only. Use Minni to view its content.`,
		);
	}

	if (permission === "guarded" && action !== "read") {
		const confirmed = await Result.tryPromise({
			try: () =>
				context.ask({
					permission: `minni_${action}`,
					patterns: [`[${id}] ${name}`],
					always: [],
					metadata: { entityType: type, entityId: id },
				}),
			catch: () => `CANCELLED: User denied ${action} on ${type} [${id}] "${name}".`,
		});
		if (confirmed.isErr()) return Result.err(confirmed.error);
	}

	return execWithError();
}
