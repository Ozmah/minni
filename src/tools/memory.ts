import { tool } from "@opencode-ai/plugin";
import { eq, sql } from "drizzle-orm";

import {
	type MinniDB,
	type ToolContext,
	getSetting,
	guardedAction,
	saveTags,
	validateEnum,
} from "../helpers";
import {
	memories,
	memoryTags,
	MEMORY_STATUS,
	MEMORY_TYPE,
	PERMISSION,
	type MemoryStatus,
	type MemoryType,
	type Permission,
} from "../schema";

type WritablePermission = Exclude<Permission, "locked">;

export function memoryTools(db: MinniDB) {
	return {
		minni_memory: tool({
			description: "CRUD knowledge. Find to discover, then equip to read",
			args: {
				action: tool.schema.enum(["find", "save", "update", "delete"]),
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
					])
					.optional()
					.describe("Filter by type (find) or set type (save)"),
				title: tool.schema.string().optional().describe("Required for save"),
				content: tool.schema.string().optional().describe("Required for save"),
				project: tool.schema
					.string()
					.optional()
					.describe("Reserved for future project association"),
				tags: tool.schema.string().optional().describe("Comma-separated"),
				status: tool.schema
					.enum(["draft", "experimental", "proven", "battle_tested", "deprecated"])
					.optional(),
				permission: tool.schema
					.enum(["open", "guarded", "read_only"])
					.optional()
					.describe("Default: guarded"),
				id: tool.schema.number().optional().describe("Required for update/delete"),
				append: tool.schema
					.boolean()
					.optional()
					.describe("For update: concatenate to existing content instead of replacing"),
			},
			async execute(args, context) {
				if (args.action === "find") return handleFind(db, args);
				if (args.action === "save") return handleSave(db, args);
				if (args.action === "update") return handleUpdate(db, context, args);
				if (args.action === "delete") return handleDelete(db, context, args);
				return "Unknown action. Use: find, save, update, delete";
			},
		}),
	};
}

type FindArgs = { query?: string; type?: string };

async function handleFind(db: MinniDB, args: FindArgs): Promise<string> {
	const limitStr = await getSetting(db, "search_default_limit");
	const limit = limitStr ? parseInt(limitStr, 10) : 20;

	if (args.query) {
		const escaped = args.query.replace(/[%_]/g, "\\$&");
		const q = `%${escaped}%`;
		const qNorm = args.query.toLowerCase().trim();

		const results = await db.all<{
			id: number;
			type: MemoryType;
			title: string;
			status: MemoryStatus;
		}>(sql`
			SELECT DISTINCT m.id, m.type, m.title, m.status
			FROM memories m
			LEFT JOIN memory_tags mt ON m.id = mt.memory_id
			LEFT JOIN tags t ON mt.tag_id = t.id
			WHERE m.permission != 'locked'
				${args.type ? sql`AND m.type = ${args.type}` : sql``}
				AND (
					m.title LIKE ${q} ESCAPE '\\'
					OR m.content LIKE ${q} ESCAPE '\\'
					OR t.name = ${qNorm}
				)
			ORDER BY m.updated_at DESC
			LIMIT ${limit}
		`);

		if (!results.length) return "No memories found.";
		return results.map((m) => `[${m.id}] [${m.type}] ${m.title} — ${m.status}`).join("\n");
	}

	const conditions = [sql`m.permission != 'locked'`];
	if (args.type) conditions.push(sql`m.type = ${args.type}`);

	const results = await db.all<{
		id: number;
		type: MemoryType;
		title: string;
		status: MemoryStatus;
	}>(sql`
		SELECT m.id, m.type, m.title, m.status
		FROM memories m
		WHERE ${sql.join(conditions, sql` AND `)}
		ORDER BY m.updated_at DESC
		LIMIT ${limit}
	`);

	if (!results.length) return "No memories found.";
	return results.map((m) => `[${m.id}] [${m.type}] ${m.title} — ${m.status}`).join("\n");
}

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

	let resolvedPermission: WritablePermission | undefined = args.permission as
		| WritablePermission
		| undefined;
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
		{ id: mem[0].id, name: mem[0].title, type: "memory", permission: mem[0].permission },
		"update",
		async () => {
			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (args.title) updates.title = args.title;
			if (args.content)
				updates.content = args.append ? `${mem[0].content}\n\n${args.content}` : args.content;
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

type DeleteArgs = { id?: number };

async function handleDelete(db: MinniDB, context: unknown, args: DeleteArgs): Promise<string> {
	if (!args.id) return "Memory ID is required.";
	const mem = await db.select().from(memories).where(eq(memories.id, args.id)).limit(1);
	if (!mem[0]) return `Memory ${args.id} not found.`;

	const result = await guardedAction(
		db,
		context as ToolContext,
		{ id: mem[0].id, name: mem[0].title, type: "memory", permission: mem[0].permission },
		"delete",
		async () => {
			await db.delete(memories).where(eq(memories.id, args.id!));
			return `Deleted: [${args.id}] ${mem[0].title}`;
		},
	);

	return result.isOk() ? result.value : result.error;
}
