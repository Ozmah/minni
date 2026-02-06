import { tool } from "@opencode-ai/plugin";
import { sql, eq, and, isNull } from "drizzle-orm";

import {
	type MinniDB,
	type ToolContext,
	getActiveProject,
	resolveProject,
	saveTags,
	validateEnum,
	guardedAction,
	getSetting,
} from "../helpers";
import {
	projects,
	memories,
	memoryTags,
	MEMORY_TYPE,
	MEMORY_STATUS,
	PERMISSION,
	type Permission,
	type MemoryType,
	type MemoryStatus,
} from "../schema";

/** Permission types allowed when creating/updating memories (excludes "locked") */
type WritablePermission = Exclude<Permission, "locked">;

/**
 * Creates memory tool: minni_memory (find, save, update, delete)
 */
export function memoryTools(db: MinniDB) {
	return {
		minni_memory: tool({
			description:
				"CRUD knowledge. Find to discover, then equip to read. Types: skill, pattern, decision, identity, context, scratchpad, ...",
			args: {
				action: tool.schema.enum(["find", "save", "update", "delete"]),

				// find
				query: tool.schema.string().optional().describe("Search query. Omit to list all."),
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
						"identity",
						"context",
						"scratchpad",
					])
					.optional()
					.describe("Filter by type (find) or set type (save)"),

				// save
				title: tool.schema.string().optional().describe("Required for save"),
				content: tool.schema.string().optional().describe("Required for save"),
				project: tool.schema.string().optional().describe("Default: active project"),
				tags: tool.schema.string().optional().describe("Comma-separated"),
				status: tool.schema
					.enum(["draft", "experimental", "proven", "battle_tested", "deprecated"])
					.optional(),
				permission: tool.schema
					.enum(["open", "guarded", "read_only"])
					.optional()
					.describe("Default: project setting or guarded"),

				// update/delete
				id: tool.schema.number().optional().describe("Required for update/delete"),
				append: tool.schema
					.boolean()
					.optional()
					.describe("For update: concatenate to existing content instead of replacing"),
			},
			async execute(args, context) {
				// find
				if (args.action === "find") return handleFind(db, args);

				// save
				if (args.action === "save") return handleSave(db, args);

				// update
				if (args.action === "update") return handleUpdate(db, context, args);

				// delete
				if (args.action === "delete") return handleDelete(db, context, args);

				return "Unknown action. Use: find, save, update, delete";
			},
		}),
	};
}

// ============================================================================
// FIND
// ============================================================================

type FindArgs = { query?: string; type?: string };

async function handleFind(db: MinniDB, args: FindArgs): Promise<string> {
	const limitStr = await getSetting(db, "search_default_limit");
	const limit = limitStr ? parseInt(limitStr, 10) : 20;
	const activeProj = await getActiveProject(db);

	type MemoryRow = {
		id: number;
		type: MemoryType;
		title: string;
		status: MemoryStatus;
		project_id: number | null;
		project_name: string | null;
	};

	const formatRow = (m: MemoryRow) => `[${m.id}] [${m.type}] ${m.title} — ${m.status}`;

	// Raw SQL needed: LIKE with ESCAPE, dynamic scope conditions, sql.join
	const searchMemories = async (
		scopeCondition: ReturnType<typeof sql> | null,
	): Promise<MemoryRow[]> => {
		if (args.query) {
			// Avoid LIKE wildcard injection
			const escaped = args.query.replace(/[%_]/g, "\\$&");
			const q = `%${escaped}%`;
			const qNorm = args.query.toLowerCase().trim();

			return db.all<MemoryRow>(sql`
				SELECT DISTINCT m.id, m.type, m.title, m.status,
					m.project_id, p.name as project_name
				FROM memories m
				LEFT JOIN projects p ON m.project_id = p.id
				LEFT JOIN memory_tags mt ON m.id = mt.memory_id
				LEFT JOIN tags t ON mt.tag_id = t.id
				WHERE m.permission != 'locked'
					${scopeCondition ? sql`AND ${scopeCondition}` : sql``}
					${args.type ? sql`AND m.type = ${args.type}` : sql``}
					AND (
						m.title LIKE ${q} ESCAPE '\\'
						OR m.content LIKE ${q} ESCAPE '\\'
						OR t.name = ${qNorm}
					)
				ORDER BY m.updated_at DESC
				LIMIT ${limit}
			`);
		}

		const conditions = [sql`m.permission != 'locked'`];
		if (scopeCondition) conditions.push(scopeCondition);
		if (args.type) conditions.push(sql`m.type = ${args.type}`);

		return db.all<MemoryRow>(sql`
			SELECT m.id, m.type, m.title, m.status,
				m.project_id, p.name as project_name
			FROM memories m
			LEFT JOIN projects p ON m.project_id = p.id
			WHERE ${sql.join(conditions, sql` AND `)}
			ORDER BY m.updated_at DESC
			LIMIT ${limit}
		`);
	};

	// No active project: single query, everything
	if (!activeProj) {
		const results = await searchMemories(null);
		if (!results || results.length === 0) return "No memories found.";
		return results.map(formatRow).join("\n");
	}

	// With active project: project scope + the nether
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

		const grouped = new Map<string, MemoryRow[]>();
		for (const m of netherResults) {
			const key = m.project_name ?? "Global";
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key)!.push(m);
		}

		// Named projects first alphabetically, Global last
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
}

// ============================================================================
// SAVE
// ============================================================================

