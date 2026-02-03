/**
 * Database API handlers for the viewer.
 */

import { desc, eq, sql, count } from "drizzle-orm";

import type { MinniDB } from "../helpers";

import { projects, memories, tasks } from "../schema";

// === Handlers ===

export async function handleStats(db: MinniDB): Promise<Response> {
	const [m, p, t] = await Promise.all([
		db.select({ total: count() }).from(memories),
		db
			.select({ total: count() })
			.from(projects)
			.where(sql`status != 'deleted'`),
		db.select({ total: count() }).from(tasks),
	]);

	return Response.json({
		memories: m[0].total,
		projects: p[0].total,
		tasks: t[0].total,
	});
}

export async function handleProjects(db: MinniDB): Promise<Response> {
	const result = await db
		.select()
		.from(projects)
		.where(sql`status != 'deleted'`)
		.orderBy(desc(projects.updatedAt));

	return Response.json(result);
}

export async function handleProject(db: MinniDB, id: number): Promise<Response> {
	const result = await db
		.select()
		.from(projects)
		.where(eq(projects.id, id))
		.limit(1);

	if (!result.length) {
		return Response.json({ error: "Project not found" }, { status: 404 });
	}

	return Response.json(result[0]);
}

export async function handleMemories(db: MinniDB, url: URL): Promise<Response> {
	const projectIdParam = url.searchParams.get("project");
	const limitParam = url.searchParams.get("limit");
	const limit = limitParam ? parseInt(limitParam, 10) : 50;

	const safeLimit = Math.min(Math.max(1, limit), 100);

	const baseQuery = db
		.select()
		.from(memories)
		.where(sql`permission != 'locked'`)
		.orderBy(desc(memories.updatedAt))
		.limit(safeLimit);

	if (projectIdParam) {
		const projectId = parseInt(projectIdParam, 10);
		if (!Number.isNaN(projectId)) {
			const result = await db
				.select()
				.from(memories)
				.where(sql`permission != 'locked' AND project_id = ${projectId}`)
				.orderBy(desc(memories.updatedAt))
				.limit(safeLimit);
			return Response.json(result);
		}
	}

	return Response.json(await baseQuery);
}

export async function handleMemory(db: MinniDB, id: number): Promise<Response> {
	const result = await db
		.select()
		.from(memories)
		.where(eq(memories.id, id))
		.limit(1);

	if (!result.length) {
		return Response.json({ error: "Memory not found" }, { status: 404 });
	}

	return Response.json(result[0]);
}

export async function handleTask(db: MinniDB, id: number): Promise<Response> {
	const result = await db
		.select()
		.from(tasks)
		.where(eq(tasks.id, id))
		.limit(1);

	if (!result.length) {
		return Response.json({ error: "Task not found" }, { status: 404 });
	}

	return Response.json(result[0]);
}

export async function handleTasks(db: MinniDB, url: URL): Promise<Response> {
	const projectIdParam = url.searchParams.get("project");
	const limitParam = url.searchParams.get("limit");
	const limit = limitParam ? parseInt(limitParam, 10) : 50;

	const safeLimit = Math.min(Math.max(1, limit), 100);

	if (projectIdParam) {
		const projectId = parseInt(projectIdParam, 10);
		if (!Number.isNaN(projectId)) {
			const result = await db
				.select()
				.from(tasks)
				.where(eq(tasks.projectId, projectId))
				.orderBy(desc(tasks.updatedAt))
				.limit(safeLimit);
			return Response.json(result);
		}
	}

	const result = await db.select().from(tasks).orderBy(desc(tasks.updatedAt)).limit(safeLimit);
	return Response.json(result);
}
