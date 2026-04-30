import { eq, inArray, or } from "drizzle-orm";

import {
	getActiveDevMode,
	getActiveProject,
	truncateWithWordBoundary,
	type MinniDB,
} from "../../helpers";
import {
	devModeMemories,
	devModes,
	MEMORY_STATUS,
	MEMORY_TYPE,
	memories,
	memoryRelations,
	memoryTags,
	PERMISSION,
	projectMemories,
	projects,
	tags,
	type MemoryStatus,
	type Permission,
} from "../../schema";
import {
	MEMORY_PLACEMENT,
	type EnrichedMemoryListQuery,
	type MemoryListSort,
	type MemoryPlacement,
	type MemoryStatusAction,
	type MemoryStatusActionError,
	type MemoryStatusActionSuccess,
} from "../memories/schemas";

export {
	MemoriesEnrichedListResponseSchema,
	MemoriesEnrichedQuerySchema,
	MemoryDetailResponseSchema,
	MemoryStatusActionBodySchema,
	MemoryStatusActionResponseSchema,
} from "../memories/schemas";

type BaseMemory = typeof memories.$inferSelect;

type AssociationRef = {
	id: number;
	name: string;
	sortOrder: number | null;
};

type EnrichedMemory = {
	base: BaseMemory;
	tags: string[];
	projects: AssociationRef[];
	devModes: AssociationRef[];
	relationCount: number;
	activeContext: {
		inActiveProject: boolean;
		inActiveDevMode: boolean;
	};
	placement: MemoryPlacement;
};

function parseCsvEnum<T extends string>(
	value: string | undefined,
	allowed: readonly T[],
	fieldName: string,
): T[] {
	if (!value) return [];

	const parsed = value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

	for (const item of parsed) {
		if (!allowed.includes(item as T)) {
			throw new Error(`Invalid ${fieldName}: "${item}"`);
		}
	}

	return parsed as T[];
}

function getPlacement(
	projectAssociations: AssociationRef[],
	devModeAssociations: AssociationRef[],
): MemoryPlacement {
	const hasProject = projectAssociations.length > 0;
	const hasDevMode = devModeAssociations.length > 0;

	if (hasProject && hasDevMode) return "shared";
	if (hasProject) return "project";
	if (hasDevMode) return "dev_mode";
	return "unaffiliated";
}

function buildExcerpt(content: string): string {
	return truncateWithWordBoundary(content.replace(/\s+/g, " ").trim(), 180);
}

/** Resolves allowed status transitions while enforcing locked/read-only memory invariants. */
export function getMemoryStatusActions(status: MemoryStatus, permission: Permission) {
	if (permission === "locked" || permission === "read_only") {
		return { canPromote: false, canDegrade: false, canDeprecate: false };
	}

	switch (status) {
		case "draft":
			return { canPromote: true, canDegrade: false, canDeprecate: true };
		case "experimental":
			return { canPromote: true, canDegrade: true, canDeprecate: true };
		case "proven":
			return { canPromote: true, canDegrade: true, canDeprecate: true };
		case "battle_tested":
			return { canPromote: false, canDegrade: true, canDeprecate: true };
		case "deprecated":
		default:
			return { canPromote: false, canDegrade: false, canDeprecate: false };
	}
}

function getNextMemoryStatus(
	currentStatus: MemoryStatus,
	action: MemoryStatusAction,
): MemoryStatus | null {
	if (action === "deprecate") {
		return currentStatus === "deprecated" ? null : "deprecated";
	}

	if (action === "promote") {
		switch (currentStatus) {
			case "draft":
				return "experimental";
			case "experimental":
				return "proven";
			case "proven":
				return "battle_tested";
			default:
				return null;
		}
	}

	if (action === "degrade") {
		switch (currentStatus) {
			case "battle_tested":
				return "proven";
			case "proven":
				return "experimental";
			case "experimental":
				return "draft";
			default:
				return null;
		}
	}

	return null;
}

