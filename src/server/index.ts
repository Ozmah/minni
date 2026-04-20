/**
 * Minni Viewer Server
 *
 * Elysia-powered API serving:
 * - Canvas (persistent markdown pages)
 * - Database queries (projects, memories, tasks)
 * - Polling-based change detection (invalidation signals)
 * - Static frontend (React SPA)
 */

import type { AddressInfo } from "node:net";

import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { Readable } from "node:stream";

import type { MinniDB } from "../helpers";

import { getRuntimeInfo } from "./lib/canvas";
import { canvasRoutes } from "./routes/canvas";
import { changesRoutes } from "./routes/changes";
import { hudRoutes } from "./routes/hud";
import { memoryRoutes } from "./routes/memories";
import { projectRoutes } from "./routes/projects";
import { statsRoutes } from "./routes/stats";
import { taskRoutes } from "./routes/tasks";
import { DEFAULT_CONFIG } from "./types";

// === Server State ===

let viewerServer: Server | null = null;
let activePort: number | null = null;
const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);

function shouldServeSpaFallback(pathname: string, response: Response) {
	if (response.status !== 404) return false;
	if (pathname === "/") return false;
	if (pathname.startsWith("/api/")) return false;

	const lastSegment = pathname.split("/").pop() ?? "";
	return !lastSegment.includes(".");
}

export function getViewerPort(): number | null {
	return activePort;
}

// === App Factory ===

async function createApp(db: MinniDB, distPath: string) {
	const indexHTML = join(distPath, "index.html");

	return new Elysia()
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
				ignorePatterns: ["index.html"],
			}),
		)
		.use(statsRoutes(db))
		.use(hudRoutes(db))
		.use(projectRoutes(db))
		.use(memoryRoutes(db))
		.use(taskRoutes(db))
		.use(canvasRoutes(db))
		.use(changesRoutes())
		.get("/api/runtime", () => getRuntimeInfo())
		.get("/", () => new Response(Bun.file(indexHTML)))
		.get("/*", ({ path }) => {
			if (path.startsWith("/api/")) {
				return new Response("NOT_FOUND", { status: 404 });
			}

			return new Response(Bun.file(indexHTML));
		});
}

function createRequest(req: IncomingMessage, port: number) {
	const method = req.method ?? "GET";
	const headers = new Headers();

	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			for (const item of value) headers.append(key, item);
		} else {
			headers.set(key, value);
		}
	}

	const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

	if (method === "GET" || method === "HEAD") {
		return new Request(url, { method, headers });
	}

	const body = Readable.toWeb(req) as unknown as globalThis.ReadableStream;

	return new Request(url, {
		method,
		headers,
		body,
		duplex: "half",
	} as RequestInit);
}

async function sendResponse(response: Response, res: ServerResponse, method: string) {
	res.statusCode = response.status;

	if (response.statusText) {
		res.statusMessage = response.statusText;
	}

	const getSetCookie = (
		response.headers as Headers & {
			getSetCookie?: () => string[];
		}
	).getSetCookie;

	if (typeof getSetCookie === "function") {
		const setCookies = getSetCookie.call(response.headers);
		if (setCookies.length) res.setHeader("set-cookie", setCookies);
	}

	response.headers.forEach((value, key) => {
		if (key.toLowerCase() === "set-cookie") return;
		res.setHeader(key, value);
	});

	if (method === "HEAD" || NULL_BODY_STATUS.has(response.status) || !response.body) {
		res.end();
		return;
	}

	await new Promise<void>((resolve, reject) => {
		const body = Readable.fromWeb(
			response.body as unknown as import("node:stream/web").ReadableStream,
		);

		body.on("error", reject);
		res.on("close", resolve);
		res.on("finish", resolve);
		body.pipe(res);
	});
}

function listen(server: Server, port: number) {
	return new Promise<Server>((resolve, reject) => {
		const onError = (error: Error) => reject(error);

		server.once("error", onError);
		server.listen(port, "127.0.0.1", () => {
			server.off("error", onError);
			resolve(server);
		});
	});
}

// === Server Startup ===

export async function startViewerServer(db: MinniDB) {
	if (viewerServer && activePort) {
		return { server: viewerServer, port: activePort };
	}

	const distPath = join(import.meta.dir, "..", "..", "viewer", "dist");
	const indexHTML = join(distPath, "index.html");
	const app = await createApp(db, distPath);
	app.compile();

	const preferredPort = DEFAULT_CONFIG.preferredPort;
	const createNodeServer = () =>
		createServer(async (req, res) => {
			try {
				const request = createRequest(req, activePort ?? preferredPort);
				const pathname = new URL(request.url).pathname;
				let response = await app.handle(request);

				if (shouldServeSpaFallback(pathname, response)) {
					response = new Response(Bun.file(indexHTML));
				}

				await sendResponse(response, res, req.method ?? "GET");
			} catch (error) {
				console.error("[Minni Viewer] request error", error);

				if (!res.headersSent) {
					res.writeHead(500, {
						"content-type": "text/plain; charset=utf-8",
					});
				}

				res.end("Internal Server Error");
			}
		});

	try {
		viewerServer = await listen(createNodeServer(), preferredPort);
	} catch {
		viewerServer = await listen(createNodeServer(), 0);
	}

	activePort = (viewerServer.address() as AddressInfo | null)?.port ?? null;

	console.log(`[Minni Viewer] http://localhost:${activePort}`);

	return { server: viewerServer, port: activePort };
}

// Re-export for tools
export { getPages, getPageCount, addPage } from "./lib/canvas";
export type App = Awaited<ReturnType<typeof createApp>>;
