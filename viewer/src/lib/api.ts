import { treaty } from "@elysiajs/eden";

import type { App } from "../../../src/server";

export const api = treaty<App>(window.location.origin);

/**
 * Bridges Eden Treaty responses with TanStack Query's error model.
 *
 * Eden returns `{ data, error }` — Query expects queryFn to either
 * return data or throw. This function performs that conversion.
 *
 * Why not better-result here: Query already provides `{ data, error, isLoading }`
 * which is conceptually equivalent to a Result type. Wrapping Eden's response
 * in a Result would create double error wrapping (Result inside Query's own
 * error state) and force every consumer to handle Result instead of using
 * Query's built-in error/loading states.
 */
export function unwrap<T>(response: { data: T; error: unknown }): T {
	if (response.error) {
		const err = response.error as { value?: { error?: string } };
		throw new Error(err.value?.error ?? "Request failed");
	}
	return response.data;
}
