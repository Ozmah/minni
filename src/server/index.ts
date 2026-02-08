/**
 * Minni Viewer Server
 *
 * Elysia-powered API serving:
 * - Canvas (persistent markdown pages)
 * - Database queries (projects, memories, tasks)
 * - SSE event stream (invalidation signals)
 * - Static frontend (React SPA)
 */

import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { MinniDB } from "../helpers";

import { getRuntimeInfo } from "./lib/canvas";
import { canvasRoutes } from "./routes/canvas";
import { eventsRoutes } from "./routes/events";
import { memoryRoutes } from "./routes/memories";
import { projectRoutes } from "./routes/projects";
import { statsRoutes } from "./routes/stats";
import { taskRoutes } from "./routes/tasks";
import { DEFAULT_CONFIG } from "./types";

// === Server State ===

let viewerServer: ReturnType<typeof Elysia.prototype.listen> | null = null;
let activePort: number | null = null;

export function getViewerPort(): number | null {
	return activePort;
}

// === App Factory ===

async function createApp(db: MinniDB, distPath: string) {
	return (
		new Elysia()
			.use(
				cors({
					origin: process.env.CORS_ORIGIN || "",
					methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
					allowedHeaders: ["Content-Type", "Authorization"],
					credentials: true,
				}),
			)
			.use(
				await staticPlugin({
					assets: distPath,
					prefix: "/",
				}),
			)
			.use(statsRoutes(db))
			.use(projectRoutes(db))
			.use(memoryRoutes(db))
			.use(taskRoutes(db))
			.use(canvasRoutes(db))
			.use(eventsRoutes())
			.get("/api/runtime", () => getRuntimeInfo())
			// SPA fallback: any unmatched route returns index.html for client-side routing
			.get(
				"*",
				async () =>
					new Response(await readFile(join(distPath, "index.html"), "utf8"), {
						headers: { "Content-Type": "text/html" },
					}),
				{ detail: { hide: true } },
			)
	);
}

// === Server Startup ===

export async function startViewerServer(db: MinniDB) {
	if (viewerServer && activePort) {
		return { server: viewerServer, port: activePort };
	}

	const distPath = join(import.meta.dir, "..", "..", "viewer", "dist");
	const app = await createApp(db, distPath);

	const preferredPort = DEFAULT_CONFIG.preferredPort;

	try {
		viewerServer = app.listen(preferredPort);
		activePort = preferredPort;
	} catch {
		// Fallback: let OS assign a port
		viewerServer = app.listen(0);
		activePort = viewerServer.server?.port ?? null;
	}

	console.log(`[Minni Viewer] http://localhost:${activePort}`);

	return { server: viewerServer, port: activePort };
}

// Re-export for tools
export { getPages, getPageCount, addPage } from "./lib/canvas";
