import { and, eq, inArray, sql } from "drizzle-orm";

import type { MinniDB } from "../../helpers";

import { devModeMemories, memories, projectMemories } from "../../schema";

/** Deduplicates memory IDs while preserving the caller-provided ordering. */
export function uniqueMemoryIds(ids: number[]) {
	return Array.from(new Set(ids));
}

/** Returns IDs that cannot be associated because they are missing or locked. */
export async function getUnavailableMemoryIds(db: MinniDB, ids: number[]) {
	if (ids.length === 0) return [];

	const available = await db
		.select({ id: memories.id })
		.from(memories)
		.where(and(inArray(memories.id, ids), sql`${memories.permission} != 'locked'`));
	const availableIds = new Set(available.map((memory) => memory.id));

	return ids.filter((id) => !availableIds.has(id));
}

/** Replaces all project-memory associations atomically within the caller's transaction. */
export async function replaceProjectMemoryAssociations(
	db: MinniDB,
	projectId: number,
	memoryIds: number[],
) {
	await db.delete(projectMemories).where(eq(projectMemories.projectId, projectId));

	if (memoryIds.length === 0) return;

	await db.insert(projectMemories).values(
		memoryIds.map((memoryId, sortOrder) => ({
			projectId,
			memoryId,
			sortOrder,
		})),
	);
}

/** Replaces all Dev Mode-memory associations atomically within the caller's transaction. */
export async function replaceDevModeMemoryAssociations(
	db: MinniDB,
	devModeId: number,
	memoryIds: number[],
) {
	await db.delete(devModeMemories).where(eq(devModeMemories.devModeId, devModeId));

	if (memoryIds.length === 0) return;

	await db.insert(devModeMemories).values(
		memoryIds.map((memoryId, sortOrder) => ({
			devModeId,
			memoryId,
			sortOrder,
		})),
	);
}
