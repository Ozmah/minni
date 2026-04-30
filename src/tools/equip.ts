import { tool } from "@opencode-ai/plugin";
import { eq } from "drizzle-orm";

import { type MinniDB, resolveProject } from "../helpers";
import { memories, projects } from "../schema";
import { formatProjectOverview } from "../server/context/formatters";
import { buildActiveContextLoadout, formatMemoryContextBlock } from "../server/lib/context-loadout";

/** Loads one explicit memory by ID using the same formatter as active-context loadout. */
async function formatMemoryBlock(db: MinniDB, id: number): Promise<string> {
	const mem = await db.select().from(memories).where(eq(memories.id, id)).limit(1);

	if (!mem[0]) return `Memory ${id} not found.`;
	if (mem[0].permission === "locked") return `Memory ${id} is locked.`;
	return formatMemoryContextBlock(mem[0], null);
}

/** Registers the context injection tool used by agents to load memory and active loadout text. */
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
					const loadout = await buildActiveContextLoadout(db);
					sections.push(loadout.text || "No active project or dev mode.");
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
						if (full[0]) sections.push(formatProjectOverview(full[0]));
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
