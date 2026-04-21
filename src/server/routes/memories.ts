import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import type { MinniDB } from "../../helpers";

import {
	memories,
	memorySelectSchema,
	MEMORY_TYPE,
	MEMORY_STATUS,
	PERMISSION,
	projectMemories,
} from "../../schema";
import {
	applyMemoryStatusAction,
	getEnrichedMemoryDetail,
	listEnrichedMemories,
	MemoriesEnrichedListResponseSchema,
	MemoryStatusActionBodySchema,
	MemoryStatusActionResponseSchema,
	MemoriesEnrichedQuerySchema,
	MemoryDetailResponseSchema,
} from "../lib/memories";
import { ErrorResponse, SuccessResponse } from "../types";

const MemoryPatchBody = z.object({
	title: z.string().min(1).max(200).optional(),
	content: z.string().min(1).optional(),
	type: z.enum(MEMORY_TYPE).optional(),
	status: z.enum(MEMORY_STATUS).optional(),
	permission: z.enum(PERMISSION).optional(),
});

export const memoryRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/memories" })
		.get(
			"/enriched",
			async ({ query, status }) => {
				try {
					return await listEnrichedMemories(db, query);
				} catch (error) {
					return status(400, {
						error: error instanceof Error ? error.message : "Invalid memories query",
					});
				}
			},
			{
				query: MemoriesEnrichedQuerySchema,
				response: {
					200: MemoriesEnrichedListResponseSchema,
					400: ErrorResponse,
				},
			},
		)
		.get(
			"/",
			async ({ query }) => {
				const limit = Math.min(Math.max(1, query.limit ?? 50), 100);

				if (query.project) {
					return db
						.select({ ...getTableColumns(memories) })
						.from(memories)
						.innerJoin(projectMemories, eq(projectMemories.memoryId, memories.id))
						.where(
							sql`${memories.permission} != 'locked' AND ${projectMemories.projectId} = ${query.project}`,
						)
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
			"/:id/enriched",
			async ({ params, status }) => {
				const result = await getEnrichedMemoryDetail(db, params.id);
				if (!result) return status(404, { error: "Memory not found" });
				return result;
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: MemoryDetailResponseSchema,
					404: ErrorResponse,
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
		.post(
			"/:id/status",
			async ({ params, body, status }) => {
				const result = await applyMemoryStatusAction(db, params.id, body.action);
				if (!result.success) return status(result.code, { error: result.error });
				return result;
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: MemoryStatusActionBodySchema,
				response: {
					200: MemoryStatusActionResponseSchema,
					400: ErrorResponse,
					404: ErrorResponse,
				},
			},
		)
		.patch(
			"/:id",
			async ({ params, body, status }) => {
				const result = await db
					.update(memories)
					.set({ ...body, updatedAt: new Date() })
					.where(eq(memories.id, params.id))
					.returning();

				if (!result.length) return status(404, { error: "Memory not found" });
				return result[0];
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: MemoryPatchBody,
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
