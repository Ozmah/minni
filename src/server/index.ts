/**
 * Minni Viewer Server
 *
 * Serves the React frontend and provides APIs for:
 * - Canvas (real-time markdown preview via SSE)
 * - Database queries (projects, memories, tasks)
 */

import { join } from "node:path";

import type { MinniDB } from "../helpers";

import {
	handleStats,
	handleProjects,
	handleProject,
	handleMemories,
	handleMemory,
	handleTask,
	handleTasks,
	handleDeleteProject,
	handleDeleteMemory,
	handleDeleteTask,
} from "./api";
import {
	handleStream,
	handleGetPages,
	handlePush,
	handleDelete,
	handleClear,
	getRuntimeInfo,
} from "./canvas";
import { startHeartbeat } from "./sse";
import { handleStatic, handleCORS } from "./static";
import { DEFAULT_CONFIG } from "./types";

// === Server State ===

let viewerServer: ReturnType<typeof Bun.serve> | null = null;
let activePort: number | null = null;

export function getViewerPort(): number | null {
	return activePort;
}

// === Router ===

function createRouter(db: MinniDB, distPath: string) {
	return async (req: Request): Promise<Response> => {
		const url = new URL(req.url);
		const path = url.pathname;

		// CORS preflight
		if (req.method === "OPTIONS") {
			return handleCORS();
		}

		// Canvas API
		if (path === "/api/canvas/stream") {
			return handleStream();
		}

		if (path === "/api/canvas/push" && req.method === "POST") {
			return handlePush(req);
		}

		if (path === "/api/canvas/pages") {
			return handleGetPages();
		}

		if (path.startsWith("/api/canvas/delete/")) {
			return handleDelete(path);
		}

		if (path === "/api/canvas/clear" && req.method === "POST") {
			return handleClear();
		}

		// Runtime info
		if (path === "/api/runtime") {
			return Response.json(getRuntimeInfo());
		}

		// Debug distPath
		if (path === "/api/debug-path") {
			const indexFile = Bun.file(join(distPath, "index.html"));
			const assetsDir = join(distPath, "assets");
			return Response.json({
				distPath,
				importMetaDir: import.meta.dir,
				indexExists: await indexFile.exists(),
				assetsPath: assetsDir,
			});
		}

		// Database API
		if (path === "/api/stats") {
			return handleStats(db);
		}

		// Single project by ID
		const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
		if (projectMatch) {
			const id = parseInt(projectMatch[1], 10);
			if (req.method === "DELETE") {
				return handleDeleteProject(db, id);
			}
			return handleProject(db, id);
		}

		if (path === "/api/projects") {
			return handleProjects(db);
		}

		// Single memory by ID
		const memoryMatch = path.match(/^\/api\/memories\/(\d+)$/);
		if (memoryMatch) {
			const id = parseInt(memoryMatch[1], 10);
			if (req.method === "DELETE") {
				return handleDeleteMemory(db, id);
			}
			return handleMemory(db, id);
		}

		if (path === "/api/memories") {
			return handleMemories(db, url);
		}

		// Single task by ID
		const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
		if (taskMatch) {
			const id = parseInt(taskMatch[1], 10);
			if (req.method === "DELETE") {
				return handleDeleteTask(db, id);
			}
			return handleTask(db, id);
		}

		if (path === "/api/tasks") {
			return handleTasks(db, url);
		}

		// Static files (frontend)
		return handleStatic(path, distPath);
	};
}

// === Server Startup ===

export async function startViewerServer(db: MinniDB) {
	if (viewerServer && activePort) {
		return { server: viewerServer, port: activePort };
	}

	// import.meta.dir points to this file's directory (src/server/)
	// Go up to root, then into viewer/dist
	const distPath = join(import.meta.dir, "..", "..", "viewer", "dist");
	const router = createRouter(db, distPath);

	// Try preferred port first
	const preferredPort = DEFAULT_CONFIG.preferredPort;

	const tryPort = (port: number): ReturnType<typeof Bun.serve> | null => {
		try {
			return Bun.serve({
				port,
				idleTimeout: 255,
				fetch: router,
			});
		} catch {
			return null;
		}
	};

	let server = tryPort(preferredPort);

	if (server) {
		activePort = preferredPort;
	} else {
		// Fallback: let OS assign a port
		server = Bun.serve({
			port: 0,
			idleTimeout: 255,
			fetch: router,
		});
		activePort = server.port ?? null;
	}

	viewerServer = server;
	startHeartbeat();

	console.log(`[Minni Viewer] http://localhost:${activePort}`);

	return { server, port: activePort };
}

// Re-export for tools/canvas.ts
export { getPages, addPage } from "./canvas";
