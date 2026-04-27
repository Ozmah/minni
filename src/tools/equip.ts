import { tool } from "@opencode-ai/plugin";
import { Result } from "better-result";
import { and, eq, ne, sql } from "drizzle-orm";

import { getActiveDevMode, getActiveProject, type MinniDB, resolveProject } from "../helpers";
import {
	devModeMemories,
	devModes,
	memories,
	memoryRelations,
	projectMemories,
	projects,
	rules,
} from "../schema";

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

async function formatMemoryBlock(db: MinniDB, id: number): Promise<string> {
	const mem = await db
		.select()
		.from(memories)
		.where(and(ne(memories.permission, "locked"), eq(memories.id, id)))
		.limit(1);

	if (!mem[0]) return `Memory ${id} not found.`;

	const tag = beaconTag(mem[0].title);
	const beacon = mem[0].type.toUpperCase();
	const lines: string[] = [`[${beacon}:${tag}]`];
	lines.push(`ID: ${mem[0].id} | Status: ${mem[0].status} | Permission: ${mem[0].permission}`);
	const tagsLine = await resolveTags(db, id);
	if (tagsLine) lines.push(tagsLine);
	const usesLine = await resolveRelations(db, id);
	if (usesLine) lines.push(usesLine);
	lines.push("");
	lines.push(mem[0].content);
	lines.push(`[/${beacon}:${tag}]`);
	return lines.join("\n");
}

async function getProjectMemoryIds(db: MinniDB, projectId: number): Promise<number[]> {
	const rows = await db
		.select({ id: projectMemories.memoryId })
		.from(projectMemories)
		.innerJoin(memories, eq(memories.id, projectMemories.memoryId))
		.where(and(eq(projectMemories.projectId, projectId), ne(memories.permission, "locked")));
	return rows.map((row) => row.id);
}

async function getDevModeMemoryIds(db: MinniDB, devModeId: number): Promise<number[]> {
	const rows = await db
		.select({ id: devModeMemories.memoryId })
		.from(devModeMemories)
		.innerJoin(memories, eq(memories.id, devModeMemories.memoryId))
		.where(and(eq(devModeMemories.devModeId, devModeId), ne(memories.permission, "locked")));
	return rows.map((row) => row.id);
}

async function formatProjectBlock(db: MinniDB, projectId: number): Promise<string | null> {
	const full = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
	if (!full[0]) return null;

	const p = full[0];
	const rulesForProject = await db.select().from(rules).where(eq(rules.projectId, projectId));

	const lines: string[] = [`[PROJECT:${p.name}]`];
	if (p.description) lines.push(p.description);
	if (p.stack) {
		const parsed = Result.try(() => JSON.parse(p.stack as string))
			.map((v: string[]) => v.join(", "))
			.unwrapOr(p.stack);
		lines.push(`Stack: ${parsed}`);
	}
	lines.push(`Permission: ${p.permission}`);
	if (rulesForProject.length > 0) {
		lines.push("");
		lines.push("Conventions / Gotchas:");
		for (const rule of rulesForProject.sort((a, b) => a.sortOrder - b.sortOrder)) {
			lines.push(`- [${rule.kind}] ${rule.statement}`);
		}
	}
	lines.push(`[/PROJECT:${p.name}]`);
	return lines.join("\n");
}

async function formatDevModeBlock(db: MinniDB, devModeId: number): Promise<string | null> {
	const full = await db.select().from(devModes).where(eq(devModes.id, devModeId)).limit(1);
	if (!full[0]) return null;

	const mode = full[0];
	const rulesForMode = await db.select().from(rules).where(eq(rules.devModeId, devModeId));

	const lines: string[] = [`[DEV_MODE:${mode.name}]`];
	if (mode.description) lines.push(mode.description);
	lines.push(`Permission: ${mode.permission}`);
	if (rulesForMode.length > 0) {
		lines.push("");
		lines.push("Principles:");
		for (const rule of rulesForMode.sort((a, b) => a.sortOrder - b.sortOrder)) {
			lines.push(`- ${rule.statement}`);
		}
	}
	lines.push(`[/DEV_MODE:${mode.name}]`);
	return lines.join("\n");
}

export function equipTools(db: MinniDB) {
	return {
		minni_equip: tool({
			description:
				"Load context into your working memory. Everything you read goes through equip. Use minni_memory(find) to discover, then equip what you need.",
			args: {
				ids: tool.schema.string().optional().describe("Comma-separated memory IDs, e.g. '1,5,12'"),
				active: tool.schema
					.boolean()
					.optional()
					.describe("Load the persisted active project + active dev mode context"),
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

				if (!ids.length && !args.project && !args.active) {
					return "At least one parameter required: ids, project, or active:true.";
				}

				const sections: string[] = [];
				const memoryIds = new Set(ids);

				if (args.active) {
					const [activeProject, activeDevMode] = await Promise.all([
						getActiveProject(db),
						getActiveDevMode(db),
					]);

					if (!activeProject && !activeDevMode) {
						sections.push("No active project or dev mode.");
					} else {
						if (activeProject) {
							const block = await formatProjectBlock(db, activeProject.id);
							if (block) sections.push(block);
							for (const id of await getProjectMemoryIds(db, activeProject.id)) memoryIds.add(id);
						}

						if (activeDevMode) {
							const block = await formatDevModeBlock(db, activeDevMode.id);
							if (block) sections.push(block);
							for (const id of await getDevModeMemoryIds(db, activeDevMode.id)) memoryIds.add(id);
						}
					}
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

				for (const id of memoryIds) {
					sections.push(await formatMemoryBlock(db, id));
				}

				if (sections.length === 0) return "Nothing found to equip.";
				return sections.join("\n\n");
			},
		}),
	};
}
