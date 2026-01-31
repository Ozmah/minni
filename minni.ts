/**
 * Minni — Persistent structured memory for OpenCode AI agents.
 *
 * This plugin provides:
 * - 12 tools for managing memories, projects, tasks, and canvas
 * - Session compaction hook to inject context
 * - Web viewer at http://localhost:8593
 *
 * Database: ~/.config/opencode/minni.db (Turso/libSQL)
 */
import type { Plugin } from "@opencode-ai/plugin";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";
import { homedir } from "node:os";
import { join } from "node:path";

import { getActiveProject } from "./src/helpers";
import { initializeDatabase } from "./src/init";
import { projects, globalContext } from "./src/schema";
import { startViewerServer } from "./src/server";
import { createTools } from "./src/tools/index";

export const MinniPlugin: Plugin = async () => {
	const dbPath = join(homedir(), ".config", "opencode", "minni.db");
	const db = drizzle(dbPath);

	await initializeDatabase(db);
	await startViewerServer(db);

	return {
		/**
		 * TODO add custom opt-in prompts, this change will come along with the configuration file
		 * Session compaction hook
		 * Injects global identity/preferences and project context into compacted sessions.
		 */
		"experimental.session.compacting": async (
			_input: unknown,
			output: { context: string[]; prompt?: string },
		) => {
			const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);

			const baseParts: string[] = [];
			if (ctx[0]?.identity) baseParts.push(`## Identity\n${ctx[0].identity}`);
			if (ctx[0]?.preferences) baseParts.push(`## Preferences\n${ctx[0].preferences}`);

			const active = await getActiveProject(db);
			let contextSummary: string | null = null;

			if (active) {
				const proj = await db.select().from(projects).where(eq(projects.id, active.id)).limit(1);
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
