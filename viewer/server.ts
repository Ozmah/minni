import { desc, eq, sql, count } from "drizzle-orm";

import type { MinniDB } from "../src/helpers";

import { projects, memories, tasks, globalContext } from "../src/schema";

// Singleton to track server state
let viewerServer: ReturnType<typeof Bun.serve> | null = null;
let activePort: number | null = null;

// Canvas state - shared across SSE subscribers
const canvasState = {
	content: "",
	timestamp: 0,
};

/**
 * Generate candidate ports: preferred first, then random high ports
 */
function* portCandidates(preferred = 8593, maxAttempts = 5): Generator<number> {
	yield preferred;
	for (let i = 1; i < maxAttempts; i++) {
		yield 49152 + Math.floor(Math.random() * 16383);
	}
}

// SSE subscribers for canvas updates
const canvasSubscribers = new Set<ReadableStreamDefaultController>();

// SSE subscribers for DB changes (future: could hook into drizzle events)
const dbSubscribers = new Set<ReadableStreamDefaultController>();

// Heartbeat interval for SSE cleanup (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Send heartbeat to all subscribers and clean up dead connections
 */
function heartbeat() {
	const heartbeatMsg = `data: {"heartbeat":true}\n\n`;
	const encoded = new TextEncoder().encode(heartbeatMsg);

	for (const controller of canvasSubscribers) {
		try {
			controller.enqueue(encoded);
		} catch {
			canvasSubscribers.delete(controller);
		}
	}

	for (const controller of dbSubscribers) {
		try {
			controller.enqueue(encoded);
		} catch {
			dbSubscribers.delete(controller);
		}
	}
}

/**
 * Broadcast content to all canvas subscribers
 */
function broadcastCanvas(content: string) {
	canvasState.content = content;
	canvasState.timestamp = Date.now();

	const message = `data: ${JSON.stringify(canvasState)}\n\n`;
	for (const controller of canvasSubscribers) {
		try {
			controller.enqueue(new TextEncoder().encode(message));
		} catch {
			canvasSubscribers.delete(controller);
		}
	}
}

/**
 * Notify DB subscribers of changes
 */
function notifyDbChange(table: string, action: string) {
	const message = `data: ${JSON.stringify({ table, action, timestamp: Date.now() })}\n\n`;
	for (const controller of dbSubscribers) {
		try {
			controller.enqueue(new TextEncoder().encode(message));
		} catch {
			dbSubscribers.delete(controller);
		}
	}
}

/**
 * Create SSE stream response
 */
function createSSEStream(
	subscribers: Set<ReadableStreamDefaultController>,
	initialData?: unknown,
): Response {
	const stream = new ReadableStream({
		start(controller) {
			subscribers.add(controller);

			// Send initial data if provided
			if (initialData !== undefined) {
				const message = `data: ${JSON.stringify(initialData)}\n\n`;
				controller.enqueue(new TextEncoder().encode(message));
			}
		},
		cancel(controller) {
			subscribers.delete(controller);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
		},
	});
}

/**
 * Start the Minni Viewer server
 * Runs in the same process as the plugin, sharing the db instance
 */
