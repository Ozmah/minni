import { desc, eq, getColumns } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import type { MinniDB } from "../../helpers";

import { projects, tasks, taskSelectSchema, TASK_STATUS } from "../../schema";
import { ErrorResponse, SuccessResponse } from "../types";

const TaskDetailResponse = taskSelectSchema.extend({
	projectName: z.string().nullable(),
	subtasks: z.array(taskSelectSchema),
});

const TaskPatchBody = z.object({
	status: z.enum(TASK_STATUS),
});

export const taskRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/tasks" })
		.get(
			"/",
			async ({ query }) => {
				// clamp value between 1 and 100 with 50 as default
				const limit = Math.min(Math.max(1, query.limit ?? 50), 100);

				if (query.project) {
					return db
						.select()
						.from(tasks)
						.where(eq(tasks.projectId, query.project))
						.orderBy(desc(tasks.updatedAt))
						.limit(limit);
				}

				return db.select().from(tasks).orderBy(desc(tasks.updatedAt)).limit(limit);
			},
			{
				query: z.object({
					project: z.coerce.number().int().optional(),
					limit: z.coerce.number().int().min(1).max(100).optional(),
				}),
				response: {
					200: z.array(taskSelectSchema),
				},
			},
		)
		.get(
			"/:id",
			async ({ params, status }) => {
				const result = await db
					.select({
						...getColumns(tasks),
						projectName: projects.name,
					})
					.from(tasks)
					.leftJoin(projects, eq(tasks.projectId, projects.id))
					.where(eq(tasks.id, params.id))
					.limit(1);

				if (!result.length) return status(404, { error: "Task not found" });

				const subtasks = await db
					.select()
					.from(tasks)
					.where(eq(tasks.parentId, params.id))
					.orderBy(desc(tasks.updatedAt));

				return { ...result[0], subtasks };
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: TaskDetailResponse,
					404: ErrorResponse,
				},
			},
		)
		.patch(
			"/:id",
			async ({ params, body, status }) => {
				const result = await db
					.update(tasks)
					.set({
						status: body.status,
						updatedAt: new Date(),
					})
					.where(eq(tasks.id, params.id))
					.returning({ id: tasks.id, status: tasks.status });

				if (!result.length) return status(404, { error: "Task not found" });
				return { success: true as const, ...result[0] };
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: TaskPatchBody,
				response: {
					404: ErrorResponse,
				},
			},
		)
		.delete(
			"/:id",
			async ({ params, status }) => {
				const result = await db
					.delete(tasks)
					.where(eq(tasks.id, params.id))
					.returning({ id: tasks.id });

				if (!result.length) return status(404, { error: "Task not found" });
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
