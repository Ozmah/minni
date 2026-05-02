import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type {
	ActiveContextLoadout,
	ContextCopyLayer,
	ContextLoadoutItem,
	ContextMemoryPlacement,
} from "./types";

import { getActiveDevMode, getActiveProject, type MinniDB } from "../../helpers";
import {
	devModeMemories,
	devModes,
	memories,
	projectMemories,
	projects,
	rules,
} from "../../schema";
import { listInjectableProjectCommands } from "../commands/service";
import {
	formatCommandContextBlock,
	formatCommandLoadoutSubtitle,
	formatDevModeOverview,
	formatMemoryContextBlock,
	formatMemoryLoadoutSubtitle,
	formatProjectOverview,
	formatRuleContextBlock,
	joinContextBlocks,
	parseProjectStack,
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

function buildMemoryCopyLayer(
	key: ContextCopyLayer["key"],
	title: string,
	description: string,
	items: ContextLoadoutItem[],
): ContextCopyLayer | null {
	if (items.length === 0) return null;
	return {
		key,
		title,
		description,
		text: joinContextBlocks(items.map((item) => item.text)),
	};
}

function buildCopyLayers(sections: ActiveContextLoadout["sections"]): ContextCopyLayer[] {
	const layers: ContextCopyLayer[] = [];
	const projectSection = sections.find((section) => section.key === "project");
	const commandSection = sections.find((section) => section.key === "commands");
	const devModeSection = sections.find((section) => section.key === "dev-mode");
	const memorySection = sections.find((section) => section.key === "memories");

	if (projectSection) {
		layers.push({
			key: "project-profile",
			title: "Project profile",
			description: "Project overview, conventions, and gotchas",
			text: projectSection.text,
		});
	}

	if (commandSection) {
		layers.push({
			key: "project-commands",
			title: "Project commands",
			description: "Injectable commands for the active project",
			text: commandSection.text,
		});
	}

	if (devModeSection) {
		layers.push({
			key: "dev-mode-profile",
			title: "Dev Mode profile",
			description: "Dev Mode overview and principles",
			text: devModeSection.text,
		});
	}

	if (memorySection) {
		const memoryItems = memorySection.items;
		const projectOnly = memoryItems.filter((item) => item.memory?.placement === "project");
		const devModeOnly = memoryItems.filter((item) => item.memory?.placement === "dev_mode");
		const shared = memoryItems.filter((item) => item.memory?.placement === "shared");

		layers.push({
			key: "active-memories",
			title: "Active memories",
			description: "All Project + Dev Mode memories in the current loadout",
			text: memorySection.text,
		});

		for (const layer of [
			buildMemoryCopyLayer(
				"project-only-memories",
				"Project-only memories",
				"Memories attached only to the active project",
				projectOnly,
			),
			buildMemoryCopyLayer(
				"dev-mode-only-memories",
				"Dev Mode-only memories",
				"Memories attached only to the active dev mode",
				devModeOnly,
			),
			buildMemoryCopyLayer(
				"shared-memories",
				"Shared memories",
				"Memories attached to both active project and active dev mode",
				shared,
			),
		]) {
			if (layer) layers.push(layer);
		}
	}

	return layers;
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
			const [projectRules, associatedMemories, projectCommands] = await Promise.all([
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
				listInjectableProjectCommands(db, project.id),
			]);

			for (const row of associatedMemories) projectMemoryIds.add(row.id);

			const conventionCount = projectRules.filter((rule) => rule.kind === "convention").length;
			const gotchaCount = projectRules.filter((rule) => rule.kind === "gotcha").length;
			const overview = formatProjectOverview(project);
			const ruleItems = projectRules.map((rule) => ({
				key: `${rule.kind}:${rule.id}`,
				kind: "rule" as const,
				title: rule.statement,
				subtitle: `${rule.kind} · ${rule.severity} · ${rule.permission}`,
				text: formatRuleContextBlock(rule.kind as "convention" | "gotcha", rule),
				rule: {
					kind: rule.kind as "convention" | "gotcha",
					statement: rule.statement,
					rationale: rule.rationale,
					severity: rule.severity,
					permission: rule.permission,
					example: rule.example,
				},
			}));

			const items: ContextLoadoutItem[] = [
				{
					key: `project:${project.id}:overview`,
					kind: "overview",
					title: `Project: ${project.name}`,
					subtitle: `${conventionCount} conventions · ${gotchaCount} gotchas`,
					text: overview,
					overview: {
						type: "project",
						name: project.name,
						description: project.description,
						permission: project.permission,
						stack: parseProjectStack(project.stack),
						conventionCount,
						gotchaCount,
					},
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

			if (projectCommands.length > 0) {
				const commandItems = projectCommands.map((command) => ({
					key: `command:${command.id}`,
					kind: "command" as const,
					title: command.key,
					subtitle: formatCommandLoadoutSubtitle(command),
					text: formatCommandContextBlock(command),
					command: {
						key: command.key,
						command: command.command,
						summary: command.summary,
						group: command.group,
						risk: command.risk,
						visibility: command.visibility,
						permission: command.permission,
						notes: command.notes,
					},
				}));

				sections.push({
					key: "commands",
					title: "Commands",
					description: `${projectCommands.length} project commands`,
					items: commandItems,
					text: joinContextBlocks(commandItems.map((item) => item.text)),
				});
			}
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
				rule: {
					kind: "principle" as const,
					statement: principle.statement,
					rationale: principle.rationale,
					severity: principle.severity,
					permission: principle.permission,
					example: principle.example,
				},
			}));

			const items: ContextLoadoutItem[] = [
				{
					key: `dev-mode:${devMode.id}:overview`,
					kind: "overview",
					title: `Dev Mode: ${devMode.name}`,
					subtitle: `${principles.length} principles`,
					text: overview,
					overview: {
						type: "dev-mode",
						name: devMode.name,
						description: devMode.description,
						permission: devMode.permission,
						principleCount: principles.length,
					},
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
				memory: {
					id: memory.id,
					title: memory.title,
					type: memory.type,
					status: memory.status,
					permission: memory.permission,
					placement,
					content: memory.content,
				},
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
	const copyLayers = buildCopyLayers(sections);
	return {
		activeProject: activeProject ? { id: activeProject.id, name: activeProject.name } : null,
		activeDevMode: activeDevMode ? { id: activeDevMode.id, name: activeDevMode.name } : null,
		sections,
		copyLayers,
		text,
		counts: {
			sections: sections.length,
			items: sections.reduce((total, section) => total + section.items.length, 0),
			memories: memoryIds.length,
			commands: sections.find((section) => section.key === "commands")?.items.length ?? 0,
		},
	};
}
