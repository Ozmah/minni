import type { Plugin } from "@opencode-ai/plugin";
import { drizzle } from "drizzle-orm/tursodatabase/database";
import { eq } from "drizzle-orm";
import { projects, globalContext } from "./src/schema";
import { initializeDatabase } from "./src/init";
import { getActiveProject, loadActiveProject } from "./src/helpers";
import { createTools } from "./src/tools";

import { homedir } from "node:os";
import { join } from "node:path";

export const MinniPlugin: Plugin = async () => {
	const dbPath = join(homedir(), ".config", "opencode", "minni.db");
	const db = drizzle(dbPath);
	await initializeDatabase(db);
	await loadActiveProject(db);

	return {
		"experimental.session.compacting": async (
			_input: unknown,
			output: { context: string[]; prompt?: string },
		) => {
			// Always load global context (identity + preferences are universal)
			const ctx = await db
				.select()
				.from(globalContext)
				.where(eq(globalContext.id, 1))
				.limit(1);

			const baseParts: string[] = [];
			if (ctx[0]?.identity) baseParts.push(`## Identity\n${ctx[0].identity}`);
			if (ctx[0]?.preferences) baseParts.push(`## Preferences\n${ctx[0].preferences}`);

			// Context layer: project-specific or global
			const active = getActiveProject();
			let contextSummary: string | null = null;

			if (active) {
				const proj = await db
					.select()
					.from(projects)
					.where(eq(projects.id, active.id))
					.limit(1);
				contextSummary = proj[0]?.contextSummary ?? null;
				if (contextSummary) {
					baseParts.push(`## Project: ${active.name}\n${contextSummary}`);
				}
			} else {
				contextSummary = ctx[0]?.contextSummary ?? null;
				if (contextSummary) {
					baseParts.push(`## Last Session (Global)\n${contextSummary}`);
				}
			}

			if (baseParts.length > 0) {
				output.context.push(`<minni-context>\n${baseParts.join("\n\n")}\n</minni-context>`);
			}
		},

		tool: createTools(db),
	};
};
