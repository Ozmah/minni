import { tool } from "@opencode-ai/plugin";
import { eq, ne, and, sql, desc } from "drizzle-orm";

import { type MinniDB, resolveProject } from "../helpers";
import { memories, projects, tasks, memoryRelations } from "../schema";

/** Normalizes a title for use in beacon tags. */
function beaconTag(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Resolves `uses` relations for a memory. Returns formatted line or null. */
async function resolveRelations(db: MinniDB, memoryId: number): Promise<string | null> {
	const relations = await db
		.select()
		.from(memoryRelations)
		.where(eq(memoryRelations.memoryId, memoryId));

	if (relations.length === 0) return null;

	// TODO do we need a type for this?
	const related: { id: number; title: string }[] = [];
	for (const r of relations) {
		const m = await db
			.select({ id: memories.id, title: memories.title })
			.from(memories)
			.where(eq(memories.id, r.relatedId))
			.limit(1);
		if (m[0]) related.push(m[0]);
	}

	if (related.length === 0) return null;
	return `uses: ${related.map((m) => `[M${m.id}] ${m.title}`).join(", ")}`;
}

// TODO corrección de raw sql -> drizzle
/** Resolves tags for a memory. Returns formatted line or null. */
async function resolveTags(db: MinniDB, memoryId: number): Promise<string | null> {
	const memTags = await db.all<{ name: string }>(sql`
		SELECT t.name FROM tags t
		JOIN memory_tags mt ON t.id = mt.tag_id
		WHERE mt.memory_id = ${memoryId}
	`);
	if (memTags.length === 0) return null;
	return `Tags: ${memTags.map((t) => t.name).join(", ")}`;
}

/**
 * Creates equip tool: minni_equip
 */
export function equipTools(db: MinniDB) {
	return {
		minni_equip: tool({
			description:
				"Load context into your working memory. Everything you read goes through equip. Use minni_memory(find) to discover, then equip what you need.",
			args: {
				ids: tool.schema.string().optional().describe("Comma-separated memory IDs, e.g. '1,5,12'"),
				identity: tool.schema.string().optional().describe("Identity name to load"),
				project: tool.schema
					.string()
					.optional()
					.describe("Project name — equips description, stack, and status"),
				task: tool.schema.number().optional().describe("Task ID to load"),
			},
			async execute(args) {
				const ids = args.ids
					? args.ids
							.split(",")
							.map((s) => parseInt(s.trim(), 10))
							.filter((n) => !Number.isNaN(n))
					: [];

				if (!ids.length && !args.identity && !args.project && args.task === undefined) {
					return "At least one parameter required: ids, identity, project, or task.";
				}

				const sections: string[] = [];

				// TODO normalizar comentarios, si me gustan éste tipo de comentarios
				// PERO necesitamos apegarnos a la convención de la skill

				// === Memories by ID ===

				for (const id of ids) {
					const mem = await db
						.select()
						.from(memories)
						.where(and(eq(memories.id, id), ne(memories.permission, "locked")))
						.limit(1);

					if (!mem[0]) {
						sections.push(`Memory ${id} not found.`);
						continue;
					}

					const tag = beaconTag(mem[0].title);
					const beacon = mem[0].type.toUpperCase();
					const lines: string[] = [`[${beacon}:${tag}]`];

					lines.push(
						`ID: ${mem[0].id} | Status: ${mem[0].status} | Permission: ${mem[0].permission}`,
					);

					const tagsLine = await resolveTags(db, id);
					if (tagsLine) lines.push(tagsLine);

					const usesLine = await resolveRelations(db, id);
					if (usesLine) lines.push(usesLine);

					lines.push("");
					lines.push(mem[0].content);
					lines.push(`[/${beacon}:${tag}]`);
					sections.push(lines.join("\n"));
				}

				// === Identity by name ===

				if (args.identity) {
					const mem = await db
						.select()
						.from(memories)
						.where(
							and(
								eq(memories.type, "identity"),
								eq(memories.title, args.identity),
								ne(memories.permission, "locked"),
							),
						)
						.limit(1);

					if (!mem[0]) {
						sections.push(`Identity "${args.identity}" not found.`);
					} else {
						const lines: string[] = [`[IDENTITY:${mem[0].title}]`];
						lines.push(mem[0].content);
						lines.push(`[/IDENTITY:${mem[0].title}]`);
						sections.push(lines.join("\n"));
					}
				}

				// === Project briefing ===

				if (args.project) {
					const resolved = await resolveProject(db, args.project);
					if (!resolved) {
						sections.push(`Project "${args.project}" not found.`);
					} else {
						const full = await db
							.select()
							.from(projects)
							.where(eq(projects.id, resolved.id))
							.limit(1);

						if (full[0]) {
							const p = full[0];
							const lines: string[] = [`[PROJECT:${p.name}]`];
							if (p.description) lines.push(p.description);
							if (p.stack) {
								try {
									lines.push(`Stack: ${JSON.parse(p.stack).join(", ")}`);
								} catch {
									lines.push(`Stack: ${p.stack}`);
								}
							}
							lines.push(`Status: ${p.status} | Permission: ${p.permission}`);
							lines.push(`[/PROJECT:${p.name}]`);
							sections.push(lines.join("\n"));
						}
					}
				}

				// === Task by ID ===

				if (args.task !== undefined) {
					const t = await db.select().from(tasks).where(eq(tasks.id, args.task)).limit(1);

					if (!t[0]) {
						sections.push(`Task ${args.task} not found.`);
					} else {
						const lines: string[] = [`[TASK:T${t[0].id}]`];
						lines.push(t[0].title);
						lines.push(`Priority: ${t[0].priority} | Status: ${t[0].status}`);

						if (t[0].projectId) {
							const proj = await db
								.select()
								.from(projects)
								.where(eq(projects.id, t[0].projectId))
								.limit(1);
							if (proj[0]) lines.push(`Project: ${proj[0].name}`);
						}

						if (t[0].parentId) {
							const parent = await db
								.select()
								.from(tasks)
								.where(eq(tasks.id, t[0].parentId))
								.limit(1);
							if (parent[0]) lines.push(`Parent: [T${parent[0].id}] ${parent[0].title}`);
						}

						const subtasks = await db
							.select()
							.from(tasks)
							.where(eq(tasks.parentId, t[0].id))
							.orderBy(desc(tasks.createdAt));

						if (subtasks.length > 0) {
							lines.push(`\nSubtasks (${subtasks.length}):`);
							for (const st of subtasks) {
								lines.push(`- [T${st.id}] ${st.title} — ${st.status}`);
							}
						}

						if (t[0].description) {
							lines.push(`\n${t[0].description}`);
						}

						lines.push(`[/TASK:T${t[0].id}]`);
						sections.push(lines.join("\n"));
					}
				}

				if (sections.length === 0) return "Nothing found to equip.";
				return sections.join("\n\n");
			},
		}),
	};
}
