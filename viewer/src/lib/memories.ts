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
};

export type MemoryFilters = {
	search: string;
	types: Set<MemoryType>;
	statuses: Set<MemoryStatus>;
	permissions: Set<Permission>;
	onlyActive: boolean;
};

function serializeSet(values: Set<string>) {
	return values.size > 0 ? [...values].join(",") : undefined;
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
	return value as MemoriesListResponse;
}

export function normalizeMemoryDetail(value: unknown): MemoryDetail {
	return value as MemoryDetail;
}
