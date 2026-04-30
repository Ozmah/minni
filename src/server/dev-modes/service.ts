import { and, asc, eq } from "drizzle-orm";

import type { MinniDB } from "../../helpers";

import { activeState, devModeMemories, devModes, memories, rules } from "../../schema";
import { buildDevModeInjectionPreview } from "../context/formatters";

/** Loads the Dev Mode Composer payload, including principles, memory summaries, and preview text. */
export async function getEnrichedDevMode(db: MinniDB, id: number) {
	const [devMode] = await db.select().from(devModes).where(eq(devModes.id, id)).limit(1);
	if (!devMode) return null;

	const [principles, associatedMemories, active] = await Promise.all([
		db
			.select()
			.from(rules)
			.where(and(eq(rules.devModeId, id), eq(rules.kind, "principle")))
			.orderBy(asc(rules.sortOrder), asc(rules.id)),
		db
			.select({
				id: memories.id,
				title: memories.title,
				type: memories.type,
				status: memories.status,
				permission: memories.permission,
				sortOrder: devModeMemories.sortOrder,
			})
			.from(devModeMemories)
			.innerJoin(memories, eq(memories.id, devModeMemories.memoryId))
			.where(eq(devModeMemories.devModeId, id))
			.orderBy(asc(devModeMemories.sortOrder), asc(memories.title)),
		db.select().from(activeState).where(eq(activeState.id, 1)).limit(1),
	]);

	return {
		devMode,
		principles,
		memories: associatedMemories,
		isActive: active[0]?.activeDevModeId === id,
		summary: {
			principleCount: principles.length,
			memoryCount: associatedMemories.length,
		},
		injectionPreview: buildDevModeInjectionPreview({
			devMode,
			principles,
			memoryCount: associatedMemories.length,
		}),
	};
}
