import { tool } from "@opencode-ai/plugin";
import { sql, eq, desc, count } from "drizzle-orm";

import {
	type MinniDB,
	type ToolContext,
	setActiveProject,
	normalizeProjectName,
	validateEnum,
	guardedAction,
} from "../helpers";
import {
	projects,
	memories,
	tasks,
	PERMISSION,
	WRITABLE_PROJECT_STATUS,
	type ProjectStatus,
	type Permission,
} from "../schema";

/**
 * Creates project tool: minni_project (create, update, delete, list, load)
 */
export function projectTools(db: MinniDB) {
	return {
		minni_project: tool({
			description:
				"CRUD projects. Output: `[P{id}] {name} — {status}`. Use action load to switch project context.",
			args: {
				action: tool.schema.enum(["create", "update", "delete", "list", "load"]),
				name: tool.schema
					.string()
					.optional()
					.describe("Required for create/update/delete/load. Normalized to lowercase + hyphens."),
				description: tool.schema.string().optional(),
				stack: tool.schema
					.string()
					.optional()
					.describe("Comma-separated, e.g. 'TanStack Start, ElysiaJS, Bun'"),
				status: tool.schema.enum(["active", "paused", "completed", "archived"]).optional(),
				permission: tool.schema
					.enum(["open", "guarded", "read_only", "locked"])
					.optional()
					.describe("Default: guarded"),
				default_memory_permission: tool.schema
					.enum(["open", "guarded", "read_only", "locked"])
					.optional()
					.describe("Inherited by new memories. Default: guarded"),
			},
			async execute(args, context) {
				if (args.action === "load") return handleLoad(db, args);
				if (args.action === "create") return handleCreate(db, args);
				if (args.action === "update") return handleUpdate(db, context, args);
				if (args.action === "delete") return handleDelete(db, context, args);
				if (args.action === "list") return handleList(db);

				return "Unknown action. Use: create, update, delete, list, load";
			},
		}),
	};
}

// ============================================================================
// LOAD
// ============================================================================

type LoadArgs = { name?: string };

async function handleLoad(db: MinniDB, args: LoadArgs): Promise<string> {
	// No name = global mode
	if (!args.name) {
		await setActiveProject(db, null);

		const projectList = await db
			.select()
			.from(projects)
			.where(sql`${projects.status} != 'deleted'`)
			.orderBy(desc(projects.updatedAt))
			.limit(10);

		const globalMemoryCount = await db
			.select({ total: count() })
			.from(memories)
			.where(sql`${memories.projectId} IS NULL`);

		const sections: string[] = ["## Global Mode\n"];
		sections.push(`Global memories: ${globalMemoryCount[0].total}`);
		sections.push(`Projects: ${projectList.length}`);

		if (projectList.length > 0) {
			sections.push("\n### Available Projects");
			for (const p of projectList) {
				sections.push(`- [P${p.id}] ${p.name} — ${p.status}`);
			}
		}

		return sections.join("\n");
	}

	// With name = switch to project
	const projectName = normalizeProjectName(args.name);
	const proj = await db.select().from(projects).where(eq(projects.name, projectName)).limit(1);

	if (!proj[0]) return `Project "${projectName}" not found. Use action: create.`;
	if (proj[0].status === "deleted") {
		return `Project "${projectName}" has been deleted. Restore via Minni Studio.`;
	}

	await setActiveProject(db, { id: proj[0].id, name: proj[0].name });

	const [memoryCounts, taskCounts, activeTask] = await Promise.all([
		db
			.select({ type: memories.type, total: count() })
			.from(memories)
			.where(eq(memories.projectId, proj[0].id))
			.groupBy(memories.type),
		db
			.select({ status: tasks.status, total: count() })
			.from(tasks)
			.where(eq(tasks.projectId, proj[0].id))
			.groupBy(tasks.status),
		db
			.select()
			.from(tasks)
			.where(sql`${tasks.projectId} = ${proj[0].id} AND ${tasks.status} = 'in_progress'`)
			.limit(1),
	]);

	const sections: string[] = [];

	// Header
	sections.push(`## ${proj[0].name} — ${proj[0].status}`);
	if (proj[0].description) sections.push(proj[0].description);
	if (proj[0].stack) {
		try {
			sections.push(`Stack: ${JSON.parse(proj[0].stack).join(", ")}`);
		} catch {
			sections.push(`Stack: ${proj[0].stack}`);
		}
	}
	sections.push(`Permission: ${proj[0].permission}`);

	// Active task
	if (activeTask[0]) {
		sections.push(
			`\nActive: [T${activeTask[0].id}] ${activeTask[0].title} (${activeTask[0].priority})`,
		);
	}

	// Inventory
	const memParts = memoryCounts.map((c) => `${c.total} ${c.type}`);
	const todo = taskCounts.find((c) => c.status === "todo")?.total ?? 0;
	const wip = taskCounts.find((c) => c.status === "in_progress")?.total ?? 0;
	const done = taskCounts.find((c) => c.status === "done")?.total ?? 0;
	const totalTasks = taskCounts.reduce((sum, c) => sum + c.total, 0);

	const inventoryParts: string[] = [];
	if (memParts.length > 0) inventoryParts.push(memParts.join(", "));
	if (totalTasks > 0) inventoryParts.push(`${totalTasks}T(${todo}/${wip}/${done})`);

	if (inventoryParts.length > 0) {
		sections.push(`Inventory: ${inventoryParts.join(" | ")}`);
	}

	return sections.join("\n");
}

