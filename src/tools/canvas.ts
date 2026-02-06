import { tool } from "@opencode-ai/plugin";
import { Result } from "better-result";

import { getViewerPort } from "../server";

// ============================================================================
// API HELPERS
// ============================================================================

interface CanvasPage {
	id: string;
	markdown: string;
	timestamp: number;
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

function formatPage(page: CanvasPage, index: number, total: number): string {
	const time = new Date(page.timestamp).toLocaleTimeString();
	return `Page ${index + 1}/${total} (${time}):\n\n${page.markdown}`;
}

function formatAllPages(pages: CanvasPage[]): string {
	const lines = pages.map(
		(p, i) => `## Page ${i + 1} (${new Date(p.timestamp).toLocaleTimeString()})\n\n${p.markdown}`,
	);
	return `${pages.length} pages:\n\n${lines.join("\n\n---\n\n")}`;
}

// ============================================================================
// ACTIONS
// ============================================================================

async function readCanvas(
	viewerUrl: string,
	action: "read" | "read_all",
	index?: number,
): Promise<string> {
	const result = await fetchJson<CanvasPagesResponse>(`${viewerUrl}/api/canvas/pages`);
	if (result.isErr()) return `Failed to read canvas: ${result.error}`;

	const { pages } = result.value;
	if (pages.length === 0) return "Canvas is empty.";

	if (action === "read_all") return formatAllPages(pages);

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

async function pushToCanvas(viewerUrl: string, content: string) {
	const result = await fetchJson<{ ok: boolean }>(`${viewerUrl}/api/canvas/push`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content }),
	});
	if (result.isErr()) return result;
	return Result.ok(undefined);
}

function openBrowser(url: string): void {
	const { platform } = process;
	const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
	Bun.spawn([cmd, url]);
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
					.enum(["show", "open", "save", "read", "read_all", "clear"])
					.optional()
					.describe(
						"show=default, open=launch browser, read=get page, read_all=get all, clear=delete all",
					),
				index: tool.schema
					.number()
					.optional()
					.describe("For read: page index (0-based, default: latest)"),
			},
			async execute(args) {
				const action = args.action ?? "show";
				const viewerPort = getViewerPort();

				if (!viewerPort) {
					return "Minni Viewer is not running. Restart OpenCode to start the viewer.";
				}

				const viewerUrl = `http://localhost:${viewerPort}`;

				if (action === "read" || action === "read_all") {
					return readCanvas(viewerUrl, action, args.index);
				}

				if (action === "clear") {
					return clearCanvas(viewerUrl);
				}

				if (!args.content) {
					return `Content is required for action: ${action}`;
				}

				const pushResult = await pushToCanvas(viewerUrl, args.content);
				if (pushResult.isErr()) {
					return `Failed to send to canvas: ${pushResult.error}. Is the viewer running?`;
				}

				if (action === "open") {
					openBrowser(viewerUrl);
				}

				if (action === "save") {
					return `Content sent to canvas (${args.content.length} chars). Save to memory: coming soon. View at ${viewerUrl}`;
				}

				return `Content sent to canvas (${args.content.length} chars). View at ${viewerUrl}`;
			},
		}),
	};
}
