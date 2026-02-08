import { count, sql } from "drizzle-orm";
import { Elysia } from "elysia";

import type { MinniDB } from "../../helpers";

import { projects, memories, tasks, canvas } from "../../schema";

export const statsRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/stats" }).get("/", async () => {
		const [m, p, t, c] = await Promise.all([
			db.select({ total: count() }).from(memories),
			db
				.select({ total: count() })
				.from(projects)
				.where(sql`status != 'deleted'`),
			db.select({ total: count() }).from(tasks),
			db.select({ total: count() }).from(canvas),
		]);

		return {
			memories: m[0].total,
			projects: p[0].total,
			tasks: t[0].total,
			canvas: c[0].total,
		};
	});
