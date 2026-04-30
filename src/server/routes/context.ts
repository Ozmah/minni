import { Elysia } from "elysia";

import type { MinniDB } from "../../helpers";

import { buildActiveContextLoadout } from "../lib/context-loadout";
import { ErrorResponse } from "../types";

export function contextRoutes(db: MinniDB) {
	return new Elysia({ prefix: "/api/context" }).get(
		"/active-loadout",
		async ({ set }) => {
			try {
				return await buildActiveContextLoadout(db);
			} catch (error) {
				set.status = 500;
				return { error: error instanceof Error ? error.message : "Failed to build active context" };
			}
		},
		{
			response: {
				500: ErrorResponse,
			},
		},
	);
}