type SaveArgs = {
	type?: string;
	title?: string;
	content?: string;
	project?: string;
	tags?: string;
	status?: string;
	permission?: string;
};

async function handleSave(db: MinniDB, args: SaveArgs): Promise<string> {
	if (!args.type) return "Type is required.";
	if (!args.title) return "Title is required.";
	if (!args.content) return "Content is required.";

	const typeErr = validateEnum(args.type, MEMORY_TYPE, "type");
	if (typeErr) return typeErr;
	if (args.status) {
		const statusErr = validateEnum(args.status, MEMORY_STATUS, "status");
		if (statusErr) return statusErr;
	}
	if (args.permission) {
		const permErr = validateEnum(args.permission, PERMISSION, "permission");
		if (permErr) return permErr;
	}

	const proj = await resolveProject(db, args.project);

	// Context type: upsert (one per project scope)
	if (args.type === "context") {
		const existing = await db
			.select()
			.from(memories)
			.where(
				proj
					? and(eq(memories.type, "context"), eq(memories.projectId, proj.id))
					: and(eq(memories.type, "context"), isNull(memories.projectId)),
			)
			.limit(1);

		if (existing[0]) {
			await db
				.update(memories)
				.set({ title: args.title, content: args.content, updatedAt: new Date() })
				.where(eq(memories.id, existing[0].id));
			return `Context updated: [${existing[0].id}] [context] ${args.title}`;
		}
	}

	// Scratchpad: force open permission
	const isScratchpad = args.type === "scratchpad";

	// Permission cascade: explicit → project.defaultMemoryPermission → setting → "guarded"
	let resolvedPermission: WritablePermission | undefined = isScratchpad
		? "open"
		: (args.permission as WritablePermission | undefined);

	if (!resolvedPermission && proj) {
		const fullProj = await db.select().from(projects).where(eq(projects.id, proj.id)).limit(1);
		resolvedPermission = fullProj[0]?.defaultMemoryPermission as WritablePermission | undefined;
	}
	if (!resolvedPermission) {
		const settingPerm = await getSetting(db, "default_memory_permission");
		if (settingPerm && PERMISSION.includes(settingPerm as Permission)) {
			resolvedPermission = settingPerm as WritablePermission;
		}
	}
	const finalPermission: WritablePermission = resolvedPermission ?? "guarded";

	const result = await db
		.insert(memories)
		.values({
			// TODO [T70]: Casts required because OpenCode's tool.schema.enum() resolves to
			// `string` at the type level, not the literal union Drizzle expects for
			// $type<>() columns. Values are validated via validateEnum() before reaching
			// this point so the casts are safe. Will look for a solution.
			projectId: proj?.id ?? null,
			type: args.type as MemoryType,
			title: args.title,
			content: args.content,
			status: (args.status ?? "draft") as MemoryStatus,
			permission: finalPermission as Permission,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning({ id: memories.id });

	const memId = result[0].id;

	if (args.tags) {
		const tagNames = args.tags
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		await saveTags(db, memId, tagNames);
	}

	return `Saved: [${memId}] [${args.type}] ${args.title}`;
}

// ============================================================================
// UPDATE
// ============================================================================

type UpdateArgs = {
	id?: number;
	title?: string;
	content?: string;
	tags?: string;
	status?: string;
	append?: boolean;
};

async function handleUpdate(db: MinniDB, context: unknown, args: UpdateArgs): Promise<string> {
	if (!args.id) return "Memory ID is required.";
	const mem = await db.select().from(memories).where(eq(memories.id, args.id)).limit(1);
	if (!mem[0]) return `Memory ${args.id} not found.`;

	if (args.status) {
		const statusErr = validateEnum(args.status, MEMORY_STATUS, "status");
		if (statusErr) return statusErr;
	}

	const result = await guardedAction(
		db,
		context as ToolContext,
		{
			id: mem[0].id,
			name: mem[0].title,
			type: "memory",
			permission: mem[0].permission,
		},
		"update",
		async () => {
			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (args.title) updates.title = args.title;
			if (args.content) {
				// Append mode concatenates with double newline separator
				updates.content = args.append ? `${mem[0].content}\n\n${args.content}` : args.content;
			}
			if (args.status) updates.status = args.status;

			await db.update(memories).set(updates).where(eq(memories.id, args.id!));

			if (args.tags) {
				await db.delete(memoryTags).where(eq(memoryTags.memoryId, args.id!));
				const tagNames = args.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean);
				await saveTags(db, args.id!, tagNames);
			}

			return `Updated: [${args.id}] ${args.title ?? mem[0].title}`;
		},
	);

	return result.isOk() ? result.value : result.error;
}

// ============================================================================
// DELETE
// ============================================================================

type DeleteArgs = { id?: number };

async function handleDelete(db: MinniDB, context: unknown, args: DeleteArgs): Promise<string> {
	if (!args.id) return "Memory ID is required.";
	const mem = await db.select().from(memories).where(eq(memories.id, args.id)).limit(1);
	if (!mem[0]) return `Memory ${args.id} not found.`;

	const result = await guardedAction(
		db,
		context as ToolContext,
		{
			id: mem[0].id,
			name: mem[0].title,
			type: "memory",
			permission: mem[0].permission,
		},
		"delete",
		async () => {
			// memory_tags and memory_relations cleaned by ON DELETE CASCADE
			await db.delete(memories).where(eq(memories.id, args.id!));
			return `Deleted: [${args.id}] ${mem[0].title}`;
		},
	);

	return result.isOk() ? result.value : result.error;
}
