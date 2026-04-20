import { defineRelations } from "drizzle-orm";

import * as tables from "./tables";

export const relations = defineRelations(tables, (r) => ({
	activeState: {
		project: r.one.projects({
			from: r.activeState.activeProjectId,
			to: r.projects.id,
		}),
		devMode: r.one.devModes({
			from: r.activeState.activeDevModeId,
			to: r.devModes.id,
		}),
	},
	projects: {
		commands: r.many.commands(),
		rules: r.many.rules(),
		projectMemories: r.many.projectMemories(),
	},
	devModes: {
		rules: r.many.rules(),
		devModeMemories: r.many.devModeMemories(),
	},
	commands: {
		project: r.one.projects({
			from: r.commands.projectId,
			to: r.projects.id,
		}),
	},
	rules: {
		devMode: r.one.devModes({
			from: r.rules.devModeId,
			to: r.devModes.id,
		}),
		project: r.one.projects({
			from: r.rules.projectId,
			to: r.projects.id,
		}),
	},
	memories: {
		projectMemories: r.many.projectMemories(),
		devModeMemories: r.many.devModeMemories(),
		memoryTags: r.many.memoryTags(),
	},
	projectMemories: {
		project: r.one.projects({
			from: r.projectMemories.projectId,
			to: r.projects.id,
		}),
		memory: r.one.memories({
			from: r.projectMemories.memoryId,
			to: r.memories.id,
		}),
	},
	devModeMemories: {
		devMode: r.one.devModes({
			from: r.devModeMemories.devModeId,
			to: r.devModes.id,
		}),
		memory: r.one.memories({
			from: r.devModeMemories.memoryId,
			to: r.memories.id,
		}),
	},
	tags: {
		memoryTags: r.many.memoryTags(),
	},
	memoryTags: {
		memory: r.one.memories({
			from: r.memoryTags.memoryId,
			to: r.memories.id,
		}),
		tag: r.one.tags({
			from: r.memoryTags.tagId,
			to: r.tags.id,
		}),
	},
	memoryRelations: {
		sourceMemory: r.one.memories({
			from: r.memoryRelations.memoryId,
			to: r.memories.id,
			alias: "source_memory",
		}),
		relatedMemory: r.one.memories({
			from: r.memoryRelations.relatedId,
			to: r.memories.id,
			alias: "related_memory",
		}),
	},
}));
