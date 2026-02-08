import { desc, eq, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import type { MinniDB } from "../../helpers";

import { memories, memorySelectSchema } from "../../schema";
import { ErrorResponse, SuccessResponse } from "../types";

export const memoryRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/memories" })
		.get(
			"/",
			async ({ query }) => {
				const limit = Math.min(Math.max(1, query.limit ?? 50), 100);

				if (query.project) {
					return db
						.select()
						.from(memories)
						.where(sql`permission != 'locked' AND project_id = ${query.project}`)
						.orderBy(desc(memories.updatedAt))
						.limit(limit);
				}

				return db
					.select()
					.from(memories)
					.where(sql`permission != 'locked'`)
					.orderBy(desc(memories.updatedAt))
					.limit(limit);
			},
			{
				query: z.object({
					project: z.coerce.number().int().optional(),
					limit: z.coerce.number().int().min(1).max(100).optional(),
				}),
				response: {
					200: z.array(memorySelectSchema),
				},
			},
		)
		.get(
			"/:id",
			async ({ params, status }) => {
				const result = await db.select().from(memories).where(eq(memories.id, params.id)).limit(1);

				if (!result.length) return status(404, { error: "Memory not found" });
				return result[0];
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: memorySelectSchema,
					404: ErrorResponse,
				},
			},
		)
		.delete(
			"/:id",
			async ({ params, status }) => {
				const result = await db
					.delete(memories)
					.where(eq(memories.id, params.id))
					.returning({ id: memories.id });

				if (!result.length) return status(404, { error: "Memory not found" });
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
