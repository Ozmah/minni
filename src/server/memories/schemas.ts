import { z } from "zod";

import {
	MEMORY_STATUS,
	MEMORY_TYPE,
	PERMISSION,
	devModeSelectSchema,
	memorySelectSchema,
	projectSelectSchema,
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

export const ContextRefSchema = projectSelectSchema.pick({ id: true, name: true });

export const ProjectAssociationRefSchema = projectSelectSchema
	.pick({ id: true, name: true })
	.extend({ sortOrder: z.number().nullable() });

export const DevModeAssociationRefSchema = devModeSelectSchema
	.pick({ id: true, name: true })
	.extend({ sortOrder: z.number().nullable() });

export const MemoryRelationRefSchema = memorySelectSchema.pick({
	id: true,
	title: true,
	type: true,
});

export const MemoryStatusActionsSchema = z.object({
	canPromote: z.boolean(),
	canDegrade: z.boolean(),
	canDeprecate: z.boolean(),
});

export const MemorySummarySchema = z.object({
	relationCount: z.number(),
	projectCount: z.number(),
	devModeCount: z.number(),
	tagCount: z.number(),
});

export const MemoryStatusActionBodySchema = z.object({
	action: z.enum(["promote", "degrade", "deprecate"]),
});

export const MemoryStatusActionResponseSchema = z.object({
	success: z.literal(true),
	id: z.number(),
	previousStatus: z.enum(MEMORY_STATUS),
	status: z.enum(MEMORY_STATUS),
	availableActions: MemoryStatusActionsSchema,
});

export const MemoryPlacementSchema = z.enum(MEMORY_PLACEMENT);

export const MemoryListItemSchema = memorySelectSchema
	.pick({
		id: true,
		title: true,
		type: true,
		status: true,
		permission: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		excerpt: z.string(),
		tags: z.array(z.string()),
		associations: z.object({
			projects: z.array(ProjectAssociationRefSchema),
			devModes: z.array(DevModeAssociationRefSchema),
		}),
		relationCount: z.number(),
		activeContext: z.object({
			inActiveProject: z.boolean(),
			inActiveDevMode: z.boolean(),
		}),
		placement: MemoryPlacementSchema,
		actions: MemoryStatusActionsSchema,
		summary: MemorySummarySchema,
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

export const MemoryDetailResponseSchema = memorySelectSchema
	.pick({
		id: true,
		title: true,
		content: true,
		type: true,
		status: true,
		permission: true,
		createdAt: true,
		updatedAt: true,
	})
	.extend({
		tags: z.array(z.string()),
		associations: z.object({
			projects: z.array(ProjectAssociationRefSchema),
			devModes: z.array(DevModeAssociationRefSchema),
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
export type MemoryStatusAction = z.infer<typeof MemoryStatusActionBodySchema>["action"];
export type MemoryStatusActionSuccess = z.infer<typeof MemoryStatusActionResponseSchema>;
export type MemoryStatusActionError = { success: false; error: string; code: 400 | 404 };
