import { sql, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";

import { projects, tags, memoryTags, memoryPaths, globalContext } from "./schema";

export type MinniDB = ReturnType<typeof drizzle>;

export type ActiveProject = { id: number; name: string } | null;

export const MEMORY_TYPES = [
	"skill",
	"pattern",
	"anti_pattern",
	"decision",
	"insight",
	"comparison",
	"note",
	"link",
	"article",
	"video",
	"documentation",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_STATUSES = [
	"draft",
	"experimental",
	"proven",
	"battle_tested",
	"deprecated",
] as const;

export const MEMORY_PERMISSIONS = ["open", "guarded", "read_only", "locked"] as const;

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived", "deleted"] as const;

export const TASK_PRIORITIES = ["high", "medium", "low"] as const;

export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;

export const GOAL_STATUSES = ["active", "completed", "paused", "cancelled"] as const;

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
 *
 * @example
 * normalizeProjectName("Death Star Plans")  // "death-star-plans"
 * normalizeProjectName("Hal 9000")          // "hal-9000"
 * normalizeProjectName("  café  tracker ")  // "caf-tracker"
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

let activeProject: ActiveProject = null;

/** Returns the currently loaded project, or null if none is active (global mode). */
export function getActiveProject(): ActiveProject {
	return activeProject;
}

/**
 * Loads the active project from global_context on plugin startup.
 * This is the ENTRY POINT — must be called once when the plugin initializes.
 */
export async function loadActiveProject(db: MinniDB): Promise<void> {
	const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);
	if (!ctx[0]?.activeProjectId) {
		activeProject = null;
		return;
	}
	const proj = await db
		.select()
		.from(projects)
		.where(eq(projects.id, ctx[0].activeProjectId))
		.limit(1);
	activeProject = proj[0] ? { id: proj[0].id, name: proj[0].name } : null;
}

/**
 * Sets the active project and persists to global_context.
 * Pass null to switch to global mode (no active project).
 */
export async function setActiveProject(db: MinniDB, project: ActiveProject): Promise<void> {
	activeProject = project;
	await db
		.update(globalContext)
		.set({
			activeProjectId: project?.id ?? null,
			updatedAt: new Date(),
		})
		.where(eq(globalContext.id, 1));
}

/** Splits a display path ("Config -> Better Auth -> React") into trimmed segments. */
export function parsePath(path: string): string[] {
	return path.split("->").map((s) => s.trim());
}

/** Normalizes a path segment for indexed storage (lowercase + trim). */
export function normalizeSegment(segment: string): string {
	return segment.toLowerCase().trim();
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
	return activeProject;
}

/**
 * Persists tag associations for a memory.
 * Tags are normalized, inserted if new (via INSERT OR IGNORE),
 * and linked through the memory_tags join table.
 */
export async function saveTags(db: MinniDB, memoryId: number, tagNames: string[]): Promise<void> {
	for (const name of tagNames) {
		const normalized = name.toLowerCase().trim();
		await db.run(sql`INSERT OR IGNORE INTO tags (name) VALUES (${normalized})`);
		const tag = await db.select().from(tags).where(eq(tags.name, normalized)).limit(1);
		if (tag[0]) {
			await db.insert(memoryTags).values({ memoryId, tagId: tag[0].id }).onConflictDoNothing();
		}
	}
}

/**
 * Indexes path segments for a memory.
 * Each segment is normalized and stored with its positional index
 * for efficient querying via minni_find.
 */
export async function savePathSegments(db: MinniDB, memoryId: number, path: string): Promise<void> {
	const segments = parsePath(path);
	for (let i = 0; i < segments.length; i++) {
		await db.insert(memoryPaths).values({
			memoryId,
			position: i,
			segment: normalizeSegment(segments[i]),
		});
	}
}

// ============================================================================
// PERMISSION SYSTEM
// ============================================================================

/**
 * Entity protected by the permission system.
 * Only memories and projects have permissions; planning entities (goals,
 * milestones, tasks) are always open.
 */
export type ProtectedEntity = {
	id: number;
	name: string;
	type: "memory" | "project";
	permission: string;
};

export type ActionType = "read" | "update" | "delete";

/**
 * Result of a guarded action. Discriminated union for type-safe handling.
 */
export type GuardedResult<T> = { ok: true; result: T } | { ok: false; error: string };

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
 * @param context - OpenCode tool context (provides context.ask for confirmations)
 * @param entity - The entity being accessed
 * @param action - What we're trying to do
 * @param executor - Function that performs the actual operation
 * @returns GuardedResult with either the result or an error message
 *
 * @example
 * const result = await guardedAction(
 *   context,
 *   { id: mem.id, name: mem.title, type: "memory", permission: mem.permission },
 *   "update",
 *   async () => {
 *     await db.update(memories).set({ title: "New" }).where(eq(memories.id, mem.id));
 *     return `Updated: ${mem.title}`;
 *   }
 * );
 * if (!result.ok) return result.error;
 * return result.result;
 */
export async function guardedAction<T>(
	context: ToolContext,
	entity: ProtectedEntity,
	action: ActionType,
	executor: () => Promise<T>,
): Promise<GuardedResult<T>> {
	const { permission, id, name, type } = entity;

	// Locked: completely invisible, block everything
	if (permission === "locked") {
		return {
			ok: false,
			error: `BLOCKED: ${type} [${id}] is locked. Use Minni Studio.`,
		};
	}

	// Read-only: block writes
	if (permission === "read_only" && action !== "read") {
		return {
			ok: false,
			error: `BLOCKED: ${type} [${id}] "${name}" is read-only. Use Minni Studio.`,
		};
	}

	// Guarded: ask user for confirmation on writes
	if (permission === "guarded" && action !== "read") {
		try {
			await context.ask({
				permission: `minni_${action}`,
				patterns: [`[${id}] ${name}`],
				always: [],
				metadata: { entityType: type, entityId: id },
			});
		} catch {
			// User rejected the permission request
			return {
				ok: false,
				error: `CANCELLED: User denied ${action} on ${type} [${id}] "${name}".`,
			};
		}
	}

	// Open or confirmed: execute
	try {
		const result = await executor();
		return { ok: true, result };
	} catch (err) {
		return {
			ok: false,
			error: `ERROR: Failed to ${action} ${type} [${id}]: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}
