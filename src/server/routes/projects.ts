import { and, desc, eq, inArray } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

import { normalizeProjectName, type MinniDB } from "../../helpers";
import { activeState, projects, projectSelectSchema, rules } from "../../schema";
import { ProjectCommandsBody, ProjectCommandsResponseSchema } from "../commands/contracts";
import { listProjectCommands, replaceProjectCommands } from "../commands/service";
import {
	getUnavailableMemoryIds,
	replaceProjectMemoryAssociations,
	uniqueMemoryIds,
} from "../lib/memory-associations";
import { withTransaction } from "../lib/transactions";
import {
	ProjectCompositionBody,
	ProjectCreateBody,
	ProjectEnrichedResponseSchema,
	ProjectPatchBody,
} from "../projects/schemas";
import { getEnrichedProject } from "../projects/service";
import { ErrorResponse, SuccessResponse } from "../types";

export const projectRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/projects" })
		.get(
			"/",
			async () => {
				return db.select().from(projects).orderBy(desc(projects.updatedAt));
			},
			{
				response: {
					200: z.array(projectSelectSchema),
				},
			},
		)
		.post(
			"/",
			async ({ body, status }) => {
				const name = normalizeProjectName(body.name);
				if (!name)
					return status(400, { error: "Name must contain at least one alphanumeric character" });

				const existing = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
				if (existing[0]) return status(409, { error: `Project "${name}" already exists` });

				const result = await db
					.insert(projects)
					.values({
						name,
						description: body.description ?? null,
						stack: body.stack.length ? JSON.stringify(body.stack) : null,
						permission: body.permission,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning();

				return result[0];
			},
			{
				body: ProjectCreateBody,
				response: {
					200: projectSelectSchema,
					400: ErrorResponse,
					409: ErrorResponse,
				},
			},
		)
		.get(
			"/:id/enriched",
			async ({ params, status }) => {
				const result = await getEnrichedProject(db, params.id);
				if (!result) return status(404, { error: "Project not found" });
				return result;
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: ProjectEnrichedResponseSchema,
					404: ErrorResponse,
				},
			},
		)
		.get(
			"/:id/commands",
			async ({ params, status }) => {
				const project = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);
				if (!project[0]) return status(404, { error: "Project not found" });
				return listProjectCommands(db, params.id);
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				response: {
					200: ProjectCommandsResponseSchema,
					404: ErrorResponse,
				},
			},
		)
		.put(
			"/:id/commands",
			async ({ params, body, status }) => {
				const project = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);
				if (!project[0]) return status(404, { error: "Project not found" });

				await withTransaction(db, async () => {
					await replaceProjectCommands(db, params.id, body.commands);
					await db
						.update(projects)
						.set({ updatedAt: new Date() })
						.where(eq(projects.id, params.id));
				});

				return listProjectCommands(db, params.id);
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: ProjectCommandsBody,
				response: {
					200: ProjectCommandsResponseSchema,
					404: ErrorResponse,
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
		.patch(
			"/:id",
			async ({ params, body, status }) => {
				const current = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);
				if (!current[0]) return status(404, { error: "Project not found" });

				const updates: Record<string, unknown> = { updatedAt: new Date() };

				if (body.name !== undefined) {
					const name = normalizeProjectName(body.name);
					if (!name)
						return status(400, { error: "Name must contain at least one alphanumeric character" });

					if (name !== current[0].name) {
						const existing = await db
							.select()
							.from(projects)
							.where(eq(projects.name, name))
							.limit(1);
						if (existing[0]) return status(409, { error: `Project "${name}" already exists` });
					}

					updates.name = name;
				}

				if (body.description !== undefined) updates.description = body.description || null;
				if (body.stack !== undefined)
					updates.stack = body.stack.length ? JSON.stringify(body.stack) : null;
				if (body.permission !== undefined) updates.permission = body.permission;

				const result = await db
					.update(projects)
					.set(updates)
					.where(eq(projects.id, params.id))
					.returning();

				return result[0];
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: ProjectPatchBody,
				response: {
					200: projectSelectSchema,
					400: ErrorResponse,
					404: ErrorResponse,
					409: ErrorResponse,
				},
			},
		)
		.put(
			"/:id/composition",
			async ({ params, body, status }) => {
				const current = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);
				if (!current[0]) return status(404, { error: "Project not found" });

				const name = normalizeProjectName(body.name);
				if (!name)
					return status(400, { error: "Name must contain at least one alphanumeric character" });

				if (name !== current[0].name) {
					const existing = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
					if (existing[0]) return status(409, { error: `Project "${name}" already exists` });
				}

				const memoryIds = uniqueMemoryIds(body.memoryIds);
				const missing = await getUnavailableMemoryIds(db, memoryIds);
				if (missing.length > 0) {
					return status(400, {
						error: `Cannot associate missing or locked memories: ${missing.join(", ")}`,
					});
				}

				await withTransaction(db, async () => {
					await db
						.update(projects)
						.set({
							name,
							description: body.description || null,
							stack: body.stack.length ? JSON.stringify(body.stack) : null,
							permission: body.permission,
							updatedAt: new Date(),
						})
						.where(eq(projects.id, params.id));

					await db
						.delete(rules)
						.where(
							and(eq(rules.projectId, params.id), inArray(rules.kind, ["convention", "gotcha"])),
						);

					if (body.rules.length > 0) {
						await db.insert(rules).values(
							body.rules.map((rule, sortOrder) => ({
								devModeId: null,
								projectId: params.id,
								kind: rule.kind,
								statement: rule.statement,
								rationale: rule.rationale ?? null,
								severity: rule.severity,
								permission: rule.permission,
								example: rule.example ?? null,
								sortOrder,
								createdAt: new Date(),
								updatedAt: new Date(),
							})),
						);
					}

					await replaceProjectMemoryAssociations(db, params.id, memoryIds);
					await replaceProjectCommands(db, params.id, body.commands);
				});

				const result = await getEnrichedProject(db, params.id);
				if (!result) return status(404, { error: "Project not found" });
				return result;
			},
			{
				params: z.object({ id: z.coerce.number().int() }),
				body: ProjectCompositionBody,
				response: {
					200: ProjectEnrichedResponseSchema,
					400: ErrorResponse,
					404: ErrorResponse,
					409: ErrorResponse,
				},
			},
		)
		.post(
			"/:id/activate",
			async ({ params, status }) => {
				const result = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);

				if (!result.length) return status(404, { error: "Project not found" });

				await db
					.update(activeState)
					.set({ activeProjectId: params.id, updatedAt: new Date() })
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
					.set({ activeProjectId: null, updatedAt: new Date() })
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
					.delete(projects)
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
