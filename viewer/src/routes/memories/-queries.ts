import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api";
import {
	buildMemoriesQuery,
	normalizeMemoriesListResponse,
	normalizeMemoryDetail,
	type MemoryFilters,
	type MemoryStatusAction,
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

export function useMemoryStatusMutation(id: number) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (action: MemoryStatusAction) =>
			api.api.memories({ id }).status.post({ action }).then(unwrap),
		onSuccess: async () => {
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["memory", String(id)] }),
				qc.invalidateQueries({ queryKey: ["memories"] }),
			]);
		},
	});
}
