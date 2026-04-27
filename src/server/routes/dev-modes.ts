import { asc, and, desc, eq, inArray, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import type { MinniDB } from "../../helpers";

import {
	activeState,
	devModeMemories,
	devModes,
	devModeSelectSchema,
	memories,
	PERMISSION,
	ruleSelectSchema,
	rules,
	RULE_SEVERITY,
} from "../../schema";
import { ErrorResponse, SuccessResponse } from "../types";

const DevModePatchBody = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	permission: z.enum(["open", "guarded", "read_only", "locked"]).optional(),
});

const DevModePrincipleInputSchema = z.object({
	id: z.number().int().optional(),
	statement: z.string().trim().min(1),
	rationale: z.string().max(2000).nullable().optional(),
	severity: z.enum(RULE_SEVERITY).default("default"),
	permission: z.enum(PERMISSION).default("guarded"),
	example: z.string().max(2000).nullable().optional(),
});

const DevModePrinciplesBody = z.object({
	principles: z.array(DevModePrincipleInputSchema).max(50),
});

const DevModeMemoriesBody = z.object({
	memoryIds: z.array(z.number().int()).max(100),
});

const DevModeCompositionBody = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().max(500),
	permission: z.enum(PERMISSION),
	principles: z.array(DevModePrincipleInputSchema).max(50),
	memoryIds: z.array(z.number().int()).max(100),
});

const DevModeMemorySummarySchema = z.object({
	id: z.number(),
	title: z.string(),
	type: z.string(),
	status: z.string(),
	permission: z.string(),
	sortOrder: z.number(),
});

const DevModeSummarySchema = z.object({
	principleCount: z.number(),
	memoryCount: z.number(),
});

const DevModeEnrichedResponseSchema = z.object({
	devMode: devModeSelectSchema,
	principles: z.array(ruleSelectSchema),
	memories: z.array(DevModeMemorySummarySchema),
	isActive: z.boolean(),
	summary: DevModeSummarySchema,
	injectionPreview: z.string(),
});

function buildDevModePreview(args: {
	devMode: typeof devModes.$inferSelect;
	principles: Array<typeof rules.$inferSelect>;
	memoryCount: number;
}) {
	const lines = [`[DEV_MODE:${args.devMode.name}]`];
	if (args.devMode.description) lines.push(args.devMode.description);
	lines.push(`Permission: ${args.devMode.permission}`);

	if (args.principles.length > 0) {
		lines.push("");
		lines.push("Principles:");
		for (const principle of args.principles) lines.push(`- ${principle.statement}`);
	}

	if (args.memoryCount > 0) {
		lines.push("");
		lines.push(`Associated memories: ${args.memoryCount}`);
	}

	lines.push(`[/DEV_MODE:${args.devMode.name}]`);
	return lines.join("\n");
}

async function getEnrichedDevMode(db: MinniDB, id: number) {
	const [devMode] = await db.select().from(devModes).where(eq(devModes.id, id)).limit(1);
	if (!devMode) return null;

	const [principles, associatedMemories, active] = await Promise.all([
		db
			.select()
			.from(rules)
			.where(and(eq(rules.devModeId, id), eq(rules.kind, "principle")))
			.orderBy(asc(rules.sortOrder), asc(rules.id)),
		db
			.select({
				id: memories.id,
				title: memories.title,
				type: memories.type,
				status: memories.status,
				permission: memories.permission,
				sortOrder: devModeMemories.sortOrder,
			})
			.from(devModeMemories)
			.innerJoin(memories, eq(memories.id, devModeMemories.memoryId))
			.where(eq(devModeMemories.devModeId, id))
			.orderBy(asc(devModeMemories.sortOrder), asc(memories.title)),
		db.select().from(activeState).where(eq(activeState.id, 1)).limit(1),
	]);

	return {
		devMode,
		principles,
		memories: associatedMemories,
		isActive: active[0]?.activeDevModeId === id,
		summary: {
			principleCount: principles.length,
			memoryCount: associatedMemories.length,
		},
		injectionPreview: buildDevModePreview({
			devMode,
			principles,
			memoryCount: associatedMemories.length,
		}),
	};
}

function uniqueMemoryIds(ids: number[]) {
	return Array.from(new Set(ids));
}

async function getUnavailableMemoryIds(db: MinniDB, ids: number[]) {
	if (ids.length === 0) return [];

	const available = await db
		.select({ id: memories.id })
		.from(memories)
		.where(and(inArray(memories.id, ids), sql`${memories.permission} != 'locked'`));
	const availableIds = new Set(available.map((memory) => memory.id));

	return ids.filter((id) => !availableIds.has(id));
}

export const devModeRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/dev-modes" })
		.get("/", async () => db.select().from(devModes).orderBy(desc(devModes.updatedAt)), {
			response: {
				200: z.array(devModeSelectSchema),
			},
		})
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

				await db.run(sql`BEGIN`);
				try {
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

					await db.delete(devModeMemories).where(eq(devModeMemories.devModeId, params.id));

					if (memoryIds.length > 0) {
						await db.insert(devModeMemories).values(
							memoryIds.map((memoryId, sortOrder) => ({
								devModeId: params.id,
								memoryId,
								sortOrder,
							})),
						);
					}

					await db.run(sql`COMMIT`);
				} catch (error) {
					await db.run(sql`ROLLBACK`);
					throw error;
				}

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

				await db.run(sql`BEGIN`);
				try {
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
					await db.run(sql`COMMIT`);
				} catch (error) {
					await db.run(sql`ROLLBACK`);
					throw error;
				}

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

				await db.run(sql`BEGIN`);
				try {
					await db.delete(devModeMemories).where(eq(devModeMemories.devModeId, params.id));

					if (memoryIds.length > 0) {
						await db.insert(devModeMemories).values(
							memoryIds.map((memoryId, sortOrder) => ({
								devModeId: params.id,
								memoryId,
								sortOrder,
							})),
						);
					}

					await db
						.update(devModes)
						.set({ updatedAt: new Date() })
						.where(eq(devModes.id, params.id));
					await db.run(sql`COMMIT`);
				} catch (error) {
					await db.run(sql`ROLLBACK`);
					throw error;
				}

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
