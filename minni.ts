/**
 * Minni — Persistent structured memory for OpenCode AI agents.
 *
 * 6 tools: hud, equip, memory, project, task, canvas
 * Session compaction hook injects identity + context
 * Web viewer at http://localhost:8593
 *
 * Database: ~/.config/opencode/minni.db (Turso/libSQL)
 */
import type { Plugin } from "@opencode-ai/plugin";

import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";
import { homedir } from "node:os";
import { join } from "node:path";

import { getActiveProject, getActiveIdentity } from "./src/helpers";
import { initializeDatabase } from "./src/init";
import { memories } from "./src/schema";
import { startViewerServer } from "./src/server";
import { createTools } from "./src/tools/index";

export const MinniPlugin: Plugin = async () => {
	const dbPath = join(homedir(), ".config", "opencode", "minni.db");
	const db = drizzle(dbPath);

	await initializeDatabase(db);
	await startViewerServer(db);

	return {
		/**
		 * Session compaction hook.
		 * Injects active identity and project/global context into compacted sessions.
		 */
		"experimental.session.compacting": async (
			_input: unknown,
			output: { context: string[]; prompt?: string },
		) => {
			const baseParts: string[] = [];

			// Identity injection
			const identity = await getActiveIdentity(db);
			if (identity) {
				baseParts.push(
					`[IDENTITY:${identity.title}]\n${identity.content}\n[/IDENTITY:${identity.title}]`,
				);
			}

			// Context memory: active project scope or global
			const active = await getActiveProject(db);
			const contextMem = await db
				.select()
				.from(memories)
				.where(
					active
						? and(eq(memories.type, "context"), eq(memories.projectId, active.id))
						: and(eq(memories.type, "context"), isNull(memories.projectId)),
				)
				.limit(1);

			if (contextMem[0]) {
				const ctxLabel = active ? active.name : "global";
				baseParts.push(`[CTX:${ctxLabel}]\n${contextMem[0].content}\n[/CTX:${ctxLabel}]`);
			}

			if (baseParts.length > 0) {
				output.context.push(`<minni-context>\n${baseParts.join("\n\n")}\n</minni-context>`);
			}
		},

		tool: createTools(db),
	};
};
