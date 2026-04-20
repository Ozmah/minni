import { Result } from "better-result";
import { count, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";

import {
	activeState,
	commands,
	devModes,
	memories,
	memoryTags,
	projects,
	rules,
	settings,
	tags,
	type Permission,
} from "./schema";
import { getPageCount } from "./server/lib/canvas";

export type MinniDB = ReturnType<typeof drizzle>;

export type ActiveProject = { id: number; name: string } | null;
export type ActiveDevMode = { id: number; name: string } | null;

export function truncateWithWordBoundary(str: string, maxLength: number, ellipsis = "...") {
	if (str.length <= maxLength) return str;

	const ellipsisLength = ellipsis.length;
	const availableLength = maxLength - ellipsisLength;
	const truncated = str.slice(0, availableLength);
	const lastSpaceIndex = truncated.lastIndexOf(" ");
	const cutoffIndex = lastSpaceIndex > 0 ? lastSpaceIndex : availableLength;

	return `${truncated.slice(0, cutoffIndex)}${ellipsis}`;
}

export function validateEnum(
	value: string,
	allowed: readonly string[],
	fieldName: string,
): string | null {
	if (allowed.includes(value)) return null;
	return `Invalid ${fieldName}: "${value}". Allowed: ${allowed.join(", ")}`;
}

export function normalizeProjectName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export async function getActiveProject(db: MinniDB): Promise<ActiveProject> {
	const ctx = await db.select().from(activeState).where(eq(activeState.id, 1)).limit(1);

	if (!ctx[0]?.activeProjectId) return null;

	const proj = await db
		.select({ id: projects.id, name: projects.name })
		.from(projects)
		.where(eq(projects.id, ctx[0].activeProjectId))
		.limit(1);

	return proj[0] ?? null;
}

export async function setActiveProject(db: MinniDB, project: ActiveProject): Promise<void> {
	await db
		.update(activeState)
		.set({ activeProjectId: project?.id ?? null, updatedAt: new Date() })
		.where(eq(activeState.id, 1));
}

export async function getActiveDevMode(db: MinniDB): Promise<ActiveDevMode> {
	const ctx = await db.select().from(activeState).where(eq(activeState.id, 1)).limit(1);

	if (!ctx[0]?.activeDevModeId) return null;

	const mode = await db
		.select({ id: devModes.id, name: devModes.name })
		.from(devModes)
		.where(eq(devModes.id, ctx[0].activeDevModeId))
		.limit(1);

	return mode[0] ?? null;
}

export async function setActiveDevMode(db: MinniDB, devMode: ActiveDevMode): Promise<void> {
	await db
		.update(activeState)
		.set({ activeDevModeId: devMode?.id ?? null, updatedAt: new Date() })
		.where(eq(activeState.id, 1));
}

export async function resolveProject(db: MinniDB, name?: string): Promise<ActiveProject> {
	if (name) {
		const normalized = normalizeProjectName(name);
		const found = await db
			.select({ id: projects.id, name: projects.name })
			.from(projects)
			.where(eq(projects.name, normalized))
			.limit(1);
		return found[0] ?? null;
	}

	return getActiveProject(db);
}

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

export async function getSetting(db: MinniDB, key: string): Promise<string | null> {
	const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
	return row[0]?.value ?? null;
}

export interface HudData {
	project: { id: number; name: string } | null;
	devMode: { id: number; name: string } | null;
	counts: {
		projects: number;
		devModes: number;
		memories: number;
		commands: number;
		rules: number;
		canvas: number;
	};
}

export async function getHudData(db: MinniDB): Promise<HudData> {
	const [
		project,
		devMode,
		projectCount,
		devModeCount,
		memoryCount,
		commandCount,
		ruleCount,
		canvasPages,
	] = await Promise.all([
		getActiveProject(db),
		getActiveDevMode(db),
		db.select({ total: count() }).from(projects),
		db.select({ total: count() }).from(devModes),
		db.select({ total: count() }).from(memories),
		db.select({ total: count() }).from(commands),
		db.select({ total: count() }).from(rules),
		getPageCount(db),
	]);

	return {
		project,
		devMode,
		counts: {
			projects: projectCount[0].total,
			devModes: devModeCount[0].total,
			memories: memoryCount[0].total,
			commands: commandCount[0].total,
			rules: ruleCount[0].total,
			canvas: canvasPages,
		},
	};
}

export type ProtectedEntity = {
	id: number;
	name: string;
	type: "memory" | "project" | "dev_mode" | "command" | "rule";
	permission: Permission;
};

export type ActionType = "read" | "update" | "delete";

export type ToolContext = {
	ask: (opts: {
		permission: string;
		patterns: string[];
		always: string[];
		metadata: Record<string, unknown>;
	}) => Promise<void>;
};

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
