import { tool } from "@opencode-ai/plugin";
import { sql, count, eq, and, desc, asc } from "drizzle-orm";

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
	GOAL_STATUSES,
} from "./helpers";
import {
	projects,
	memories,
	goals,
	milestones,
	tasks,
	memoryTags,
	memoryPaths,
	globalContext,
} from "./schema";

/**
 * Creates all Minni tools bound to a specific database instance.
 * Called once during plugin initialization.
 */
export function createTools(db: MinniDB) {
	return {
		minni_project: tool({
			description:
				"Create, update, delete (soft), or list projects. Delete sets status to 'deleted' — hard delete via Minni Studio or direct DB access.",
			args: {
				action: tool.schema.string().describe("Action: create, update, delete, list"),
				name: tool.schema
					.string()
					.optional()
					.describe(
						"Project name. Normalized to lowercase + hyphens (e.g. 'vault-101', 'nerv-hq')",
					),
				description: tool.schema.string().optional().describe("What the project is about"),
				stack: tool.schema
					.string()
					.optional()
					.describe(
						'Comma-separated tools or technologies, e.g. "TanStack Start, ElysiaJS" or "Pip-Boy, VATS, Power Armor"',
					),
				status: tool.schema
					.string()
					.optional()
					.describe("Status: active, paused, completed, archived"),
				permission: tool.schema
					.string()
					.optional()
					.describe(
						"Permission for the project itself: open, guarded, read_only, locked. Default: guarded",
					),
				default_memory_permission: tool.schema
					.string()
					.optional()
					.describe(
						"Permission inherited by new memories: open, guarded, read_only, locked. Default: guarded",
					),
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
			description: "Check Minni database connection and show stats",
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
			description:
				"Load a project context or return to global mode. With project: loads project briefing. Without project: exits to global mode with system overview.",
			args: {
				project: tool.schema
					.string()
					.optional()
					.describe("Project name to load. Omit to return to global mode."),
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

				const nearestGoal = await db
					.select()
					.from(goals)
					.where(and(eq(goals.projectId, proj[0].id), eq(goals.status, "active")))
					.orderBy(asc(goals.createdAt))
					.limit(1);

				const taskCounts = await db
					.select({ status: tasks.status, total: count() })
					.from(tasks)
					.where(eq(tasks.projectId, proj[0].id))
					.groupBy(tasks.status);

				const goalCount = await db
					.select({ total: count() })
					.from(goals)
					.where(eq(goals.projectId, proj[0].id));

				const milestoneCount = await db
					.select({ total: count() })
					.from(milestones)
					.innerJoin(goals, eq(milestones.goalId, goals.id))
					.where(eq(goals.projectId, proj[0].id));

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

				if (activeTask[0] || nearestGoal[0]) {
					const focus: string[] = ["### Active Focus"];
					if (activeTask[0])
						focus.push(
							`► Task IN_PROGRESS: [T${activeTask[0].id}] ${activeTask[0].title} (${activeTask[0].priority})`,
						);
					if (nearestGoal[0])
						focus.push(`► Nearest Goal: [G${nearestGoal[0].id}] ${nearestGoal[0].title}`);
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
				inventory.push(`- Goals: ${goalCount[0].total}`);

				const taskTotal = taskCounts.reduce((sum, c) => sum + c.total, 0);
				const pendingTasks = taskCounts.find((c) => c.status === "todo");
				inventory.push(
					`- Tasks: ${taskTotal}${pendingTasks ? ` (${pendingTasks.total} pending)` : ""}`,
				);
				inventory.push(`- Milestones: ${milestoneCount[0].total}`);
				sections.push(inventory.join("\n"));

				return sections.join("\n");
			},
		}),

		minni_find: tool({
			description:
				"Search memories across all dimensions: title, content, tags, path segments. With active project: returns project results + global results (excluding project). Without active project: returns all.",
			args: {
				query: tool.schema.string().optional().describe("Search text. Omit to list all."),
				type: tool.schema
					.string()
					.optional()
					.describe(
						"Filter by memory type: skill, pattern, anti_pattern, decision, insight, comparison, note, link, article, video, documentation",
					),
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
			description: "Load a specific memory by ID with full content.",
			args: {
				id: tool.schema.number().describe("Memory ID"),
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
			description: "Save a new memory to Minni.",
			args: {
				type: tool.schema
					.string()
					.describe(
						"Memory type: skill, pattern, anti_pattern, decision, insight, comparison, note, link, article, video, documentation",
					),
				title: tool.schema.string().describe("Memory title"),
				content: tool.schema.string().describe("Memory content"),
				path: tool.schema
					.string()
					.optional()
					.describe(
						'Classification pipe, e.g. "Combat -> Titan -> Colossal" or "Config -> Auth -> OAuth"',
					),
				project: tool.schema.string().optional().describe("Project name. Default: active project."),
				status: tool.schema
					.string()
					.optional()
					.describe(
						"Maturity: draft, experimental, proven, battle_tested, deprecated. Default: draft",
					),
				permission: tool.schema
					.string()
					.optional()
					.describe(
						"Access level: open, guarded, read_only. Cascade: explicit → project.defaultMemoryPermission → preferences → guarded",
					),
				tags: tool.schema
					.string()
					.optional()
					.describe("Comma-separated tags, e.g. 'xenomorph, lv-426, survival'"),
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
				let resolvedPermission = args.permission;
				if (!resolvedPermission && proj) {
					const fullProj = await db
						.select()
						.from(projects)
						.where(eq(projects.id, proj.id))
						.limit(1);
					resolvedPermission = fullProj[0]?.defaultMemoryPermission ?? undefined;
				}
				if (!resolvedPermission) {
					const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);
					if (ctx[0]?.preferences) {
						try {
							const prefs = JSON.parse(ctx[0].preferences);
							resolvedPermission = prefs?.memory?.defaultPermission;
						} catch {
							// Invalid JSON, ignore
						}
					}
				}
				resolvedPermission = resolvedPermission ?? "guarded";

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
						permission: resolvedPermission,
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
			description:
				"Update an existing memory. Cannot change permission or type — use Minni Studio for that.",
			args: {
				id: tool.schema.number().describe("Memory ID to update"),
				title: tool.schema.string().optional().describe("New title"),
				content: tool.schema.string().optional().describe("New content"),
				path: tool.schema.string().optional().describe("New path"),
				status: tool.schema
					.string()
					.optional()
					.describe("New maturity: draft, experimental, proven, battle_tested, deprecated"),
				tags: tool.schema.string().optional().describe("Replace tags. Comma-separated."),
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

		minni_goal: tool({
			description:
				"Get, create, update, delete, or list goals for a project. Delete cascades to milestones and tasks.",
			args: {
				action: tool.schema.string().describe("Action: get, create, update, delete, list"),
				project: tool.schema.string().optional().describe("Project name. Default: active project."),
				id: tool.schema.number().optional().describe("Goal ID (for get/update/delete)"),
				title: tool.schema.string().optional().describe("Goal title (for create)"),
				description: tool.schema.string().optional().describe("Goal description"),
				status: tool.schema
					.string()
					.optional()
					.describe("Status: active, completed, paused, cancelled"),
			},
			async execute(args) {
				if (args.status) {
					const err = validateEnum(args.status, GOAL_STATUSES, "status");
					if (err) return err;
				}
				const proj = await resolveProject(db, args.project);
				if (!proj) return "No active project. Use minni_load first.";

				if (args.action === "create") {
					if (!args.title) return "Title is required.";
					// NOTE: createdAt/updatedAt passed explicitly — Turso driver (beta) ignores SQLite DEFAULT expressions
					const result = await db
						.insert(goals)
						.values({
							projectId: proj.id,
							title: args.title,
							description: args.description ?? null,
							createdAt: new Date(),
							updatedAt: new Date(),
						})
						.returning({ id: goals.id });
					return `Goal created: [G${result[0].id}] ${args.title}`;
				}

				if (args.action === "update") {
					if (!args.id) return "Goal ID is required.";
					const goal = await db.select().from(goals).where(eq(goals.id, args.id)).limit(1);
					if (!goal[0]) return `Goal ${args.id} not found.`;
					const updates: Record<string, unknown> = { updatedAt: new Date() };
					if (args.title) updates.title = args.title;
					if (args.description) updates.description = args.description;
					if (args.status) updates.status = args.status;
					await db.update(goals).set(updates).where(eq(goals.id, args.id));
					return `Goal updated: [G${args.id}]`;
				}

				if (args.action === "delete") {
					if (!args.id) return "Goal ID is required.";
					const goal = await db.select().from(goals).where(eq(goals.id, args.id)).limit(1);
					if (!goal[0]) return `Goal ${args.id} not found.`;
					await db.delete(goals).where(eq(goals.id, args.id));
					return `Deleted: [G${args.id}] ${goal[0].title} (milestones and tasks cascaded)`;
				}

				if (args.action === "get") {
					if (!args.id) return "Goal ID is required.";
					const goal = await db.select().from(goals).where(eq(goals.id, args.id)).limit(1);
					if (!goal[0]) return `Goal ${args.id} not found.`;

					const lines: string[] = [
						`## [G${goal[0].id}] ${goal[0].title}`,
						`Status: ${goal[0].status}`,
						`Project: ${proj.name}`,
					];

					if (goal[0].description) {
						lines.push(`\n---\n\n${goal[0].description}`);
					}

					return lines.join("\n");
				}

				if (args.action === "list") {
					const all = await db
						.select()
						.from(goals)
						.where(eq(goals.projectId, proj.id))
						.orderBy(asc(goals.createdAt));
					if (all.length === 0) return "No goals.";
					return all.map((g) => `[G${g.id}] ${g.title} — ${g.status}`).join("\n");
				}

				return "Unknown action. Use: get, create, update, delete, list";
			},
		}),

		minni_milestone: tool({
			description:
				"Get, create, update, delete, or list milestones for a goal. Delete cascades to tasks.",
			args: {
				action: tool.schema.string().describe("Action: get, create, update, delete, list"),
				goal_id: tool.schema.number().optional().describe("Parent goal ID (for create/list)"),
				id: tool.schema.number().optional().describe("Milestone ID (for get/update/delete)"),
				title: tool.schema.string().optional().describe("Milestone title"),
				description: tool.schema.string().optional().describe("Milestone description"),
				status: tool.schema
					.string()
					.optional()
					.describe("Status: active, completed, paused, cancelled"),
			},
			async execute(args) {
				if (args.status) {
					const err = validateEnum(args.status, GOAL_STATUSES, "status");
					if (err) return err;
				}
				if (args.action === "create") {
					if (!args.goal_id) return "goal_id is required.";
					if (!args.title) return "Title is required.";

					// Validate goal exists (milestone inherits project from goal)
					const goal = await db.select().from(goals).where(eq(goals.id, args.goal_id)).limit(1);
					if (!goal[0]) return `Goal ${args.goal_id} not found.`;

					// NOTE: createdAt/updatedAt passed explicitly. Turso driver (beta) ignores SQLite DEFAULT expressions
					const result = await db
						.insert(milestones)
						.values({
							goalId: args.goal_id,
							title: args.title,
							description: args.description ?? null,
							createdAt: new Date(),
							updatedAt: new Date(),
						})
						.returning({ id: milestones.id });
					return `Milestone created: [M${result[0].id}] ${args.title}`;
				}

				if (args.action === "update") {
					if (!args.id) return "Milestone ID is required.";
					const milestone = await db
						.select()
						.from(milestones)
						.where(eq(milestones.id, args.id))
						.limit(1);
					if (!milestone[0]) return `Milestone ${args.id} not found.`;
					const updates: Record<string, unknown> = { updatedAt: new Date() };
					if (args.title) updates.title = args.title;
					if (args.description) updates.description = args.description;
					if (args.status) updates.status = args.status;
					await db.update(milestones).set(updates).where(eq(milestones.id, args.id));
					return `Milestone updated: [M${args.id}]`;
				}

				if (args.action === "delete") {
					if (!args.id) return "Milestone ID is required.";
					const milestone = await db
						.select()
						.from(milestones)
						.where(eq(milestones.id, args.id))
						.limit(1);
					if (!milestone[0]) return `Milestone ${args.id} not found.`;
					await db.delete(milestones).where(eq(milestones.id, args.id));
					return `Deleted: [M${args.id}] ${milestone[0].title} (tasks cascaded)`;
				}

				if (args.action === "get") {
					if (!args.id) return "Milestone ID is required.";
					const milestone = await db
						.select()
						.from(milestones)
						.innerJoin(goals, eq(milestones.goalId, goals.id))
						.innerJoin(projects, eq(goals.projectId, projects.id))
						.where(eq(milestones.id, args.id))
						.limit(1);
					if (!milestone[0]) return `Milestone ${args.id} not found.`;

					const lines: string[] = [
						`## [M${milestone[0].milestones.id}] ${milestone[0].milestones.title}`,
						`Status: ${milestone[0].milestones.status}`,
						`Goal: [G${milestone[0].goals.id}] ${milestone[0].goals.title}`,
						`Project: ${milestone[0].projects.name}`,
					];

					if (milestone[0].milestones.description) {
						lines.push(`\n---\n\n${milestone[0].milestones.description}`);
					}

					return lines.join("\n");
				}

				if (args.action === "list") {
					if (!args.goal_id) return "goal_id is required.";
					const all = await db
						.select()
						.from(milestones)
						.where(eq(milestones.goalId, args.goal_id))
						.orderBy(asc(milestones.createdAt));
					if (all.length === 0) return "No milestones.";
					return all.map((m) => `[M${m.id}] ${m.title} — ${m.status}`).join("\n");
				}

				return "Unknown action. Use: get, create, update, delete, list";
			},
		}),

		minni_task: tool({
			description:
				"Get, create, update, delete, or list tasks. Tasks can belong to a project, goal, milestone, or be standalone.",
			args: {
				action: tool.schema.string().describe("Action: get, create, update, delete, list"),
				id: tool.schema.number().optional().describe("Task ID (for get/update/delete)"),
				project: tool.schema.string().optional().describe("Project name"),
				goal_id: tool.schema.number().optional().describe("Parent goal ID"),
				milestone_id: tool.schema.number().optional().describe("Parent milestone ID"),
				title: tool.schema.string().optional().describe("Task title"),
				description: tool.schema.string().optional().describe("Task description"),
				priority: tool.schema
					.string()
					.optional()
					.describe("Priority: high, medium, low. Default: medium"),
				status: tool.schema
					.string()
					.optional()
					.describe("Status: todo, in_progress, done, cancelled"),
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

					// Derive project from parent hierarchy (milestone > goal > explicit > floating)
					let derivedProjectId: number | null = null;
					let derivedGoalId: number | null = null;
					let derivedMilestoneId: number | null = null;

					if (args.milestone_id) {
						// Level 3: Under milestone — derive goal and project from milestone's goal
						const milestone = await db
							.select()
							.from(milestones)
							.innerJoin(goals, eq(milestones.goalId, goals.id))
							.where(eq(milestones.id, args.milestone_id))
							.limit(1);
						if (!milestone[0]) return `Milestone ${args.milestone_id} not found.`;
						derivedMilestoneId = args.milestone_id;
						derivedGoalId = milestone[0].milestones.goalId;
						derivedProjectId = milestone[0].goals.projectId;
					} else if (args.goal_id) {
						// Level 2: Under goal — derive project from goal
						const goal = await db.select().from(goals).where(eq(goals.id, args.goal_id)).limit(1);
						if (!goal[0]) return `Goal ${args.goal_id} not found.`;
						derivedGoalId = args.goal_id;
						derivedProjectId = goal[0].projectId;
					} else if (args.project) {
						// Level 1: Project surface — explicit project
						const proj = await resolveProject(db, args.project);
						if (!proj) return `Project "${args.project}" not found.`;
						derivedProjectId = proj.id;
					}
					// Level 0: Floating — all nulls (default)

					// NOTE: createdAt/updatedAt passed explicitly — Turso driver (beta) ignores SQLite DEFAULT expressions
					const result = await db
						.insert(tasks)
						.values({
							projectId: derivedProjectId,
							goalId: derivedGoalId,
							milestoneId: derivedMilestoneId,
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

					if (task[0].goalId) {
						const goal = await db.select().from(goals).where(eq(goals.id, task[0].goalId)).limit(1);
						if (goal[0]) lines.push(`Goal: [G${goal[0].id}] ${goal[0].title}`);
					}

					if (task[0].milestoneId) {
						const milestone = await db
							.select()
							.from(milestones)
							.where(eq(milestones.id, task[0].milestoneId))
							.limit(1);
						if (milestone[0]) lines.push(`Milestone: [M${milestone[0].id}] ${milestone[0].title}`);
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
					};

					let all: TaskRow[];

					if (args.milestone_id) {
						all = await db
							.select()
							.from(tasks)
							.where(eq(tasks.milestoneId, args.milestone_id))
							.orderBy(desc(tasks.createdAt));
					} else if (args.goal_id) {
						all = await db
							.select()
							.from(tasks)
							.where(eq(tasks.goalId, args.goal_id))
							.orderBy(desc(tasks.createdAt));
					} else if (proj) {
						all = await db
							.select()
							.from(tasks)
							.where(eq(tasks.projectId, proj.id))
							.orderBy(desc(tasks.createdAt));
					} else {
						all = await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(20);
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
			description:
				"Delete a memory by ID. Respects permissions: locked and read_only cannot be deleted. Guarded requires user confirmation.",
			args: {
				id: tool.schema.number().describe("Memory ID to delete"),
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
			description:
				"Save or overwrite context summary. With active project: updates project context. Without project: updates global context.",
			args: {
				summary: tool.schema.string().describe("Session summary / context narrative"),
				project: tool.schema
					.string()
					.optional()
					.describe("Project name. Omit to use active project or global context."),
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
			description:
				"Send markdown content to the Minni Viewer canvas for beautiful rendering. Use this to show formatted content, code, tables, or any markdown to the user without creating files.",
			args: {
				content: tool.schema.string().describe("Markdown content to display in the canvas"),
				action: tool.schema
					.string()
					.optional()
					.describe(
						"Action: show (default), open (show + open browser), save (show + save as memory)",
					),
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