function sortItems(items: EnrichedMemory[], sort: MemoryListSort) {
	return [...items].sort((a, b) => {
		switch (sort) {
			case "updated_asc":
				return a.base.updatedAt.getTime() - b.base.updatedAt.getTime();
			case "created_desc":
				return b.base.createdAt.getTime() - a.base.createdAt.getTime();
			case "created_asc":
				return a.base.createdAt.getTime() - b.base.createdAt.getTime();
			case "title_asc":
				return a.base.title.localeCompare(b.base.title);
			case "title_desc":
				return b.base.title.localeCompare(a.base.title);
			case "type_asc":
				return a.base.type.localeCompare(b.base.type);
			case "status_asc":
				return a.base.status.localeCompare(b.base.status);
			case "relation_count_desc":
				return (
					b.relationCount - a.relationCount ||
					b.base.updatedAt.getTime() - a.base.updatedAt.getTime()
				);
			case "updated_desc":
			default:
				return b.base.updatedAt.getTime() - a.base.updatedAt.getTime();
		}
	});
}

function buildFacets<T extends string>(items: T[], allowed: readonly T[]) {
	const counts = new Map<T, number>();
	for (const allowedValue of allowed) counts.set(allowedValue, 0);
	for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
	return allowed.map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

async function loadBaseEnrichedMemories(
	db: MinniDB,
	includeLocked = false,
): Promise<EnrichedMemory[]> {
	const baseRows = await db.select().from(memories);
	const unlockedRows = includeLocked
		? baseRows
		: baseRows.filter((row) => row.permission !== "locked");

	if (unlockedRows.length === 0) return [];

	const ids = unlockedRows.map((row) => row.id);
	const [tagRows, projectRows, devModeRows, relationRows, activeProject, activeDevMode] =
		await Promise.all([
			db
				.select({ memoryId: memoryTags.memoryId, tagName: tags.name })
				.from(memoryTags)
				.innerJoin(tags, eq(tags.id, memoryTags.tagId))
				.where(inArray(memoryTags.memoryId, ids)),
			db
				.select({
					memoryId: projectMemories.memoryId,
					projectId: projects.id,
					projectName: projects.name,
					sortOrder: projectMemories.sortOrder,
				})
				.from(projectMemories)
				.innerJoin(projects, eq(projects.id, projectMemories.projectId))
				.where(inArray(projectMemories.memoryId, ids)),
			db
				.select({
					memoryId: devModeMemories.memoryId,
					devModeId: devModes.id,
					devModeName: devModes.name,
					sortOrder: devModeMemories.sortOrder,
				})
				.from(devModeMemories)
				.innerJoin(devModes, eq(devModes.id, devModeMemories.devModeId))
				.where(inArray(devModeMemories.memoryId, ids)),
			db
				.select()
				.from(memoryRelations)
				.where(or(inArray(memoryRelations.memoryId, ids), inArray(memoryRelations.relatedId, ids))),
			getActiveProject(db),
			getActiveDevMode(db),
		]);

	const tagsByMemory = new Map<number, string[]>();
	for (const row of tagRows) {
		const current = tagsByMemory.get(row.memoryId) ?? [];
		current.push(row.tagName);
		tagsByMemory.set(row.memoryId, current);
	}

	const projectsByMemory = new Map<number, AssociationRef[]>();
	for (const row of projectRows) {
		const current = projectsByMemory.get(row.memoryId) ?? [];
		current.push({ id: row.projectId, name: row.projectName, sortOrder: row.sortOrder });
		projectsByMemory.set(row.memoryId, current);
	}

	const devModesByMemory = new Map<number, AssociationRef[]>();
	for (const row of devModeRows) {
		const current = devModesByMemory.get(row.memoryId) ?? [];
		current.push({ id: row.devModeId, name: row.devModeName, sortOrder: row.sortOrder });
		devModesByMemory.set(row.memoryId, current);
	}

	const relationCountByMemory = new Map<number, number>();
	for (const row of relationRows) {
		relationCountByMemory.set(row.memoryId, (relationCountByMemory.get(row.memoryId) ?? 0) + 1);
		if (row.relatedId !== row.memoryId) {
			relationCountByMemory.set(row.relatedId, (relationCountByMemory.get(row.relatedId) ?? 0) + 1);
		}
	}

	return unlockedRows.map((row) => {
		const projectAssociations = (projectsByMemory.get(row.id) ?? []).sort(
			(a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
		);
		const devModeAssociations = (devModesByMemory.get(row.id) ?? []).sort(
			(a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
		);

		return {
			base: row,
			tags: (tagsByMemory.get(row.id) ?? []).sort((a, b) => a.localeCompare(b)),
			projects: projectAssociations,
			devModes: devModeAssociations,
			relationCount: relationCountByMemory.get(row.id) ?? 0,
			activeContext: {
				inActiveProject:
					!!activeProject && projectAssociations.some((item) => item.id === activeProject.id),
				inActiveDevMode:
					!!activeDevMode && devModeAssociations.some((item) => item.id === activeDevMode.id),
			},
			placement: getPlacement(projectAssociations, devModeAssociations),
		};
	});
}

/** Lists memories with derived associations, active-context flags, facets, filtering, and pagination. */
export async function listEnrichedMemories(db: MinniDB, query: EnrichedMemoryListQuery) {
	const typeFilter = parseCsvEnum(query.type, MEMORY_TYPE, "type");
	const statusFilter = parseCsvEnum(query.status, MEMORY_STATUS, "status");
	const permissionFilter = parseCsvEnum(query.permission, PERMISSION, "permission");
	const placementFilter = parseCsvEnum(query.placement, MEMORY_PLACEMENT, "placement");
	const sort = query.sort ?? "updated_desc";
	const limit = query.limit ?? 50;
	const offset = query.offset ?? 0;
	const search = query.search?.trim().toLowerCase();

	const [activeProject, activeDevMode, enriched] = await Promise.all([
		getActiveProject(db),
		getActiveDevMode(db),
		loadBaseEnrichedMemories(db),
	]);

	const filtered = enriched.filter((item) => {
		if (search) {
			const haystack =
				`${item.base.title}\n${item.base.content}\n${item.tags.join(" ")}`.toLowerCase();
			if (!haystack.includes(search)) return false;
		}

		if (typeFilter.length > 0 && !typeFilter.includes(item.base.type)) return false;
		if (statusFilter.length > 0 && !statusFilter.includes(item.base.status)) return false;
		if (permissionFilter.length > 0 && !permissionFilter.includes(item.base.permission))
			return false;
		if (placementFilter.length > 0 && !placementFilter.includes(item.placement)) return false;
		if (query.projectId && !item.projects.some((project) => project.id === query.projectId))
			return false;
		if (query.devModeId && !item.devModes.some((mode) => mode.id === query.devModeId)) return false;
		if (
			query.onlyActiveContext &&
			!item.activeContext.inActiveProject &&
			!item.activeContext.inActiveDevMode
		) {
			return false;
		}

		return true;
	});

	const sorted = sortItems(filtered, sort);
	const paginated = sorted.slice(offset, offset + limit);

	return {
		items: paginated.map((item) => ({
			id: item.base.id,
			title: item.base.title,
			excerpt: buildExcerpt(item.base.content),
			type: item.base.type,
			status: item.base.status,
			permission: item.base.permission,
			createdAt: item.base.createdAt,
			updatedAt: item.base.updatedAt,
			tags: item.tags,
			associations: {
				projects: item.projects,
				devModes: item.devModes,
			},
			relationCount: item.relationCount,
			activeContext: item.activeContext,
			placement: item.placement,
			actions: getMemoryStatusActions(item.base.status, item.base.permission),
			summary: {
				relationCount: item.relationCount,
				projectCount: item.projects.length,
				devModeCount: item.devModes.length,
				tagCount: item.tags.length,
			},
		})),
		meta: {
			total: filtered.length,
			limit,
			offset,
			activeProject: activeProject ? { id: activeProject.id, name: activeProject.name } : null,
			activeDevMode: activeDevMode ? { id: activeDevMode.id, name: activeDevMode.name } : null,
		},
		facets: {
			type: buildFacets(
				filtered.map((item) => item.base.type),
				MEMORY_TYPE,
			),
			status: buildFacets(
				filtered.map((item) => item.base.status),
				MEMORY_STATUS,
			),
			permission: buildFacets(
				filtered.map((item) => item.base.permission),
				PERMISSION,
			),
			placement: buildFacets(
				filtered.map((item) => item.placement),
				MEMORY_PLACEMENT,
			),
		},
	};
}

/** Loads one memory with associations, bidirectional relations, active-context flags, and action metadata. */
export async function getEnrichedMemoryDetail(db: MinniDB, id: number) {
	const memory = await db.select().from(memories).where(eq(memories.id, id)).limit(1);
	if (!memory[0]) return null;

	const [tagRows, projectRows, devModeRows, outgoing, incoming, activeProject, activeDevMode] =
		await Promise.all([
			db
				.select({ tagName: tags.name })
				.from(memoryTags)
				.innerJoin(tags, eq(tags.id, memoryTags.tagId))
				.where(eq(memoryTags.memoryId, id)),
			db
				.select({ id: projects.id, name: projects.name, sortOrder: projectMemories.sortOrder })
				.from(projectMemories)
				.innerJoin(projects, eq(projects.id, projectMemories.projectId))
				.where(eq(projectMemories.memoryId, id)),
			db
				.select({ id: devModes.id, name: devModes.name, sortOrder: devModeMemories.sortOrder })
				.from(devModeMemories)
				.innerJoin(devModes, eq(devModes.id, devModeMemories.devModeId))
				.where(eq(devModeMemories.memoryId, id)),
			db
				.select({ id: memories.id, title: memories.title, type: memories.type })
				.from(memoryRelations)
				.innerJoin(memories, eq(memories.id, memoryRelations.relatedId))
				.where(eq(memoryRelations.memoryId, id)),
			db
				.select({ id: memories.id, title: memories.title, type: memories.type })
				.from(memoryRelations)
				.innerJoin(memories, eq(memories.id, memoryRelations.memoryId))
				.where(eq(memoryRelations.relatedId, id)),
			getActiveProject(db),
			getActiveDevMode(db),
		]);

	const projectsForMemory = projectRows.sort(
		(a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
	);
	const devModesForMemory = devModeRows.sort(
		(a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
	);

	return {
		id: memory[0].id,
		title: memory[0].title,
		content: memory[0].content,
		type: memory[0].type,
		status: memory[0].status,
		permission: memory[0].permission,
		createdAt: memory[0].createdAt,
		updatedAt: memory[0].updatedAt,
		tags: tagRows.map((row) => row.tagName).sort((a, b) => a.localeCompare(b)),
		associations: {
			projects: projectsForMemory,
			devModes: devModesForMemory,
		},
		relations: {
			outgoing,
			incoming,
		},
		activeContext: {
			inActiveProject:
				!!activeProject && projectsForMemory.some((item) => item.id === activeProject.id),
			inActiveDevMode:
				!!activeDevMode && devModesForMemory.some((item) => item.id === activeDevMode.id),
		},
		placement: getPlacement(projectsForMemory, devModesForMemory),
		actions: getMemoryStatusActions(memory[0].status, memory[0].permission),
		summary: {
			relationCount: outgoing.length + incoming.length,
			projectCount: projectsForMemory.length,
			devModeCount: devModesForMemory.length,
			tagCount: tagRows.length,
		},
	};
}

/** Applies one memory status transition and returns a typed route-safe success or failure payload. */
export async function applyMemoryStatusAction(
	db: MinniDB,
	id: number,
	action: MemoryStatusAction,
): Promise<MemoryStatusActionSuccess | MemoryStatusActionError> {
	const memory = await db.select().from(memories).where(eq(memories.id, id)).limit(1);
	if (!memory[0]) return { success: false, error: "Memory not found", code: 404 };

	if (memory[0].permission === "locked") {
		return { success: false, error: "Memory is locked", code: 400 };
	}

	if (memory[0].permission === "read_only") {
		return { success: false, error: "Memory is read-only", code: 400 };
	}

	const nextStatus = getNextMemoryStatus(memory[0].status, action);
	if (!nextStatus) {
		return {
			success: false,
			error: `Cannot ${action} memory from status "${memory[0].status}"`,
			code: 400,
		};
	}

	const updated = await db
		.update(memories)
		.set({ status: nextStatus, updatedAt: new Date() })
		.where(eq(memories.id, id))
		.returning({ id: memories.id, status: memories.status, permission: memories.permission });

	return {
		success: true as const,
		id: updated[0].id,
		previousStatus: memory[0].status,
		status: updated[0].status,
		availableActions: getMemoryStatusActions(updated[0].status, updated[0].permission),
	};
}
