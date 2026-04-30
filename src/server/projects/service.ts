import { and, asc, eq, inArray } from "drizzle-orm";

import type { MinniDB } from "../../helpers";

import { activeState, memories, projectMemories, projects, rules } from "../../schema";
import { buildProjectInjectionPreview } from "../context/formatters";

/** Loads the Project Composer payload, including rules, memory summaries, and preview text. */
export async function getEnrichedProject(db: MinniDB, id: number) {
	const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
	if (!project) return null;

	const [projectRules, associatedMemories, active] = await Promise.all([
		db
			.select()
			.from(rules)
			.where(and(eq(rules.projectId, id), inArray(rules.kind, ["convention", "gotcha"])))
			.orderBy(asc(rules.kind), asc(rules.sortOrder), asc(rules.id)),
		db
			.select({
				id: memories.id,
				title: memories.title,
				type: memories.type,
				status: memories.status,
				permission: memories.permission,
				sortOrder: projectMemories.sortOrder,
			})
			.from(projectMemories)
			.innerJoin(memories, eq(memories.id, projectMemories.memoryId))
			.where(eq(projectMemories.projectId, id))
			.orderBy(asc(projectMemories.sortOrder), asc(memories.title)),
		db.select().from(activeState).where(eq(activeState.id, 1)).limit(1),
	]);

	return {
		project,
		rules: projectRules,
		memories: associatedMemories,
		isActive: active[0]?.activeProjectId === id,
		summary: {
			conventionCount: projectRules.filter((rule) => rule.kind === "convention").length,
			gotchaCount: projectRules.filter((rule) => rule.kind === "gotcha").length,
			memoryCount: associatedMemories.length,
		},
		injectionPreview: buildProjectInjectionPreview({
			project,
			projectRules,
			memoryCount: associatedMemories.length,
		}),
	};
}
