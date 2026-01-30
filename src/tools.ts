import { tool } from "@opencode-ai/plugin";
import { sql, count, eq, and, desc } from "drizzle-orm";

import { getViewerPort } from "../viewer/server";
import {
	type MinniDB,
	type ToolContext,
	getActiveProject,
	setActiveProject,
	resolveProject,
	normalizeProjectName,
	saveTags,
	savePathSegments,
	validateEnum,
	guardedAction,
	MEMORY_TYPES,
	MEMORY_STATUSES,
	MEMORY_PERMISSIONS,
	PROJECT_STATUSES,
	TASK_PRIORITIES,
	TASK_STATUSES,
} from "./helpers";
import { projects, memories, tasks, memoryTags, memoryPaths, globalContext } from "./schema";

/**
 * Creates all Minni tools bound to a specific database instance.
 * Called once during plugin initialization.
 */
export function createTools(db: MinniDB) {
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
					return result.ok ? result.result : result.error;
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
					return result.ok ? result.result : result.error;
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

		minni_ping: tool({
			description: "DB health check + stats",
			args: {},
			async execute() {
				const memoryCount = await db.select({ total: count() }).from(memories);
				const projectCount = await db.select({ total: count() }).from(projects);
				const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);
				const active = getActiveProject();

				const lines = [
					"Minni DB: Connected",
					`Projects: ${projectCount[0].total}`,
					`Memories: ${memoryCount[0].total}`,
					`Identity: ${ctx[0]?.identity ? "configured" : "not set"}`,
					`Preferences: ${ctx[0]?.preferences ? "custom" : "defaults"}`,
					active ? `Active project: ${active.name}` : "Mode: Global",
				];

				return lines.join("\n");
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
					.where(and(eq(tasks.projectId, proj[0].id), eq(tasks.status, "in_progress")))
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

		minni_find: tool({
			description:
				"Search memories by title/content/tags/path. For tasks → minni_task. Output: `[{id}] [{type}] {title}`",
			args: {
				query: tool.schema.string().optional().describe("Omit to list all"),
				type: tool.schema
					.enum([
						"skill",
						"pattern",
						"anti_pattern",
						"decision",
						"insight",
						"comparison",
						"note",
						"link",
						"article",
						"video",
						"documentation",
					])
					.optional(),
			},
			async execute(args) {
				const activeProj = getActiveProject();

				type MemoryRow = {
					id: number;
					type: string;
					title: string;
					path: string | null;
					status: string;
					project_id: number | null;
					project_name: string | null;
				};

				const formatRow = (m: MemoryRow) =>
					`[${m.id}] [${m.type}] ${m.title}${m.path ? ` (${m.path})` : ""} — ${m.status}`;

				// Build search query function
				const searchMemories = async (
					scopeCondition: ReturnType<typeof sql> | null,
				): Promise<MemoryRow[]> => {
					if (args.query) {
						const q = `%${args.query}%`;
						const qNorm = args.query.toLowerCase().trim();

						return db.all<MemoryRow>(sql`
							SELECT DISTINCT m.id, m.type, m.title, m.path, m.status,
								m.project_id, p.name as project_name
							FROM memories m
							LEFT JOIN projects p ON m.project_id = p.id
							LEFT JOIN memory_paths mp ON m.id = mp.memory_id
							LEFT JOIN memory_tags mt ON m.id = mt.memory_id
							LEFT JOIN tags t ON mt.tag_id = t.id
							WHERE m.permission != 'locked'
								${scopeCondition ? sql`AND ${scopeCondition}` : sql``}
								${args.type ? sql`AND m.type = ${args.type}` : sql``}
								AND (
									m.title LIKE ${q}
									OR m.content LIKE ${q}
									OR mp.segment = ${qNorm}
									OR t.name = ${qNorm}
								)
							ORDER BY m.updated_at DESC
							LIMIT 20
						`);
					} else {
						const conditions = [sql`m.permission != 'locked'`];
						if (scopeCondition) conditions.push(scopeCondition);
						if (args.type) conditions.push(sql`m.type = ${args.type}`);

						return db.all<MemoryRow>(sql`
							SELECT m.id, m.type, m.title, m.path, m.status,
								m.project_id, p.name as project_name
							FROM memories m
							LEFT JOIN projects p ON m.project_id = p.id
							WHERE ${sql.join(conditions, sql` AND `)}
							ORDER BY m.updated_at DESC
							LIMIT 20
						`);
					}
				};

				// No active project: single query, everything
				if (!activeProj) {
					const results = await searchMemories(null);
					if (!results || results.length === 0) return "No memories found.";
					return results.map(formatRow).join("\n");
				}

				// With active project: two queries
				const [projectResults, netherResults] = await Promise.all([
					searchMemories(sql`m.project_id = ${activeProj.id}`),
					searchMemories(sql`(m.project_id IS NULL OR m.project_id != ${activeProj.id})`),
				]);

				const sections: string[] = [];

				if (projectResults.length > 0) {
					sections.push(`## In Project: ${activeProj.name} (${projectResults.length} matches)`);
					sections.push(projectResults.map(formatRow).join("\n"));
				}

				if (netherResults.length > 0) {
					sections.push(`\n## The Nether (${netherResults.length} matches)`);

					// Group by project (null = Global)
					// TODO: Add collapse_nether_results flag to show only counts per project
					const grouped = new Map<string, MemoryRow[]>();
					for (const m of netherResults) {
						const key = m.project_name ?? "Global";
						if (!grouped.has(key)) grouped.set(key, []);
						grouped.get(key)!.push(m);
					}

					// Sort: named projects first (alphabetically), Global last
					const sortedKeys = [...grouped.keys()].sort((a, b) => {
						if (a === "Global") return 1;
						if (b === "Global") return -1;
						return a.localeCompare(b);
					});

					for (const key of sortedKeys) {
						const memories = grouped.get(key)!;
						sections.push(`\n### ${key} (${memories.length})`);
						sections.push(memories.map(formatRow).join("\n"));
					}
				}

				if (sections.length === 0) return "No memories found.";

				return sections.join("\n");
			},
		}),

		minni_get: tool({
			description: "Load memory by ID. For tasks → minni_task action:get",
			args: {
				id: tool.schema.number(),
			},
			async execute(args) {
				const mem = await db.select().from(memories).where(eq(memories.id, args.id)).limit(1);

				if (!mem[0]) return `Memory ${args.id} not found.`;
				if (mem[0].permission === "locked")
					return `Memory ${args.id} is locked. Use Minni Studio to access.`;

				const memTags = await db.all<{ name: string }>(sql`
          SELECT t.name FROM tags t
          JOIN memory_tags mt ON t.id = mt.tag_id
          WHERE mt.memory_id = ${args.id}
        `);
				const tagNames = memTags.map((t) => t.name);

				const lines: string[] = [`## [${mem[0].id}] ${mem[0].title}`, `Type: ${mem[0].type}`];
				if (mem[0].path) lines.push(`Path: ${mem[0].path}`);
				lines.push(`Status: ${mem[0].status}`);
				lines.push(`Permission: ${mem[0].permission}`);
				if (tagNames.length > 0) lines.push(`Tags: ${tagNames.join(", ")}`);
				lines.push(`\n---\n\n${mem[0].content}`);

				return lines.join("\n");
			},
		}),

		minni_save: tool({
			description:
				"Create memory (knowledge). For tasks → minni_task. Output: `[{id}] [{type}] {title}`",
			args: {
				type: tool.schema.enum([
					"skill",
					"pattern",
					"anti_pattern",
					"decision",
					"insight",
					"comparison",
					"note",
					"link",
					"article",
					"video",
					"documentation",
				]),
				title: tool.schema.string(),
				content: tool.schema.string(),
				path: tool.schema
					.string()
					.optional()
					.describe("e.g. 'Config -> Auth -> OAuth' or 'Cooking -> Sourdough -> Timing'"),
				project: tool.schema.string().optional().describe("Default: active project"),
				status: tool.schema
					.enum(["draft", "experimental", "proven", "battle_tested", "deprecated"])
					.optional()
					.describe("Default: draft"),
				permission: tool.schema
					.enum(["open", "guarded", "read_only"])
					.optional()
					.describe("Default: project setting or guarded"),
				tags: tool.schema.string().optional().describe("Comma-separated"),
			},
			async execute(args) {
				const typeErr = validateEnum(args.type, MEMORY_TYPES, "type");
				if (typeErr) return typeErr;
				if (args.status) {
					const statusErr = validateEnum(args.status, MEMORY_STATUSES, "status");
					if (statusErr) return statusErr;
				}
				if (args.permission) {
					const permErr = validateEnum(args.permission, MEMORY_PERMISSIONS, "permission");
					if (permErr) return permErr;
				}

				const proj = await resolveProject(db, args.project);

				// Permission cascade: explicit → project.defaultMemoryPermission → preferences → "guarded"
				type PermissionType = "open" | "guarded" | "read_only";
				let resolvedPermission: PermissionType | undefined = args.permission;
				if (!resolvedPermission && proj) {
					const fullProj = await db
						.select()
						.from(projects)
						.where(eq(projects.id, proj.id))
						.limit(1);
					resolvedPermission = fullProj[0]?.defaultMemoryPermission as PermissionType | undefined;
				}
				if (!resolvedPermission) {
					const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);
					if (ctx[0]?.preferences) {
						try {
							const prefs = JSON.parse(ctx[0].preferences);
							resolvedPermission = prefs?.memory?.defaultPermission as PermissionType | undefined;
						} catch {
							// Invalid JSON, ignore
						}
					}
				}
				const finalPermission: PermissionType = resolvedPermission ?? "guarded";

				// NOTE: createdAt/updatedAt passed explicitly. Turso driver (beta) ignores SQLite DEFAULT expressions
				const result = await db
					.insert(memories)
					.values({
						projectId: proj?.id ?? null,
						type: args.type,
						title: args.title,
						content: args.content,
						path: args.path ?? null,
						status: args.status ?? "draft",
						permission: finalPermission,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning({ id: memories.id });

				const memId = result[0].id;

				if (args.path) {
					await savePathSegments(db, memId, args.path);
				}

				if (args.tags) {
					const tagNames = args.tags
						.split(",")
						.map((t) => t.trim())
						.filter(Boolean);
					await saveTags(db, memId, tagNames);
				}

				return `Saved: [${memId}] [${args.type}] ${args.title}`;
			},
		}),

		minni_update: tool({
			description: "Update memory. Cannot change type/permission",
			args: {
				id: tool.schema.number(),
				title: tool.schema.string().optional(),
				content: tool.schema.string().optional(),
				path: tool.schema.string().optional(),
				status: tool.schema
					.enum(["draft", "experimental", "proven", "battle_tested", "deprecated"])
					.optional(),
				tags: tool.schema.string().optional().describe("Replaces existing tags"),
			},
			async execute(args, context) {
				const mem = await db.select().from(memories).where(eq(memories.id, args.id)).limit(1);

				if (!mem[0]) return `Memory ${args.id} not found.`;

				if (args.status) {
					const statusErr = validateEnum(args.status, MEMORY_STATUSES, "status");
					if (statusErr) return statusErr;
				}

				const result = await guardedAction(
					context as ToolContext,
					{ id: mem[0].id, name: mem[0].title, type: "memory", permission: mem[0].permission },
					"update",
					async () => {
						const updates: Record<string, unknown> = { updatedAt: new Date() };
						if (args.title) updates.title = args.title;
						if (args.content) updates.content = args.content;
						if (args.path) updates.path = args.path;
						if (args.status) updates.status = args.status;

						await db.update(memories).set(updates).where(eq(memories.id, args.id));

						if (args.path) {
							await db.delete(memoryPaths).where(eq(memoryPaths.memoryId, args.id));
							await savePathSegments(db, args.id, args.path);
						}

						if (args.tags) {
							await db.delete(memoryTags).where(eq(memoryTags.memoryId, args.id));
							const tagNames = args.tags
								.split(",")
								.map((t) => t.trim())
								.filter(Boolean);
							await saveTags(db, args.id, tagNames);
						}

						return `Updated: [${args.id}] ${args.title ?? mem[0].title}`;
					},
				);

				return result.ok ? result.result : result.error;
			},
		}),

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
						const active = getActiveProject();
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
							.where(and(eq(tasks.projectId, proj.id), sql`${tasks.parentId} IS NULL`))
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

		minni_delete: tool({
			description: "Delete memory. Respects permissions",
			args: {
				id: tool.schema.number(),
			},
			async execute(args, context) {
				const mem = await db.select().from(memories).where(eq(memories.id, args.id)).limit(1);

				if (!mem[0]) return `Memory ${args.id} not found.`;

				const result = await guardedAction(
					context as ToolContext,
					{ id: mem[0].id, name: mem[0].title, type: "memory", permission: mem[0].permission },
					"delete",
					async () => {
						await db.delete(memoryTags).where(eq(memoryTags.memoryId, args.id));
						await db.delete(memoryPaths).where(eq(memoryPaths.memoryId, args.id));
						await db.delete(memories).where(eq(memories.id, args.id));
						return `Deleted: [${args.id}] ${mem[0].title}`;
					},
				);

				return result.ok ? result.result : result.error;
			},
		}),

		minni_summary: tool({
			description: "Save context summary for project or global",
			args: {
				summary: tool.schema.string(),
				project: tool.schema.string().optional().describe("Default: active project or global"),
			},
			async execute(args, context) {
				const resolved = await resolveProject(db, args.project);

				// No project = update global context
				if (!resolved) {
					await db
						.update(globalContext)
						.set({
							contextSummary: args.summary,
							contextUpdatedAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(globalContext.id, 1));
					return "Global context updated.";
				}

				// Get full project with permission
				const proj = await db.select().from(projects).where(eq(projects.id, resolved.id)).limit(1);
				if (!proj[0]) return "Project not found.";

				const result = await guardedAction(
					context as ToolContext,
					{ id: proj[0].id, name: proj[0].name, type: "project", permission: proj[0].permission },
					"update",
					async () => {
						await db
							.update(projects)
							.set({
								contextSummary: args.summary,
								contextUpdatedAt: new Date(),
								updatedAt: new Date(),
							})
							.where(eq(projects.id, proj[0].id));
						return `Context updated for ${proj[0].name}`;
					},
				);

				return result.ok ? result.result : result.error;
			},
		}),

		minni_canvas: tool({
			description: "Send markdown to Minni Viewer. Output: viewer URL",
			args: {
				content: tool.schema.string(),
				action: tool.schema
					.enum(["show", "open", "save"])
					.optional()
					.describe("show=default, open=launch browser"),
			},
			async execute(args) {
				const action = args.action ?? "show";
				const viewerPort = getViewerPort();

				if (!viewerPort) {
					return "Minni Viewer is not running. Restart OpenCode to start the viewer.";
				}

				const viewerUrl = `http://localhost:${viewerPort}`;

				// Send content to viewer
				try {
					const response = await fetch(`${viewerUrl}/canvas/push`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ content: args.content }),
					});

					if (!response.ok) {
						return `Failed to send to canvas: ${response.statusText}. Is the viewer running?`;
					}

					await response.json();

					if (action === "open") {
						// Open browser - works on Linux (xdg-open), macOS (open), Windows (start)
						const { platform } = process;
						const cmd =
							platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
						Bun.spawn([cmd, viewerUrl]);
					}

					if (action === "save") {
						// TODO: Implement save to memory
						return `Content sent to canvas (${args.content.length} chars). Save to memory: coming soon. View at ${viewerUrl}`;
					}

					return `Content sent to canvas (${args.content.length} chars). View at ${viewerUrl}`;
				} catch (e) {
					return `Error connecting to viewer at ${viewerUrl}: ${e instanceof Error ? e.message : String(e)}. Make sure OpenCode started the Minni plugin.`;
				}
			},
		}),
	};
}
