import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { ActiveContextLoadout, ContextLoadoutItem, ContextMemoryPlacement } from "./types";

import { getActiveDevMode, getActiveProject, type MinniDB } from "../../helpers";
import {
	devModeMemories,
	devModes,
	memories,
	projectMemories,
	projects,
	rules,
} from "../../schema";
import {
	formatDevModeOverview,
	formatMemoryContextBlock,
	formatMemoryLoadoutSubtitle,
	formatProjectOverview,
	formatRuleContextBlock,
	joinContextBlocks,
} from "./formatters";

function resolveMemoryPlacement(
	memoryId: number,
	projectMemoryIds: Set<number>,
	devModeMemoryIds: Set<number>,
): ContextMemoryPlacement {
	const inProject = projectMemoryIds.has(memoryId);
	const inDevMode = devModeMemoryIds.has(memoryId);
	if (inProject && inDevMode) return "shared";
	if (inProject) return "project";
	if (inDevMode) return "dev_mode";
	return null;
}

/** Builds the canonical active context consumed by Cockpit and `minni_equip(active:true)`. */
export async function buildActiveContextLoadout(db: MinniDB): Promise<ActiveContextLoadout> {
	const [activeProject, activeDevMode] = await Promise.all([
		getActiveProject(db),
		getActiveDevMode(db),
	]);
	const sections: ActiveContextLoadout["sections"] = [];
	const projectMemoryIds = new Set<number>();
	const devModeMemoryIds = new Set<number>();

	if (activeProject) {
		const [project] = await db
			.select()
			.from(projects)
			.where(eq(projects.id, activeProject.id))
			.limit(1);
		if (project) {
			const [projectRules, associatedMemories] = await Promise.all([
				db
					.select()
					.from(rules)
					.where(
						and(eq(rules.projectId, project.id), inArray(rules.kind, ["convention", "gotcha"])),
					)
					.orderBy(asc(rules.sortOrder), asc(rules.id)),
				db
					.select({ id: projectMemories.memoryId })
					.from(projectMemories)
					.innerJoin(memories, eq(memories.id, projectMemories.memoryId))
					.where(and(eq(projectMemories.projectId, project.id), ne(memories.permission, "locked")))
					.orderBy(asc(projectMemories.sortOrder), asc(projectMemories.memoryId)),
			]);

			for (const row of associatedMemories) projectMemoryIds.add(row.id);

			const overview = formatProjectOverview(project);
			const ruleItems = projectRules.map((rule) => ({
				key: `${rule.kind}:${rule.id}`,
				kind: "rule" as const,
				title: rule.statement,
				subtitle: `${rule.kind} · ${rule.severity} · ${rule.permission}`,
				text: formatRuleContextBlock(rule.kind as "convention" | "gotcha", rule),
			}));

			const items: ContextLoadoutItem[] = [
				{
					key: `project:${project.id}:overview`,
					kind: "overview",
					title: `Project: ${project.name}`,
					subtitle: `${projectRules.filter((rule) => rule.kind === "convention").length} conventions · ${projectRules.filter((rule) => rule.kind === "gotcha").length} gotchas`,
					text: overview,
				},
				...ruleItems,
			];

			sections.push({
				key: "project",
				title: "Project",
				description: project.name,
				items,
				text: joinContextBlocks(items.map((item) => item.text)),
			});
		}
	}

	if (activeDevMode) {
		const [devMode] = await db
			.select()
			.from(devModes)
			.where(eq(devModes.id, activeDevMode.id))
			.limit(1);
		if (devMode) {
			const [principles, associatedMemories] = await Promise.all([
				db
					.select()
					.from(rules)
					.where(and(eq(rules.devModeId, devMode.id), eq(rules.kind, "principle")))
					.orderBy(asc(rules.sortOrder), asc(rules.id)),
				db
					.select({ id: devModeMemories.memoryId })
					.from(devModeMemories)
					.innerJoin(memories, eq(memories.id, devModeMemories.memoryId))
					.where(and(eq(devModeMemories.devModeId, devMode.id), ne(memories.permission, "locked")))
					.orderBy(asc(devModeMemories.sortOrder), asc(devModeMemories.memoryId)),
			]);

			for (const row of associatedMemories) devModeMemoryIds.add(row.id);

			const overview = formatDevModeOverview(devMode);
			const principleItems = principles.map((principle) => ({
				key: `principle:${principle.id}`,
				kind: "principle" as const,
				title: principle.statement,
				subtitle: `${principle.severity} · ${principle.permission}`,
				text: formatRuleContextBlock("principle", principle),
			}));

			const items: ContextLoadoutItem[] = [
				{
					key: `dev-mode:${devMode.id}:overview`,
					kind: "overview",
					title: `Dev Mode: ${devMode.name}`,
					subtitle: `${principles.length} principles`,
					text: overview,
				},
				...principleItems,
			];

			sections.push({
				key: "dev-mode",
				title: "Dev Mode",
				description: devMode.name,
				items,
				text: joinContextBlocks(items.map((item) => item.text)),
			});
		}
	}

	const memoryIds = [...new Set([...projectMemoryIds, ...devModeMemoryIds])];
	if (memoryIds.length > 0) {
		const activeMemories = await db
			.select()
			.from(memories)
			.where(and(inArray(memories.id, memoryIds), ne(memories.permission, "locked")))
			.orderBy(asc(memories.title));

		const items = activeMemories.map((memory) => {
			const placement = resolveMemoryPlacement(memory.id, projectMemoryIds, devModeMemoryIds);
			return {
				key: `memory:${memory.id}`,
				kind: "memory" as const,
				title: memory.title,
				subtitle: formatMemoryLoadoutSubtitle(memory, placement),
				text: formatMemoryContextBlock(memory, placement),
				memoryId: memory.id,
			};
		});

		sections.push({
			key: "memories",
			title: "Memories",
			description: `${items.length} active memories`,
			items,
			text: joinContextBlocks(items.map((item) => item.text)),
		});
	}

	const text = joinContextBlocks(sections.map((section) => section.text));
	return {
		activeProject: activeProject ? { id: activeProject.id, name: activeProject.name } : null,
		activeDevMode: activeDevMode ? { id: activeDevMode.id, name: activeDevMode.name } : null,
		sections,
		text,
		counts: {
			sections: sections.length,
			items: sections.reduce((total, section) => total + section.items.length, 0),
			memories: memoryIds.length,
		},
	};
}
