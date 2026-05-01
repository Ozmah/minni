import { and, asc, eq, ne, sql } from "drizzle-orm";

import type { MinniDB } from "../../helpers";
import type { ProjectCommandInput } from "./contracts";

import { commands } from "../../schema";

/** Sorts commands by loadout relevance while preserving explicit user order inside each group. */
export function commandOrder() {
	return [
		sql`CASE ${commands.visibility} WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END`,
		asc(commands.group),
		asc(commands.sortOrder),
		asc(commands.key),
	];
}

/** Loads the full project command deck, including hidden commands for Composer editing. */
export async function listProjectCommands(db: MinniDB, projectId: number) {
	return db
		.select()
		.from(commands)
		.where(eq(commands.projectId, projectId))
		.orderBy(...commandOrder());
}

/** Loads only commands that should be visible to active-context inspection and injection. */
export async function listInjectableProjectCommands(db: MinniDB, projectId: number) {
	return db
		.select()
		.from(commands)
		.where(
			and(
				eq(commands.projectId, projectId),
				ne(commands.visibility, "hidden"),
				ne(commands.permission, "locked"),
			),
		)
		.orderBy(...commandOrder());
}

/** Replaces a project's command deck inside the caller's transaction. */
export async function replaceProjectCommands(
	db: MinniDB,
	projectId: number,
	commandInputs: ProjectCommandInput[],
) {
	await db.delete(commands).where(eq(commands.projectId, projectId));

	const normalized = commandInputs
		.map((command, sortOrder) => ({ command, sortOrder }))
		.filter(({ command }) => command.key.trim() && command.command.trim());

	if (normalized.length === 0) return;

	await db.insert(commands).values(
		normalized.map(({ command, sortOrder }) => ({
			projectId,
			key: command.key.trim(),
			command: command.command.trim(),
			summary: command.summary?.trim() || null,
			group: command.group,
			risk: command.risk,
			visibility: command.visibility,
			permission: command.permission,
			notes: command.notes?.trim() || null,
			sortOrder,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
	);
}
