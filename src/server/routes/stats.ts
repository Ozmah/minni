import { count } from "drizzle-orm";
import { Elysia } from "elysia";

import type { MinniDB } from "../../helpers";

import { canvas, commands, devModes, memories, projects, rules } from "../../schema";

export const statsRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/stats" }).get("/", async () => {
		const [m, p, d, cmd, r, c] = await Promise.all([
			db.select({ total: count() }).from(memories),
			db.select({ total: count() }).from(projects),
			db.select({ total: count() }).from(devModes),
			db.select({ total: count() }).from(commands),
			db.select({ total: count() }).from(rules),
			db.select({ total: count() }).from(canvas),
		]);

		return {
			memories: m[0].total,
			projects: p[0].total,
			devModes: d[0].total,
			commands: cmd[0].total,
			rules: r[0].total,
			canvas: c[0].total,
		};
	});
