/**
 * Static file serving for the viewer frontend.
 */

import { join } from "node:path";

import { MIME_TYPES } from "./types";

// === Static File Handler ===

export async function handleStatic(path: string, distPath: string): Promise<Response> {
	const filePath = path === "/" ? "/index.html" : path;
	const ext = filePath.substring(filePath.lastIndexOf(".")) || ".html";
	const fullPath = join(distPath, filePath);

	const file = Bun.file(fullPath);
	const exists = await file.exists();

	if (exists) {
		return new Response(file, {
			headers: { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" },
		});
	}

	// SPA fallback
	return new Response(Bun.file(join(distPath, "index.html")), {
		headers: { "Content-Type": "text/html" },
	});
}

// === CORS Handler ===

export function handleCORS(): Response {
	return new Response(null, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