export async function startViewerServer(db: MinniDB) {
	// Already running in this process
	if (viewerServer && activePort) {
		console.log(`[Minni Viewer] Already running at http://localhost:${activePort}`);
		return { server: viewerServer, port: activePort, broadcastCanvas, notifyDbChange };
	}

	// Try ports until one works (no race condition)
	for (const port of portCandidates()) {
		try {
			const server = Bun.serve({
				port,
				idleTimeout: 255, // Prevent idle shutdown

				async fetch(req) {
					const url = new URL(req.url);
					const path = url.pathname;

					// CORS preflight
					if (req.method === "OPTIONS") {
						return new Response(null, {
							headers: {
								"Access-Control-Allow-Origin": "*",
								"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
								"Access-Control-Allow-Headers": "Content-Type",
							},
						});
					}

					// === STATIC ROUTES ===

					if (path === "/" || path === "/index.html") {
						const html = await Bun.file(new URL("./index.html", import.meta.url).pathname).text();
						return new Response(html, {
							headers: { "Content-Type": "text/html" },
						});
					}

					if (path === "/styles.css") {
						const css = await Bun.file(new URL("./styles.css", import.meta.url).pathname).text();
						return new Response(css, {
							headers: { "Content-Type": "text/css" },
						});
					}

					// === CANVAS ROUTES ===

					// SSE stream for canvas updates
					if (path === "/canvas/stream") {
						return createSSEStream(canvasSubscribers, canvasState);
					}

					// Push content to canvas (called by minni_canvas tool)
					if (path === "/canvas/push" && req.method === "POST") {
						try {
							const body = (await req.json()) as { content: string };
							broadcastCanvas(body.content);
							return Response.json({ ok: true, timestamp: canvasState.timestamp });
						} catch (e) {
							return Response.json({ ok: false, error: String(e) }, { status: 400 });
						}
					}

					// Get current canvas state
					if (path === "/canvas") {
						return Response.json(canvasState);
					}

					// === DB ROUTES ===

					// SSE stream for DB change notifications
					if (path === "/db/stream") {
						return createSSEStream(dbSubscribers);
					}

					// Stats overview
					if (path === "/db/stats") {
						const [memoryCount, projectCount, taskCount] = await Promise.all([
							db.select({ total: count() }).from(memories),
							db
								.select({ total: count() })
								.from(projects)
								.where(sql`status != 'deleted'`),
							db.select({ total: count() }).from(tasks),
						]);

						const ctx = await db
							.select()
							.from(globalContext)
							.where(eq(globalContext.id, 1))
							.limit(1);

						return Response.json({
							memories: memoryCount[0].total,
							projects: projectCount[0].total,
							tasks: taskCount[0].total,
							hasIdentity: !!ctx[0]?.identity,
							hasPreferences: !!ctx[0]?.preferences,
						});
					}

					// List projects
					if (path === "/db/projects") {
						const all = await db
							.select()
							.from(projects)
							.where(sql`status != 'deleted'`)
							.orderBy(desc(projects.updatedAt));
						return Response.json(all);
					}

					// List memories (with optional project filter)
					if (path === "/db/memories") {
						const projectId = url.searchParams.get("project");
						const limit = parseInt(url.searchParams.get("limit") || "50");

						let query = db
							.select()
							.from(memories)
							.where(sql`permission != 'locked'`)
							.orderBy(desc(memories.updatedAt))
							.limit(limit);

						if (projectId) {
							query = db
								.select()
								.from(memories)
								.where(sql`permission != 'locked' AND project_id = ${parseInt(projectId)}`)
								.orderBy(desc(memories.updatedAt))
								.limit(limit);
						}

						const all = await query;
						return Response.json(all);
					}

					// Get single memory
					if (path.startsWith("/db/memory/")) {
						const id = parseInt(path.split("/").pop() || "0");
						const mem = await db.select().from(memories).where(eq(memories.id, id)).limit(1);

						if (!mem[0]) {
							return Response.json({ error: "Not found" }, { status: 404 });
						}
						if (mem[0].permission === "locked") {
							return Response.json({ error: "Locked" }, { status: 403 });
						}

						return Response.json(mem[0]);
					}

					// List tasks (with optional project filter)
					if (path === "/db/tasks") {
						const projectId = url.searchParams.get("project");
						const limit = parseInt(url.searchParams.get("limit") || "50");

						let all;
						if (projectId) {
							all = await db
								.select()
								.from(tasks)
								.where(eq(tasks.projectId, parseInt(projectId)))
								.orderBy(desc(tasks.updatedAt))
								.limit(limit);
						} else {
							all = await db.select().from(tasks).orderBy(desc(tasks.updatedAt)).limit(limit);
						}

						return Response.json(all);
					}

					// 404
					return Response.json({ error: "Not found" }, { status: 404 });
				},
			});

			// Success! Server started on this port
			viewerServer = server;
			activePort = port;
			console.log(`[Minni Viewer] Running at http://localhost:${port}`);

			// Start heartbeat for SSE cleanup
			if (!heartbeatTimer) {
				heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);
			}

			return { server, port, broadcastCanvas, notifyDbChange };
		} catch (error) {
			// Port likely in use (EADDRINUSE), try next
			const isPortInUse =
				error instanceof Error &&
				(error.message.includes("EADDRINUSE") || error.message.includes("address already in use"));
			if (!isPortInUse) {
				console.error(`[Minni Viewer] Unexpected error on port ${port}:`, error);
			}
			continue;
		}
	}

	// All ports failed
	console.error(`[Minni Viewer] Failed to start: no available ports`);
	return { server: null, port: null, broadcastCanvas, notifyDbChange };
}

/** Get the current viewer port (for tools to use) */
export function getViewerPort(): number | null {
	return activePort;
}

/** Stop the viewer server and cleanup resources */
export function stopViewerServer(): void {
	if (heartbeatTimer) {
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}
	if (viewerServer) {
		viewerServer.stop();
		viewerServer = null;
		activePort = null;
	}
	canvasSubscribers.clear();
	dbSubscribers.clear();
}

// Export for use by minni_canvas tool
export { broadcastCanvas };
