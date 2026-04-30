import { and, desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import type { MinniDB } from "../../helpers";

import { activeState, devModes, devModeSelectSchema, rules } from "../../schema";
import {
	DevModeCompositionBody,
	DevModeCreateBody,
	DevModeEnrichedResponseSchema,
	DevModeMemoriesBody,
	DevModePatchBody,
	DevModePrinciplesBody,
} from "../dev-modes/schemas";
import { getEnrichedDevMode } from "../dev-modes/service";
import {
	getUnavailableMemoryIds,
	replaceDevModeMemoryAssociations,
	uniqueMemoryIds,
} from "../lib/memory-associations";
import { withTransaction } from "../lib/transactions";
import { ErrorResponse, SuccessResponse } from "../types";

export const devModeRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/dev-modes" })
		.get("/", async () => db.select().from(devModes).orderBy(desc(devModes.updatedAt)), {
			response: {
				200: z.array(devModeSelectSchema),
			},
		})
		.post(
			"/",
			async ({ body, status }) => {
				const existing = await db
					.select()
					.from(devModes)
					.where(eq(devModes.name, body.name))
					.limit(1);
				if (existing[0]) return status(409, { error: `Dev Mode "${body.name}" already exists` });

				const result = await db
					.insert(devModes)
					.values({
						name: body.name,
						description: body.description ?? null,
						permission: body.permission,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning();

				return result[0];
			},
			{
				body: DevModeCreateBody,
				response: {
					200: devModeSelectSchema,
					409: ErrorResponse,
				},
			},
		)
		.get(
			"/:id/enriched",
			async ({ params, status }) => {
				const result = await getEnrichedDevMode(db, params.id);
				if (!result) return status(404, { error: "Dev Mode not found" });
				return result;
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: DevModeEnrichedResponseSchema,
					404: ErrorResponse,
				},
			},
		)
		.get(
			"/:id",
			async ({ params, status }) => {
				const result = await db.select().from(devModes).where(eq(devModes.id, params.id)).limit(1);
				if (!result.length) return status(404, { error: "Dev Mode not found" });
				return result[0];
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: devModeSelectSchema,
					404: ErrorResponse,
				},
			},
		)
		.patch(
			"/:id",
			async ({ params, body, status }) => {
				const result = await db
					.update(devModes)
					.set({ ...body, updatedAt: new Date() })
					.where(eq(devModes.id, params.id))
					.returning();

				if (!result.length) return status(404, { error: "Dev Mode not found" });
				return result[0];
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: DevModePatchBody,
				response: {
					200: devModeSelectSchema,
					404: ErrorResponse,
				},
			},
		)
		.put(
			"/:id/composition",
			async ({ params, body, status }) => {
				const [devMode] = await db
					.select()
					.from(devModes)
					.where(eq(devModes.id, params.id))
					.limit(1);
				if (!devMode) return status(404, { error: "Dev Mode not found" });

				const memoryIds = uniqueMemoryIds(body.memoryIds);
				const missing = await getUnavailableMemoryIds(db, memoryIds);
				if (missing.length > 0) {
					return status(400, {
						error: `Cannot associate missing or locked memories: ${missing.join(", ")}`,
					});
				}

				await withTransaction(db, async () => {
					await db
						.update(devModes)
						.set({
							name: body.name,
							description: body.description,
							permission: body.permission,
							updatedAt: new Date(),
						})
						.where(eq(devModes.id, params.id));

					await db
						.delete(rules)
						.where(and(eq(rules.devModeId, params.id), eq(rules.kind, "principle")));

					if (body.principles.length > 0) {
						await db.insert(rules).values(
							body.principles.map((principle, sortOrder) => ({
								devModeId: params.id,
								projectId: null,
								kind: "principle" as const,
								statement: principle.statement,
								rationale: principle.rationale ?? null,
								severity: principle.severity,
								permission: principle.permission,
								example: principle.example ?? null,
								sortOrder,
								createdAt: new Date(),
								updatedAt: new Date(),
							})),
						);
					}

					await replaceDevModeMemoryAssociations(db, params.id, memoryIds);
				});

				const result = await getEnrichedDevMode(db, params.id);
				if (!result) return status(404, { error: "Dev Mode not found" });
				return result;
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: DevModeCompositionBody,
				response: {
					200: DevModeEnrichedResponseSchema,
					400: ErrorResponse,
					404: ErrorResponse,
				},
			},
		)
		.put(
			"/:id/principles",
			async ({ params, body, status }) => {
				const [devMode] = await db
					.select()
					.from(devModes)
					.where(eq(devModes.id, params.id))
					.limit(1);
				if (!devMode) return status(404, { error: "Dev Mode not found" });

				await withTransaction(db, async () => {
					await db
						.delete(rules)
						.where(and(eq(rules.devModeId, params.id), eq(rules.kind, "principle")));

					if (body.principles.length > 0) {
						await db.insert(rules).values(
							body.principles.map((principle, sortOrder) => ({
								devModeId: params.id,
								projectId: null,
								kind: "principle" as const,
								statement: principle.statement,
								rationale: principle.rationale ?? null,
								severity: principle.severity,
								permission: principle.permission,
								example: principle.example ?? null,
								sortOrder,
								createdAt: new Date(),
								updatedAt: new Date(),
							})),
						);
					}

					await db
						.update(devModes)
						.set({ updatedAt: new Date() })
						.where(eq(devModes.id, params.id));
				});

				const result = await getEnrichedDevMode(db, params.id);
				if (!result) return status(404, { error: "Dev Mode not found" });
				return result;
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: DevModePrinciplesBody,
				response: {
					200: DevModeEnrichedResponseSchema,
					404: ErrorResponse,
				},
			},
		)
		.put(
			"/:id/memories",
			async ({ params, body, status }) => {
				const [devMode] = await db
					.select()
					.from(devModes)
					.where(eq(devModes.id, params.id))
					.limit(1);
				if (!devMode) return status(404, { error: "Dev Mode not found" });

				const memoryIds = uniqueMemoryIds(body.memoryIds);
				const missing = await getUnavailableMemoryIds(db, memoryIds);
				if (missing.length > 0) {
					return status(400, {
						error: `Cannot associate missing or locked memories: ${missing.join(", ")}`,
					});
				}

				await withTransaction(db, async () => {
					await replaceDevModeMemoryAssociations(db, params.id, memoryIds);

					await db
						.update(devModes)
						.set({ updatedAt: new Date() })
						.where(eq(devModes.id, params.id));
				});

				const result = await getEnrichedDevMode(db, params.id);
				if (!result) return status(404, { error: "Dev Mode not found" });
				return result;
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: DevModeMemoriesBody,
				response: {
					200: DevModeEnrichedResponseSchema,
					400: ErrorResponse,
					404: ErrorResponse,
				},
			},
		)
		.post(
			"/:id/activate",
			async ({ params, status }) => {
				const result = await db.select().from(devModes).where(eq(devModes.id, params.id)).limit(1);
				if (!result.length) return status(404, { error: "Dev Mode not found" });

				await db
					.update(activeState)
					.set({ activeDevModeId: params.id, updatedAt: new Date() })
					.where(eq(activeState.id, 1));

				return { success: true as const, id: result[0].id };
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: SuccessResponse,
					404: ErrorResponse,
				},
			},
		)
		.post(
			"/clear-active",
			async () => {
				await db
					.update(activeState)
					.set({ activeDevModeId: null, updatedAt: new Date() })
					.where(eq(activeState.id, 1));

				return { success: true as const, id: 1 };
			},
			{
				response: {
					200: SuccessResponse,
				},
			},
		)
		.delete(
			"/:id",
			async ({ params, status }) => {
				const result = await db
					.delete(devModes)
					.where(eq(devModes.id, params.id))
					.returning({ id: devModes.id });

				if (!result.length) return status(404, { error: "Dev Mode not found" });
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