// ============================================================================
// CREATE
// ============================================================================

type CreateArgs = {
	name?: string;
	description?: string;
	stack?: string;
	status?: string;
	permission?: string;
	default_memory_permission?: string;
};

async function handleCreate(db: MinniDB, args: CreateArgs): Promise<string> {
	if (!args.name) return "Name is required.";
	const name = normalizeProjectName(args.name);
	if (!name) return "Name must contain at least one alphanumeric character.";

	if (args.status) {
		const err = validateEnum(args.status, WRITABLE_PROJECT_STATUS, "status");
		if (err) return err;
	}
	if (args.permission) {
		const err = validateEnum(args.permission, PERMISSION, "permission");
		if (err) return err;
	}
	if (args.default_memory_permission) {
		const err = validateEnum(
			args.default_memory_permission,
			PERMISSION,
			"default_memory_permission",
		);
		if (err) return err;
	}

	const existing = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
	if (existing[0]) return `Project "${name}" already exists. Use action: update.`;

	const stackJson = args.stack ? JSON.stringify(args.stack.split(",").map((s) => s.trim())) : null;

	const result = await db
		.insert(projects)
		.values({
			// TODO [T70]: Same overload issue as memory.ts — OpenCode's tool.schema.enum()
			// resolves to `string`, not the literal union Drizzle expects. Values are
			// validated via validateEnum() before this point. Will look for a solution.
			name,
			description: args.description ?? null,
			stack: stackJson,
			status: (args.status ?? "active") as ProjectStatus,
			permission: (args.permission ?? "guarded") as Permission,
			defaultMemoryPermission: (args.default_memory_permission ?? "guarded") as Permission,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning({ id: projects.id });

	return `Project created: [P${result[0].id}] ${name}`;
}

// ============================================================================
// UPDATE
// ============================================================================

type UpdateArgs = {
	name?: string;
	description?: string;
	stack?: string;
	status?: string;
	permission?: string;
	default_memory_permission?: string;
};

async function handleUpdate(db: MinniDB, context: unknown, args: UpdateArgs): Promise<string> {
	if (!args.name) return "Name is required to identify the project.";

	if (args.status) {
		const err = validateEnum(args.status, WRITABLE_PROJECT_STATUS, "status");
		if (err) return err;
	}
	if (args.permission) {
		const err = validateEnum(args.permission, PERMISSION, "permission");
		if (err) return err;
	}
	if (args.default_memory_permission) {
		const err = validateEnum(
			args.default_memory_permission,
			PERMISSION,
			"default_memory_permission",
		);
		if (err) return err;
	}

	const name = normalizeProjectName(args.name);
	const proj = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
	if (!proj[0]) return `Project "${name}" not found.`;

	const result = await guardedAction(
		db,
		context as ToolContext,
		{ id: proj[0].id, name: proj[0].name, type: "project", permission: proj[0].permission },
		"update",
		async () => {
			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (args.description) updates.description = args.description;
			if (args.stack) updates.stack = JSON.stringify(args.stack.split(",").map((s) => s.trim()));
			if (args.status) updates.status = args.status;
			if (args.permission) updates.permission = args.permission;
			if (args.default_memory_permission)
				updates.defaultMemoryPermission = args.default_memory_permission;
			await db.update(projects).set(updates).where(eq(projects.id, proj[0].id));
			return `Project updated: ${name}`;
		},
	);

	return result.isOk() ? result.value : result.error;
}

// ============================================================================
// DELETE
// ============================================================================

type DeleteArgs = { name?: string };

async function handleDelete(db: MinniDB, context: unknown, args: DeleteArgs): Promise<string> {
	if (!args.name) return "Name is required to identify the project.";
	const name = normalizeProjectName(args.name);
	const proj = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
	if (!proj[0]) return `Project "${name}" not found.`;

	const result = await guardedAction(
		db,
		context as ToolContext,
		{ id: proj[0].id, name: proj[0].name, type: "project", permission: proj[0].permission },
		"delete",
		async () => {
			await db
				.update(projects)
				.set({ status: "deleted", updatedAt: new Date() })
				.where(eq(projects.id, proj[0].id));
			return `Project soft-deleted: ${name} (status set to 'deleted'). Hard delete via Minni Studio.`;
		},
	);

	return result.isOk() ? result.value : result.error;
}

// ============================================================================
// LIST
// ============================================================================

async function handleList(db: MinniDB): Promise<string> {
	const all = await db
		.select()
		.from(projects)
		.where(sql`${projects.status} != 'deleted'`)
		.orderBy(desc(projects.updatedAt));

	if (all.length === 0) return "No projects.";
	return all.map((p) => `[P${p.id}] ${p.name} — ${p.status}`).join("\n");
}
