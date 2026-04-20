/**
 * Minni — Persistent structured memory for OpenCode AI agents.
 *
 * 5 tools: hud, equip, memory, project, canvas
 * Web viewer at http://localhost:8593
 *
 * Database: ~/.config/opencode/minni.db (Turso/libSQL)
 */
import type { Plugin } from "@opencode-ai/plugin";

import { drizzle } from "drizzle-orm/tursodatabase/database";
import { homedir } from "node:os";
import { join } from "node:path";

import { initializeDatabase } from "./src/init";
import { startViewerServer } from "./src/server";
import { createTools } from "./src/tools/index";

const dbPath = join(homedir(), ".config", "opencode", "minni.db");
const db = drizzle(dbPath);

let bootPromise: Promise<void> | null = null;

function boot() {
	if (!bootPromise) {
		bootPromise = (async () => {
			await initializeDatabase(db);
			await startViewerServer(db);
		})().catch((err) => {
			bootPromise = null;
			throw err;
		});
	}

	return bootPromise;
}

export const MinniPlugin: Plugin = async () => {
	await boot();

	return {
		/**
		 * Session compaction hook.
		 * Minni no longer injects legacy identity/context memories during compaction.
		 */
		"experimental.session.compacting": async (
			_input: unknown,
			output: { context: string[]; prompt?: string },
		) => {
			void output;
		},

		tool: createTools(db),
	};
};
