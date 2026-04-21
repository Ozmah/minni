export type MemoryType =
	| "skill"
	| "pattern"
	| "anti_pattern"
	| "decision"
	| "insight"
	| "comparison"
	| "note"
	| "link"
	| "article"
	| "video"
	| "documentation";

export type MemoryStatus = "draft" | "experimental" | "proven" | "battle_tested" | "deprecated";

export type Permission = "open" | "guarded" | "read_only" | "locked";

export type MemoryPlacement = "unaffiliated" | "project" | "dev_mode" | "shared";

export type ContextRef = { id: number; name: string };

export type MemoryAssociationRef = {
	id: number;
	name: string;
	sortOrder: number | null;
};

export type MemoryRelationRef = {
	id: number;
	title: string;
	type: MemoryType;
};

export type MemoryFacetItem<T extends string> = {
	value: T;
	count: number;
};

export type MemoryStatusActions = {
	canPromote: boolean;
	canDegrade: boolean;
	canDeprecate: boolean;
};

export type MemorySummary = {
	relationCount: number;
	projectCount: number;
	devModeCount: number;
	tagCount: number;
};

export type MemoryStatusAction = "promote" | "degrade" | "deprecate";

export type MemoryListItem = {
	id: number;
	title: string;
	excerpt: string;
	type: MemoryType;
	status: MemoryStatus;
	permission: Permission;
	createdAt: string;
	updatedAt: string;
	tags: string[];
	associations: {
		projects: MemoryAssociationRef[];
		devModes: MemoryAssociationRef[];
	};
	relationCount: number;
	activeContext: {
		inActiveProject: boolean;
		inActiveDevMode: boolean;
	};
	placement: MemoryPlacement;
	actions: MemoryStatusActions;
	summary: MemorySummary;
};

export type MemoriesListResponse = {
	items: MemoryListItem[];
	meta: {
		total: number;
		limit: number;
		offset: number;
		activeProject: ContextRef | null;
		activeDevMode: ContextRef | null;
	};
	facets: {
		type: MemoryFacetItem<MemoryType>[];
		status: MemoryFacetItem<MemoryStatus>[];
		permission: MemoryFacetItem<Permission>[];
		placement: MemoryFacetItem<MemoryPlacement>[];
	};
};

export type MemoryDetail = {
	id: number;
	title: string;
	content: string;
	type: MemoryType;
	status: MemoryStatus;
	permission: Permission;
	createdAt: string;
	updatedAt: string;
	tags: string[];
	associations: {
		projects: MemoryAssociationRef[];
		devModes: MemoryAssociationRef[];
	};
	relations: {
		outgoing: MemoryRelationRef[];
		incoming: MemoryRelationRef[];
	};
	activeContext: {
		inActiveProject: boolean;
		inActiveDevMode: boolean;
	};
	placement: MemoryPlacement;
	actions: MemoryStatusActions;
	summary: MemorySummary;
};

export type MemoryFilters = {
	search: string;
	types: Set<MemoryType>;
	statuses: Set<MemoryStatus>;
	permissions: Set<Permission>;
	onlyActive: boolean;
};

export const DEFAULT_MEMORY_ACTIONS: MemoryStatusActions = {
	canPromote: false,
	canDegrade: false,
	canDeprecate: false,
};

export const DEFAULT_MEMORY_SUMMARY: MemorySummary = {
	relationCount: 0,
	projectCount: 0,
	devModeCount: 0,
	tagCount: 0,
};

function serializeSet(values: Set<string>) {
	return values.size > 0 ? [...values].join(",") : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function deriveMemoryActions(
	status: MemoryStatus,
	permission: Permission,
): MemoryStatusActions {
	if (permission === "locked" || permission === "read_only") {
		return DEFAULT_MEMORY_ACTIONS;
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
			return DEFAULT_MEMORY_ACTIONS;
	}
}

export function normalizeMemoryActions(
	value: unknown,
	status: MemoryStatus,
	permission: Permission,
): MemoryStatusActions {
	if (!isObject(value)) return deriveMemoryActions(status, permission);

	return {
		canPromote:
			typeof value.canPromote === "boolean"
				? value.canPromote
				: deriveMemoryActions(status, permission).canPromote,
		canDegrade:
			typeof value.canDegrade === "boolean"
				? value.canDegrade
				: deriveMemoryActions(status, permission).canDegrade,
		canDeprecate:
			typeof value.canDeprecate === "boolean"
				? value.canDeprecate
				: deriveMemoryActions(status, permission).canDeprecate,
	};
}

export function normalizeMemorySummary(value: unknown, fallback: MemorySummary): MemorySummary {
	if (!isObject(value)) return fallback;

	return {
		relationCount:
			typeof value.relationCount === "number" ? value.relationCount : fallback.relationCount,
		projectCount:
			typeof value.projectCount === "number" ? value.projectCount : fallback.projectCount,
		devModeCount:
			typeof value.devModeCount === "number" ? value.devModeCount : fallback.devModeCount,
		tagCount: typeof value.tagCount === "number" ? value.tagCount : fallback.tagCount,
	};
}

export function buildMemoriesQuery(filters: MemoryFilters) {
	return {
		search: filters.search.trim() || undefined,
		type: serializeSet(filters.types),
		status: serializeSet(filters.statuses),
		permission: serializeSet(filters.permissions),
		onlyActiveContext: filters.onlyActive || undefined,
		limit: 100,
		offset: 0,
		sort: "updated_desc" as const,
	};
}

export function normalizeMemoriesListResponse(value: unknown): MemoriesListResponse {
	const response = value as MemoriesListResponse;

	return {
		...response,
		items: (response.items ?? []).map((item) => {
			const fallbackSummary: MemorySummary = {
				relationCount: item.relationCount ?? 0,
				projectCount: item.associations?.projects?.length ?? 0,
				devModeCount: item.associations?.devModes?.length ?? 0,
				tagCount: item.tags?.length ?? 0,
			};

			return {
				...item,
				actions: normalizeMemoryActions(item.actions, item.status, item.permission),
				summary: normalizeMemorySummary(item.summary, fallbackSummary),
			};
		}),
	};
}

export function normalizeMemoryDetail(value: unknown): MemoryDetail {
	const detail = value as MemoryDetail;
	const fallbackSummary: MemorySummary = {
		relationCount:
			(detail.relations?.incoming?.length ?? 0) + (detail.relations?.outgoing?.length ?? 0),
		projectCount: detail.associations?.projects?.length ?? 0,
		devModeCount: detail.associations?.devModes?.length ?? 0,
		tagCount: detail.tags?.length ?? 0,
	};

	return {
		...detail,
		actions: normalizeMemoryActions(detail.actions, detail.status, detail.permission),
		summary: normalizeMemorySummary(detail.summary, fallbackSummary),
	};
}
