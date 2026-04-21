import { queryOptions } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api";
import {
	buildMemoriesQuery,
	normalizeMemoriesListResponse,
	normalizeMemoryDetail,
	type MemoryFilters,
} from "@/lib/memories";

export function memoriesEnrichedQueryOptions(filters: MemoryFilters) {
	const query = buildMemoriesQuery(filters);

	return queryOptions({
		queryKey: ["memories", "enriched", query],
		queryFn: () =>
			api.api.memories.enriched.get({ query }).then(unwrap).then(normalizeMemoriesListResponse),
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: "always",
		refetchOnWindowFocus: true,
	});
}

export function memoryDetailQueryOptions(id: number) {
	return queryOptions({
		queryKey: ["memory", String(id), "enriched"],
		queryFn: () => api.api.memories({ id }).enriched.get().then(unwrap).then(normalizeMemoryDetail),
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: "always",
		refetchOnWindowFocus: true,
	});
}
