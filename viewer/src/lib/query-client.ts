import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Minni currently serves information over a local dataset. Global caching adds
			// staleness risk and debugging confusion without meaningful performance benefit.
			// For now Query is used as a familiar request/state wrapper, not as a cache layer.
			staleTime: 0,
			gcTime: 0,
			refetchOnWindowFocus: true,
			refetchOnMount: "always",
		},
	},
});
