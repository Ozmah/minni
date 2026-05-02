import type { MinniDB } from "../../../helpers";
import type { ProjectCommandInput } from "../../commands/contracts";

import {
	activeState,
	commands,
	devModeMemories,
	devModes,
	memories,
	projectMemories,
	projects,
	rules,
	type Command,
	type DevMode,
	type Memory,
	type Project,
	type Rule,
} from "../../../schema";

function timestamps() {
	const now = new Date();
	return { createdAt: now, updatedAt: now };
}

export async function insertProject(
	db: MinniDB,
	overrides: Partial<typeof projects.$inferInsert> = {},
) {
	const [project] = await db
		.insert(projects)
		.values({
			name: `project-${crypto.randomUUID()}`,
			description: "Test project",
			stack: JSON.stringify(["TypeScript", "Bun"]),
			permission: "guarded",
			...timestamps(),
			...overrides,
		})
		.returning();
	return project as Project;
}

export async function insertDevMode(
	db: MinniDB,
	overrides: Partial<typeof devModes.$inferInsert> = {},
) {
	const [devMode] = await db
		.insert(devModes)
		.values({
			name: `dev-mode-${crypto.randomUUID()}`,
			description: "Test dev mode",
			permission: "guarded",
			...timestamps(),
			...overrides,
		})
		.returning();
	return devMode as DevMode;
}

export async function setActiveLoadout(db: MinniDB, projectId: number, devModeId: number) {
	await db.update(activeState).set({ activeProjectId: projectId, activeDevModeId: devModeId });
}

export async function insertMemory(
	db: MinniDB,
	overrides: Partial<typeof memories.$inferInsert> = {},
) {
	const [memory] = await db
		.insert(memories)
		.values({
			type: "note",
			title: `Memory ${crypto.randomUUID()}`,
			content: "Useful project context.",
			status: "proven",
			permission: "guarded",
			...timestamps(),
			...overrides,
		})
		.returning();
	return memory as Memory;
}

export async function attachProjectMemory(
	db: MinniDB,
	projectId: number,
	memoryId: number,
	sortOrder = 0,
) {
	await db.insert(projectMemories).values({ projectId, memoryId, sortOrder });
}

export async function attachDevModeMemory(
	db: MinniDB,
	devModeId: number,
	memoryId: number,
	sortOrder = 0,
) {
	await db.insert(devModeMemories).values({ devModeId, memoryId, sortOrder });
}

export async function insertRule(db: MinniDB, overrides: Partial<typeof rules.$inferInsert>) {
	const [rule] = await db
		.insert(rules)
		.values({
			kind: "convention",
			statement: "Use canonical context.",
			rationale: "Avoid drift.",
			severity: "critical",
			permission: "guarded",
			example: "Cockpit and equip share the same builder.",
			sortOrder: 0,
			...timestamps(),
			...overrides,
		})
		.returning();
	return rule as Rule;
}

export async function insertCommand(db: MinniDB, overrides: Partial<typeof commands.$inferInsert>) {
	const [command] = await db
		.insert(commands)
		.values({
			projectId: overrides.projectId ?? 1,
			key: `command:${crypto.randomUUID()}`,
			command: "bun run glados",
			summary: "Run project validation.",
			group: "quality",
			risk: "safe",
			visibility: "secondary",
			permission: "guarded",
			notes: null,
			sortOrder: 0,
			...timestamps(),
			...overrides,
		})
		.returning();
	return command as Command;
}

export function commandInput(overrides: Partial<ProjectCommandInput> = {}): ProjectCommandInput {
	return {
		key: "quality:glados",
		command: "bun run glados",
		summary: "Full validation suite",
		group: "quality",
		risk: "safe",
		visibility: "primary",
		permission: "guarded",
		notes: "Run before syncing.",
		...overrides,
	};
}
