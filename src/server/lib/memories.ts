import { eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

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
} from "../../schema";

export const MEMORY_PLACEMENT = ["unaffiliated", "project", "dev_mode", "shared"] as const;
export type MemoryPlacement = (typeof MEMORY_PLACEMENT)[number];

export const MEMORY_LIST_SORT = [
	"updated_desc",
	"updated_asc",
	"created_desc",
	"created_asc",
	"title_asc",
	"title_desc",
	"type_asc",
	"status_asc",
	"relation_count_desc",
] as const;
export type MemoryListSort = (typeof MEMORY_LIST_SORT)[number];

export const MemoriesEnrichedQuerySchema = z.object({
	search: z.string().optional(),
	type: z.string().optional(),
	status: z.string().optional(),
	permission: z.string().optional(),
	placement: z.string().optional(),
	projectId: z.coerce.number().int().optional(),
	devModeId: z.coerce.number().int().optional(),
	onlyActiveContext: z.coerce.boolean().optional(),
	sort: z.enum(MEMORY_LIST_SORT).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	offset: z.coerce.number().int().min(0).optional(),
});

export const ContextRefSchema = z.object({
	id: z.number(),
	name: z.string(),
});

export const MemoryAssociationRefSchema = z.object({
	id: z.number(),
	name: z.string(),
	sortOrder: z.number().nullable(),
});

export const MemoryRelationRefSchema = z.object({
	id: z.number(),
	title: z.string(),
	type: z.enum(MEMORY_TYPE),
});

export const MemoryPlacementSchema = z.enum(MEMORY_PLACEMENT);

export const MemoryListItemSchema = z.object({
	id: z.number(),
	title: z.string(),
	excerpt: z.string(),
	type: z.enum(MEMORY_TYPE),
	status: z.enum(MEMORY_STATUS),
	permission: z.enum(PERMISSION),
	createdAt: z.date(),
	updatedAt: z.date(),
	tags: z.array(z.string()),
	associations: z.object({
		projects: z.array(MemoryAssociationRefSchema),
		devModes: z.array(MemoryAssociationRefSchema),
	}),
	relationCount: z.number(),
	activeContext: z.object({
		inActiveProject: z.boolean(),
		inActiveDevMode: z.boolean(),
	}),
	placement: MemoryPlacementSchema,
});

const TypeFacetSchema = z.object({ value: z.enum(MEMORY_TYPE), count: z.number() });
const StatusFacetSchema = z.object({ value: z.enum(MEMORY_STATUS), count: z.number() });
const PermissionFacetSchema = z.object({ value: z.enum(PERMISSION), count: z.number() });
const PlacementFacetSchema = z.object({ value: MemoryPlacementSchema, count: z.number() });

export const MemoriesEnrichedListResponseSchema = z.object({
	items: z.array(MemoryListItemSchema),
	meta: z.object({
		total: z.number(),
		limit: z.number(),
		offset: z.number(),
		activeProject: ContextRefSchema.nullable(),
		activeDevMode: ContextRefSchema.nullable(),
	}),
	facets: z.object({
		type: z.array(TypeFacetSchema),
		status: z.array(StatusFacetSchema),
		permission: z.array(PermissionFacetSchema),
		placement: z.array(PlacementFacetSchema),
	}),
});

export const MemoryDetailResponseSchema = z.object({
	id: z.number(),
	title: z.string(),
	content: z.string(),
	type: z.enum(MEMORY_TYPE),
	status: z.enum(MEMORY_STATUS),
	permission: z.enum(PERMISSION),
	createdAt: z.date(),
	updatedAt: z.date(),
	tags: z.array(z.string()),
	associations: z.object({
		projects: z.array(MemoryAssociationRefSchema),
		devModes: z.array(MemoryAssociationRefSchema),
	}),
	relations: z.object({
		outgoing: z.array(MemoryRelationRefSchema),
		incoming: z.array(MemoryRelationRefSchema),
	}),
	activeContext: z.object({
		inActiveProject: z.boolean(),
		inActiveDevMode: z.boolean(),
	}),
	placement: MemoryPlacementSchema,
});

export type EnrichedMemoryListQuery = z.infer<typeof MemoriesEnrichedQuerySchema>;
export type MemoriesEnrichedListResponse = z.infer<typeof MemoriesEnrichedListResponseSchema>;
export type MemoryDetailResponse = z.infer<typeof MemoryDetailResponseSchema>;

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
	};
}
