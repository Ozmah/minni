import { tool } from "@opencode-ai/plugin";
import { Result } from "better-result";

import type { CanvasPageType } from "../schema";
import { getViewerPort } from "../server";

// ============================================================================
// API HELPERS
// ============================================================================

interface CanvasPage {
	id: string;
	content: string;
	type: CanvasPageType;
	createdAt: string;
}

interface CanvasPagesResponse {
	pages: CanvasPage[];
}

interface CanvasClearResponse {
	deleted: number;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
	const fetchResult = await Result.tryPromise({
		try: () => fetch(url, init),
		catch: (e) => (e instanceof Error ? e.message : String(e)),
	});
	if (fetchResult.isErr()) return fetchResult;

	const response = fetchResult.value;
	if (!response.ok) return Result.err(response.statusText);

	return Result.tryPromise({
		try: () => response.json() as Promise<T>,
		catch: (e) => (e instanceof Error ? e.message : String(e)),
	});
}

/** Formats a single canvas page for LLM consumption: `Page 2/5 [html] (10:30:00 AM):\n\n<content>` */
function formatPage(page: CanvasPage, index: number, total: number): string {
	const time = new Date(page.createdAt).toLocaleTimeString();
	const typeTag = page.type === "html" ? " [html]" : "";
	return `Page ${index + 1}/${total}${typeTag} (${time}):\n\n${page.content}`;
}

function formatAllPages(pages: CanvasPage[]): string {
	const lines = pages.map((p, i) => {
		const typeTag = p.type === "html" ? " [html]" : "";
		return `## Page ${i + 1}${typeTag} (${new Date(p.createdAt).toLocaleTimeString()})\n\n${p.content}`;
	});
	return `${pages.length} pages:\n\n${lines.join("\n\n---\n\n")}`;
}

// ============================================================================
// BUN.BUILD PIPELINE
// ============================================================================

/**
 * Compiles HTML content through Bun.build to produce a self-contained HTML string.
 * Inlines all <script src>, <link rel="stylesheet">, and asset references.
 * Falls back to raw content if build fails (e.g. content is already self-contained).
 */
async function compileHtml(content: string): Promise<string> {
	const tempPath = `/tmp/minni-canvas-${crypto.randomUUID()}.html`;

	const writeResult = await Result.tryPromise({
		try: async () => {
			await Bun.write(tempPath, content);
		},
		catch: (e) => (e instanceof Error ? e.message : String(e)),
	});
	if (writeResult.isErr()) return content;

	const buildResult = await Result.tryPromise({
		try: () =>
			Bun.build({
				entrypoints: [tempPath],
				target: "browser",
				compile: true,
			}),
		catch: (e) => (e instanceof Error ? e.message : String(e)),
	});

	// Always clean up temp file
	await Result.tryPromise({
		try: () => Bun.file(tempPath).exists().then(() => require("fs").unlinkSync(tempPath)),
		catch: () => "cleanup failed",
	});

	if (buildResult.isErr()) return content;

	const build = buildResult.value;
	if (!build.success || build.outputs.length === 0) return content;

	const textResult = await Result.tryPromise({
		try: () => build.outputs[0].text(),
		catch: (e) => (e instanceof Error ? e.message : String(e)),
	});

	return textResult.isOk() ? textResult.value : content;
}

// ============================================================================
// ACTIONS
// ============================================================================

async function readCanvas(
	viewerUrl: string,
	action: "index" | "read" | "read_all",
	index?: number,
): Promise<string> {
	const isTruncated = action == "index" ? "?truncated=true" : "";
	const result = await fetchJson<CanvasPagesResponse>(
		`${viewerUrl}/api/canvas/pages${isTruncated}`,
	);
	if (result.isErr()) return `Failed to read canvas: ${result.error}`;

	const { pages } = result.value;
	if (pages.length === 0) return "Canvas is empty.";

	if (action === "index" || action === "read_all") return formatAllPages(pages);

	const idx = index ?? pages.length - 1;
	if (idx < 0 || idx >= pages.length) {
		return `Invalid index ${idx}. Canvas has ${pages.length} pages (0-${pages.length - 1}).`;
	}

	return formatPage(pages[idx], idx, pages.length);
}

async function clearCanvas(viewerUrl: string): Promise<string> {
	const result = await fetchJson<CanvasClearResponse>(`${viewerUrl}/api/canvas/clear`, {
		method: "POST",
	});
	if (result.isErr()) return `Failed to clear canvas: ${result.error}`;
	return `Canvas cleared. ${result.value.deleted} pages deleted.`;
}

async function pushToCanvas(viewerUrl: string, content: string, type: CanvasPageType = "markdown") {
	const result = await fetchJson<{ ok: boolean }>(`${viewerUrl}/api/canvas/push`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content, type }),
	});
	if (result.isErr()) return result;
	return Result.ok(undefined);
}

function openBrowser(url: string): boolean {
	const { platform } = process;
	const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
	if (!Bun.which(cmd)) return false;
	Bun.spawn([cmd, url]);
	return true;
}

// ============================================================================
// TOOL
// ============================================================================

/**
 * Creates canvas tool: minni_canvas
 */
export function canvasTools() {
	return {
		minni_canvas: tool({
			description:
				"Send markdown to Minni Viewer or read/clear canvas pages. Output: viewer URL or page content",
			args: {
				content: tool.schema.string().optional().describe("Required for show/open/save actions"),
				action: tool.schema
					.enum(["show", "open", "save", "index", "read", "read_all", "clear"])
					.optional()
					.describe(
						"show=default, open=launch browser, index=list brief, read=get page, read_all=get all, clear=delete all",
					),
				index: tool.schema
					.number()
					.optional()
					.describe("For read: page index (0-based, default: latest)"),
				type: tool.schema
					.enum(["markdown", "html"])
					.optional()
					.describe(
						"Page type: markdown (default) renders as rich text, html renders as a live website in a sandboxed iframe. HTML content is compiled through Bun.build for self-contained output.",
					),
			},
			async execute(args) {
				const action = args.action ?? "show";
				const type = args.type ?? "markdown";
				const viewerPort = getViewerPort();

				if (!viewerPort) {
					return "Minni Viewer is not running. Restart OpenCode to start the viewer.";
				}

				const viewerUrl = `http://localhost:${viewerPort}`;

				if (action === "index" || action === "read" || action === "read_all") {
					return readCanvas(viewerUrl, action, args.index);
				}

				if (action === "clear") {
					return clearCanvas(viewerUrl);
				}

				if (!args.content) {
					return `Content is required for action: ${action}`;
				}

				let content = args.content;
				if (type === "html") {
					content = await compileHtml(content);
				}

				const pushResult = await pushToCanvas(viewerUrl, content, type);
				if (pushResult.isErr()) {
					return `Failed to send to canvas: ${pushResult.error}. Is the viewer running?`;
				}

				const browserNote =
					action === "open" && !openBrowser(viewerUrl)
						? " (could not open browser)"
						: "";

				if (action === "save") {
					return `Content sent to canvas (${content.length} chars, type: ${type})${browserNote}. Save to memory: coming soon. View at ${viewerUrl}`;
				}

				return `Content sent to canvas (${content.length} chars, type: ${type})${browserNote}. View at ${viewerUrl}`;
			},
		}),
	};
}
