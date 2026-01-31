import { tool } from "@opencode-ai/plugin";
import { sql, eq, desc } from "drizzle-orm";

import {
	type MinniDB,
	getActiveProject,
	resolveProject,
	validateEnum,
	TASK_PRIORITIES,
	TASK_STATUSES,
} from "../helpers";
import { projects, tasks } from "../schema";

/**
 * Creates task-related tools: minni_task
 */
export function taskTools(db: MinniDB) {
	return {
		minni_task: tool({
			description:
				"CRUD work items. For knowledge → minni_save. Output: `[T{id}] {title} — {status}`",
			args: {
				action: tool.schema.enum(["get", "create", "update", "delete", "list"]),
				id: tool.schema.number().optional().describe("For get/update/delete"),
				project: tool.schema.string().optional().describe("Default: active project"),
				parent_id: tool.schema.number().optional().describe("Creates subtask under parent"),
				title: tool.schema.string().optional().describe("For create"),
				description: tool.schema.string().optional(),
				priority: tool.schema
					.enum(["high", "medium", "low"])
					.optional()
					.describe("Default: medium"),
				status: tool.schema.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
			},
			async execute(args) {
				if (args.priority) {
					const err = validateEnum(args.priority, TASK_PRIORITIES, "priority");
					if (err) return err;
				}
				if (args.status) {
					const err = validateEnum(args.status, TASK_STATUSES, "status");
					if (err) return err;
				}

				if (args.action === "create") {
					if (!args.title) return "Title is required.";

					let derivedProjectId: number | null = null;

					if (args.parent_id) {
						// Subtask: inherit project from parent
						const parent = await db
							.select()
							.from(tasks)
							.where(eq(tasks.id, args.parent_id))
							.limit(1);
						if (!parent[0]) return `Parent task ${args.parent_id} not found.`;
						derivedProjectId = parent[0].projectId;
					} else if (args.project) {
						// Explicit project
						const proj = await resolveProject(db, args.project);
						if (!proj) return `Project "${args.project}" not found.`;
						derivedProjectId = proj.id;
					} else {
						// Use active project if any
						const active = await getActiveProject(db);
						derivedProjectId = active?.id ?? null;
					}

					const result = await db
						.insert(tasks)
						.values({
							projectId: derivedProjectId,
							parentId: args.parent_id ?? null,
							title: args.title,
							description: args.description ?? null,
							priority: args.priority ?? "medium",
							createdAt: new Date(),
							updatedAt: new Date(),
						})
						.returning({ id: tasks.id });
					return `Task created: [T${result[0].id}] ${args.title} (${args.priority ?? "medium"})`;
				}

				if (args.action === "update") {
					if (!args.id) return "Task ID is required.";
					const task = await db.select().from(tasks).where(eq(tasks.id, args.id)).limit(1);
					if (!task[0]) return `Task ${args.id} not found.`;
					const updates: Record<string, unknown> = { updatedAt: new Date() };
					if (args.title) updates.title = args.title;
					if (args.description) updates.description = args.description;
					if (args.priority) updates.priority = args.priority;
					if (args.status) updates.status = args.status;
					await db.update(tasks).set(updates).where(eq(tasks.id, args.id));
					return `Task updated: [T${args.id}]`;
				}

				if (args.action === "delete") {
					if (!args.id) return "Task ID is required.";
					const task = await db.select().from(tasks).where(eq(tasks.id, args.id)).limit(1);
					if (!task[0]) return `Task ${args.id} not found.`;
					await db.delete(tasks).where(eq(tasks.id, args.id));
					return `Deleted: [T${args.id}] ${task[0].title}`;
				}

				if (args.action === "get") {
					if (!args.id) return "Task ID is required.";
					const task = await db.select().from(tasks).where(eq(tasks.id, args.id)).limit(1);
					if (!task[0]) return `Task ${args.id} not found.`;

					const lines: string[] = [
						`## [T${task[0].id}] ${task[0].title}`,
						`Priority: ${task[0].priority}`,
						`Status: ${task[0].status}`,
					];

					if (task[0].projectId) {
						const proj = await db
							.select()
							.from(projects)
							.where(eq(projects.id, task[0].projectId))
							.limit(1);
						if (proj[0]) lines.push(`Project: ${proj[0].name}`);
					}

					if (task[0].parentId) {
						const parent = await db
							.select()
							.from(tasks)
							.where(eq(tasks.id, task[0].parentId))
							.limit(1);
						if (parent[0]) lines.push(`Parent: [T${parent[0].id}] ${parent[0].title}`);
					}

					// Show subtasks if any
					const subtasks = await db
						.select()
						.from(tasks)
						.where(eq(tasks.parentId, task[0].id))
						.orderBy(desc(tasks.createdAt));
					if (subtasks.length > 0) {
						lines.push(`\n### Subtasks (${subtasks.length})`);
						for (const st of subtasks) {
							lines.push(`- [T${st.id}] ${st.title} — ${st.status}`);
						}
					}

					if (task[0].description) {
						lines.push(`\n---\n\n${task[0].description}`);
					}

					return lines.join("\n");
				}

				if (args.action === "list") {
					const proj = await resolveProject(db, args.project);

					type TaskRow = {
						id: number;
						title: string;
						priority: string;
						status: string;
						parentId: number | null;
					};

					let all: TaskRow[];

					if (args.parent_id) {
						// List subtasks of a specific parent
						all = await db
							.select()
							.from(tasks)
							.where(eq(tasks.parentId, args.parent_id))
							.orderBy(desc(tasks.createdAt));
					} else if (proj) {
						// List top-level tasks for project (parentId is null)
						all = await db
							.select()
							.from(tasks)
							.where(sql`${tasks.projectId} = ${proj.id} AND ${tasks.parentId} IS NULL`)
							.orderBy(desc(tasks.createdAt));
					} else {
						// List all top-level tasks
						all = await db
							.select()
							.from(tasks)
							.where(sql`${tasks.parentId} IS NULL`)
							.orderBy(desc(tasks.createdAt))
							.limit(20);
					}

					if (all.length === 0) return "No tasks.";
					return all
						.map((t) => `[T${t.id}] [${t.priority.toUpperCase()}] ${t.title} — ${t.status}`)
						.join("\n");
				}

				return "Unknown action. Use: get, create, update, delete, list";
			},
		}),
	};
}
