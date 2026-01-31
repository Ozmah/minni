/**
 * Minni Viewer Server
 *
 * Serves the React frontend and provides APIs for:
 * - Canvas (real-time markdown preview via SSE)
 * - Database queries (projects, memories, tasks)
 */

import { join } from "node:path";

import type { MinniDB } from "../helpers";

import { handleStats, handleProjects, handleMemories, handleTasks } from "./api";
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

		// Database API
		if (path === "/api/stats") {
			return handleStats(db);
		}

		if (path === "/api/projects") {
			return handleProjects(db);
		}

		if (path === "/api/memories") {
			return handleMemories(db, url);
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

	const distPath = join(import.meta.dir, "../../viewer/dist");
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
