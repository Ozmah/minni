/**
 * Polling-based change detection for viewer invalidation.
 *
 * In-memory timestamps per entity type. Routes and tools call markChanged()
 * after mutations; the viewer polls GET /api/changes to detect what's stale.
 */

export type EntityType = "canvas" | "memory" | "task" | "project";

const timestamps: Record<EntityType, number> = {
	canvas: Date.now(),
	memory: Date.now(),
	task: Date.now(),
	project: Date.now(),
};

/** Mark an entity type as changed. Call after any mutation. */
export function markChanged(type: EntityType): void {
	timestamps[type] = Date.now();
}

/** Returns a snapshot of all entity timestamps. */
export function getChanges(): Record<EntityType, number> {
	return { ...timestamps };
}
