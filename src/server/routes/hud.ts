import { Elysia } from "elysia";
import { z } from "zod";

import { type MinniDB, getHudData } from "../../helpers";

const HudResponse = z.object({
	project: z
		.object({
			id: z.number(),
			name: z.string(),
		})
		.nullable(),
	devMode: z
		.object({
			id: z.number(),
			name: z.string(),
		})
		.nullable(),
	counts: z.object({
		projects: z.number(),
		devModes: z.number(),
		memories: z.number(),
		commands: z.number(),
		rules: z.number(),
		canvas: z.number(),
	}),
});

export const hudRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/hud" }).get("/", () => getHudData(db), {
		response: {
			200: HudResponse,
		},
	});
