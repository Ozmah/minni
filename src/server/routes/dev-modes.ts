import { desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import type { MinniDB } from "../../helpers";

import { activeState, devModes, devModeSelectSchema } from "../../schema";
import { ErrorResponse, SuccessResponse } from "../types";

const DevModePatchBody = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	permission: z.enum(["open", "guarded", "read_only", "locked"]).optional(),
});

export const devModeRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/dev-modes" })
		.get("/", async () => db.select().from(devModes).orderBy(desc(devModes.updatedAt)), {
			response: {
				200: z.array(devModeSelectSchema),
			},
		})
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
