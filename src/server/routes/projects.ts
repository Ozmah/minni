import { desc, eq, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import type { MinniDB } from "../../helpers";

import { projects, projectSelectSchema } from "../../schema";
import { ErrorResponse, SuccessResponse } from "../types";

export const projectRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/projects" })
		.get(
			"/",
			async () => {
				return db
					.select()
					.from(projects)
					.where(sql`status != 'deleted'`)
					.orderBy(desc(projects.updatedAt));
			},
			{
				response: {
					200: z.array(projectSelectSchema),
				},
			},
		)
		.get(
			"/:id",
			async ({ params, status }) => {
				const result = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);

				if (!result.length) return status(404, { error: "Project not found" });
				return result[0];
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: projectSelectSchema,
					404: ErrorResponse,
				},
			},
		)
		.delete(
			"/:id",
			async ({ params, status }) => {
				const result = await db
					.update(projects)
					.set({ status: "deleted" })
					.where(eq(projects.id, params.id))
					.returning({ id: projects.id });

				if (!result.length) return status(404, { error: "Project not found" });
				return { success: true as const, id: result[0].id };
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: SuccessResponse,
					404: ErrorResponse,
				},
			},
		);
