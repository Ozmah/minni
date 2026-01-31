import { tool } from "@opencode-ai/plugin";
import { sql, eq, desc, count } from "drizzle-orm";

import {
	type MinniDB,
	type ToolContext,
	setActiveProject,
	normalizeProjectName,
	validateEnum,
	guardedAction,
	MEMORY_PERMISSIONS,
	PROJECT_STATUSES,
} from "../helpers";
import { projects, memories, tasks, globalContext } from "../schema";

/**
 * Creates project-related tools: minni_project, minni_load
 */
export function projectTools(db: MinniDB) {
	return {
		minni_project: tool({
			description: "CRUD projects. Output: `[P{id}] {name} — {status}`",
			args: {
				action: tool.schema.enum(["create", "update", "delete", "list"]),
				name: tool.schema
					.string()
					.optional()
					.describe("Required for create/update/delete. Normalized to lowercase + hyphens"),
				description: tool.schema.string().optional(),
				stack: tool.schema
					.string()
					.optional()
					.describe(
						"Comma-separated, e.g. 'TanStack Start, ElysiaJS, Bun' or 'Dutch Oven, Stand Mixer' or 'Stethoscope, Otoscope, EKG'",
					),
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
				if (args.action === "create") {
					if (!args.name) return "Name is required.";
					const name = normalizeProjectName(args.name);
					if (!name) return "Name must contain at least one alphanumeric character.";
					if (args.status) {
						const err = validateEnum(args.status, PROJECT_STATUSES, "status");
						if (err) return err;
					}
					if (args.permission) {
						const err = validateEnum(args.permission, MEMORY_PERMISSIONS, "permission");
						if (err) return err;
					}
					if (args.default_memory_permission) {
						const err = validateEnum(
							args.default_memory_permission,
							MEMORY_PERMISSIONS,
							"default_memory_permission",
						);
						if (err) return err;
					}
					const existing = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
					if (existing[0]) return `Project "${name}" already exists. Use action: update.`;

					const stackJson = args.stack
						? JSON.stringify(args.stack.split(",").map((s) => s.trim()))
						: null;

					// NOTE: createdAt/updatedAt passed explicitly. Turso driver (beta) ignores SQLite DEFAULT expressions
					const result = await db
						.insert(projects)
						.values({
							name,
							description: args.description ?? null,
							stack: stackJson,
							status: args.status ?? "active",
							permission: args.permission ?? "guarded",
							defaultMemoryPermission: args.default_memory_permission ?? "guarded",
							createdAt: new Date(),
							updatedAt: new Date(),
						})
						.returning({ id: projects.id });
					return `Project created: [P${result[0].id}] ${name}`;
				}

				if (args.action === "update") {
					if (!args.name) return "Name is required to identify the project.";
					if (args.status) {
						const err = validateEnum(args.status, PROJECT_STATUSES, "status");
						if (err) return err;
					}
					if (args.permission) {
						const err = validateEnum(args.permission, MEMORY_PERMISSIONS, "permission");
						if (err) return err;
					}
					if (args.default_memory_permission) {
						const err = validateEnum(
							args.default_memory_permission,
							MEMORY_PERMISSIONS,
							"default_memory_permission",
						);
						if (err) return err;
					}
					const name = normalizeProjectName(args.name);
					const proj = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
					if (!proj[0]) return `Project "${name}" not found.`;

					const result = await guardedAction(
						context as ToolContext,
						{ id: proj[0].id, name: proj[0].name, type: "project", permission: proj[0].permission },
						"update",
						async () => {
							const updates: Record<string, unknown> = { updatedAt: new Date() };
							if (args.description) updates.description = args.description;
							if (args.stack)
								updates.stack = JSON.stringify(args.stack.split(",").map((s) => s.trim()));
							if (args.status) updates.status = args.status;
							if (args.permission) updates.permission = args.permission;
							if (args.default_memory_permission)
								updates.defaultMemoryPermission = args.default_memory_permission;
							await db.update(projects).set(updates).where(eq(projects.id, proj[0].id));
							return `Project updated: ${name}`;
						},
					);
					return result.ok ? result.value : result.error;
				}

				if (args.action === "delete") {
					if (!args.name) return "Name is required to identify the project.";
					const name = normalizeProjectName(args.name);
					const proj = await db.select().from(projects).where(eq(projects.name, name)).limit(1);
					if (!proj[0]) return `Project "${name}" not found.`;

					const result = await guardedAction(
						context as ToolContext,
						{
							id: proj[0].id,
							name: proj[0].name,
							type: "project",
							permission: proj[0].permission,
						},
						"delete",
						async () => {
							await db
								.update(projects)
								.set({ status: "deleted", updatedAt: new Date() })
								.where(eq(projects.id, proj[0].id));
							return `Project soft-deleted: ${name} (status set to 'deleted'). Hard delete via Minni Studio.`;
						},
					);
					return result.ok ? result.value : result.error;
				}

				if (args.action === "list") {
					const all = await db
						.select()
						.from(projects)
						.where(sql`${projects.status} != 'deleted'`)
						.orderBy(desc(projects.updatedAt));
					if (all.length === 0) return "No projects.";
					return all.map((p) => `[P${p.id}] ${p.name} — ${p.status}`).join("\n");
				}

				return "Unknown action. Use: create, update, delete, list";
			},
		}),

		minni_load: tool({
			description: "Load project context or exit to global mode. Output: briefing + inventory",
			args: {
				project: tool.schema.string().optional().describe("Omit to exit to global mode"),
			},
			async execute(args) {
				// No project = global mode
				if (!args.project) {
					await setActiveProject(db, null);

					const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);

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

					if (ctx[0]?.identity) {
						sections.push(`### Identity\n${ctx[0].identity}\n`);
					}

					if (ctx[0]?.contextSummary) {
						sections.push(`### Last Context\n${ctx[0].contextSummary}\n`);
					}

					sections.push(`### Inventory`);
					sections.push(`- Global memories: ${globalMemoryCount[0].total}`);
					sections.push(`- Projects: ${projectList.length}`);

					if (projectList.length > 0) {
						sections.push(`\n### Available Projects`);
						for (const p of projectList) {
							sections.push(`- [P${p.id}] ${p.name} — ${p.status}`);
						}
					}

					return sections.join("\n");
				}

				// With project = load project context
				const projectName = normalizeProjectName(args.project);
				const proj = await db
					.select()
					.from(projects)
					.where(eq(projects.name, projectName))
					.limit(1);

				if (!proj[0]) {
					return `Project "${projectName}" not found. Use minni_project to create it first.`;
				}

				if (proj[0].status === "deleted") {
					return `Project "${projectName}" has been deleted. Restore via Minni Studio.`;
				}

				await setActiveProject(db, { id: proj[0].id, name: proj[0].name });

				const memoryCounts = await db
					.select({ type: memories.type, total: count() })
					.from(memories)
					.where(eq(memories.projectId, proj[0].id))
					.groupBy(memories.type);

				const activeTask = await db
					.select()
					.from(tasks)
					.where(sql`${tasks.projectId} = ${proj[0].id} AND ${tasks.status} = 'in_progress'`)
					.limit(1);

				const taskCounts = await db
					.select({ status: tasks.status, total: count() })
					.from(tasks)
					.where(eq(tasks.projectId, proj[0].id))
					.groupBy(tasks.status);

				const sections: string[] = [];

				sections.push(`## ${proj[0].name} - Loaded\n`);

				if (proj[0].description) sections.push(proj[0].description);
				if (proj[0].stack) {
					try {
						sections.push(`Stack: ${JSON.parse(proj[0].stack).join(", ")}`);
					} catch {
						sections.push(`Stack: ${proj[0].stack}`);
					}
				}
				sections.push(`Status: ${proj[0].status}\n`);

				if (proj[0].contextSummary) {
					sections.push(`### Last Context\n${proj[0].contextSummary}\n`);
				}

				// Again, this is crap, needs to be worked on
				// Both the way projects are loaded and
				// the active task is handled, suck
				if (activeTask[0]) {
					const focus: string[] = ["### Active Focus"];
					focus.push(
						`► Task IN_PROGRESS: [T${activeTask[0].id}] ${activeTask[0].title} (${activeTask[0].priority})`,
					);
					sections.push(focus.join("\n") + "\n");
				}

				const inventory: string[] = ["### Inventory"];
				const totalMemories = memoryCounts.reduce((sum, c) => sum + c.total, 0);
				if (totalMemories > 0) {
					for (const c of memoryCounts) {
						inventory.push(`- ${c.type}: ${c.total}`);
					}
				} else {
					inventory.push("- Memories: 0");
				}

				const taskTotal = taskCounts.reduce((sum, c) => sum + c.total, 0);
				const pendingTasks = taskCounts.find((c) => c.status === "todo");
				inventory.push(
					`- Tasks: ${taskTotal}${pendingTasks ? ` (${pendingTasks.total} pending)` : ""}`,
				);
				sections.push(inventory.join("\n"));

				return sections.join("\n");
			},
		}),
	};
}
