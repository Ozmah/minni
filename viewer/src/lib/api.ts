import { treaty } from "@elysiajs/eden";

import type { App } from "../../../src/server";

export const api = treaty<App>(window.location.origin);

/**
 * Unwraps an Eden Treaty response, throwing on error.
 * Use in queryFn to integrate with TanStack Query's error handling.
 */
export function unwrap<T>(response: { data: T; error: unknown }): T {
	if (response.error) {
		const err = response.error as { value?: { error?: string } };
		throw new Error(err.value?.error ?? "Request failed");
	}
	return response.data;
}
