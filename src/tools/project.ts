import { tool } from "@opencode-ai/plugin";
import { Result } from "better-result";
import { desc, eq } from "drizzle-orm";

import {
	type MinniDB,
	type ToolContext,
	guardedAction,
	normalizeProjectName,
	setActiveProject,
	validateEnum,
} from "../helpers";
import { PERMISSION, projects, type Permission } from "../schema";

export function projectTools(db: MinniDB) {
	return {
		minni_project: tool({
			description:
				"CRUD projects. Output: `[P{id}] {name}`. Use action load to switch project context.",
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
				permission: tool.schema
					.enum(["open", "guarded", "read_only", "locked"])
					.optional()
					.describe("Default: guarded"),
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

type LoadArgs = { name?: string };

async function handleLoad(db: MinniDB, args: LoadArgs): Promise<string> {
	if (!args.name) {
		await setActiveProject(db, null);

		const projectList = await db
			.select()
			.from(projects)
			.orderBy(desc(projects.updatedAt))
			.limit(10);
		const sections: string[] = ["## No Active Project\n", `Projects: ${projectList.length}`];

		if (projectList.length > 0) {
			sections.push("\n### Available Projects");
			for (const p of projectList) {
				sections.push(`- [P${p.id}] ${p.name}`);
			}
		}

		return sections.join("\n");
	}

	const projectName = normalizeProjectName(args.name);
	const proj = await db.select().from(projects).where(eq(projects.name, projectName)).limit(1);

	if (!proj[0]) return `Project "${projectName}" not found. Use action: create.`;

	await setActiveProject(db, { id: proj[0].id, name: proj[0].name });

	const sections: string[] = [`## ${proj[0].name}`];
	if (proj[0].description) sections.push(proj[0].description);
	if (proj[0].stack) {
		const parsed = Result.try(() => JSON.parse(proj[0].stack as string))
			.map((v: string[]) => v.join(", "))
			.unwrapOr(proj[0].stack);
		sections.push(`Stack: ${parsed}`);
	}
	sections.push(`Permission: ${proj[0].permission}`);

	return sections.join("\n");
}

type CreateArgs = {
	name?: string;
	description?: string;
	stack?: string;
	permission?: string;
};

async function handleCreate(db: MinniDB, args: CreateArgs): Promise<string> {
	if (!args.name) return "Name is required.";
	const name = normalizeProjectName(args.name);
	if (!name) return "Name must contain at least one alphanumeric character.";

	if (args.permission) {
		const err = validateEnum(args.permission, PERMISSION, "permission");
		if (err) return err;
	}

	const existing = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
	if (existing[0]) return `Project "${name}" already exists. Use action: update.`;

	const stackJson = args.stack ? JSON.stringify(args.stack.split(",").map((s) => s.trim())) : null;

	const result = await db
		.insert(projects)
		.values({
			name,
			description: args.description ?? null,
			stack: stackJson,
			permission: (args.permission ?? "guarded") as Permission,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning({ id: projects.id });

	return `Project created: [P${result[0].id}] ${name}`;
}

type UpdateArgs = {
	name?: string;
	description?: string;
	stack?: string;
	permission?: string;
};

async function handleUpdate(db: MinniDB, context: unknown, args: UpdateArgs): Promise<string> {
	if (!args.name) return "Name is required to identify the project.";
	if (args.permission) {
		const err = validateEnum(args.permission, PERMISSION, "permission");
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
			if (args.permission) updates.permission = args.permission;
			await db.update(projects).set(updates).where(eq(projects.id, proj[0].id));
			return `Project updated: ${name}`;
		},
	);

	return result.isOk() ? result.value : result.error;
}

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
			await db.delete(projects).where(eq(projects.id, proj[0].id));
			return `Project deleted: ${name}`;
		},
	);

	return result.isOk() ? result.value : result.error;
}

async function handleList(db: MinniDB): Promise<string> {
	const all = await db.select().from(projects).orderBy(desc(projects.updatedAt));

	if (all.length === 0) return "No projects.";
	return all.map((p) => `[P${p.id}] ${p.name}`).join("\n");
}
