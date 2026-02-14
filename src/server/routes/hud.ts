import { Elysia } from "elysia";
import { z } from "zod";

import { type MinniDB, getHudData } from "../../helpers";

const HudResponse = z.object({
	project: z
		.object({
			id: z.number(),
			name: z.string(),
			status: z.string().nullable(),
		})
		.nullable(),
	identity: z
		.object({
			id: z.number(),
			title: z.string(),
		})
		.nullable(),
	counts: z.object({
		projects: z.number(),
		memories: z.number(),
		tasks: z.object({
			total: z.number(),
			todo: z.number(),
			inProgress: z.number(),
			done: z.number(),
		}),
		canvas: z.number(),
	}),
});

export const hudRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/hud" }).get("/", () => getHudData(db), {
		response: {
			200: HudResponse,
		},
	});
