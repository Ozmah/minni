import { tool } from "@opencode-ai/plugin";
import { sql, eq } from "drizzle-orm";

import {
	type MinniDB,
	type ToolContext,
	getActiveProject,
	resolveProject,
	saveTags,
	savePathSegments,
	validateEnum,
	guardedAction,
	MEMORY_TYPES,
	MEMORY_STATUSES,
	MEMORY_PERMISSIONS,
} from "../helpers";
import { projects, memories, memoryTags, memoryPaths, globalContext } from "../schema";

/**
 * Creates memory-related tools: minni_find, minni_get, minni_save, minni_update, minni_delete
 */
export function memoryTools(db: MinniDB) {
	return {
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
				const activeProj = await getActiveProject(db);

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
						// Escape LIKE wildcards to prevent pattern injection
						const escaped = args.query.replace(/[%_]/g, "\\$&");
						const q = `%${escaped}%`;
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
									m.title LIKE ${q} ESCAPE '\\'
									OR m.content LIKE ${q} ESCAPE '\\'
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
						const mems = grouped.get(key)!;
						sections.push(`\n### ${key} (${mems.length})`);
						sections.push(mems.map(formatRow).join("\n"));
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

				return result.ok ? result.value : result.error;
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

				return result.ok ? result.value : result.error;
			},
		}),
	};
}
