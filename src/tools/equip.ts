import { tool } from "@opencode-ai/plugin";
import { Result } from "better-result";
import { and, eq, ne, sql } from "drizzle-orm";

import { type MinniDB, resolveProject } from "../helpers";
import { memories, memoryRelations, projects } from "../schema";

function beaconTag(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

async function resolveRelations(db: MinniDB, memoryId: number): Promise<string | null> {
	const relations = await db
		.select()
		.from(memoryRelations)
		.where(eq(memoryRelations.memoryId, memoryId));

	if (relations.length === 0) return null;

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

async function resolveTags(db: MinniDB, memoryId: number): Promise<string | null> {
	const memTags = await db.all<{ name: string }>(sql`
		SELECT t.name FROM tags t
		JOIN memory_tags mt ON t.id = mt.tag_id
		WHERE mt.memory_id = ${memoryId}
	`);
	if (memTags.length === 0) return null;
	return `Tags: ${memTags.map((t) => t.name).join(", ")}`;
}

export function equipTools(db: MinniDB) {
	return {
		minni_equip: tool({
			description:
				"Load context into your working memory. Everything you read goes through equip. Use minni_memory(find) to discover, then equip what you need.",
			args: {
				ids: tool.schema.string().optional().describe("Comma-separated memory IDs, e.g. '1,5,12'"),
				project: tool.schema
					.string()
					.optional()
					.describe("Project name — equips description, stack, and permission"),
			},
			async execute(args) {
				const ids = args.ids
					? args.ids
							.split(",")
							.map((s) => parseInt(s.trim(), 10))
							.filter((n) => !Number.isNaN(n))
					: [];

				if (!ids.length && !args.project) {
					return "At least one parameter required: ids or project.";
				}

				const sections: string[] = [];

				for (const id of ids) {
					const mem = await db
						.select()
						.from(memories)
						.where(and(ne(memories.permission, "locked"), eq(memories.id, id)))
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
								const parsed = Result.try(() => JSON.parse(p.stack as string))
									.map((v: string[]) => v.join(", "))
									.unwrapOr(p.stack);
								lines.push(`Stack: ${parsed}`);
							}
							lines.push(`Permission: ${p.permission}`);
							lines.push(`[/PROJECT:${p.name}]`);
							sections.push(lines.join("\n"));
						}
					}
				}

				if (sections.length === 0) return "Nothing found to equip.";
				return sections.join("\n\n");
			},
		}),
	};
}
