/**
 * Canvas state management and API handlers.
 */

import { type Result, ok, err } from "../result";
import { broadcast, createSSEStream } from "./sse";
import { type CanvasPage, DEFAULT_CONFIG, UUID_REGEX } from "./types";

// === Runtime Detection ===

const HAS_BUN_MARKDOWN = typeof Bun.markdown?.html === "function";

function renderMarkdown(md: string): string {
	return HAS_BUN_MARKDOWN ? Bun.markdown.html(md) : "";
}

export function getRuntimeInfo() {
	return {
		bunVersion: Bun.version,
		hasBunMarkdown: HAS_BUN_MARKDOWN,
	};
}

// === Canvas State ===

const pages: CanvasPage[] = [];

export function getPages(): CanvasPage[] {
	return pages;
}

export function addPage(markdown: string): CanvasPage {
	const html = renderMarkdown(markdown);
	const page: CanvasPage = {
		id: crypto.randomUUID(),
		markdown,
		html,
		timestamp: Date.now(),
	};

	pages.push(page);
	if (pages.length > DEFAULT_CONFIG.maxCanvasPages) {
		pages.shift();
	}

	broadcast({
		page,
		currentIndex: pages.length - 1,
		total: pages.length,
	});

	return page;
}

export function deletePage(id: string): boolean {
	const idx = pages.findIndex((p) => p.id === id);
	if (idx === -1) return false;
	pages.splice(idx, 1);
	return true;
}

export function clearPages(): number {
	const count = pages.length;
	pages.length = 0;

	broadcast({
		cleared: true,
		pages: [],
		currentIndex: -1,
		total: 0,
	});

	return count;
}

// === Input Validation ===

interface PushInput {
	content: unknown;
}

function validatePushInput(body: unknown): Result<string> {
	if (!body || typeof body !== "object") {
		return err("Invalid request body");
	}

	const { content } = body as PushInput;

	if (typeof content !== "string") {
		return err("content must be a string");
	}

	if (content.length === 0) {
		return err("content cannot be empty");
	}

	if (content.length > DEFAULT_CONFIG.maxContentLength) {
		return err("content too large");
	}

	return ok(content);
}

function validateUUID(id: string | undefined): Result<string> {
	if (!id || !UUID_REGEX.test(id)) {
		return err("Invalid ID");
	}
	return ok(id);
}

// === Route Handlers ===

export function handleStream(): Response {
	const result = createSSEStream({
		pages,
		currentIndex: pages.length - 1,
	});

	if ("error" in result) {
		return Response.json({ error: result.error }, { status: result.status });
	}

	return result;
}

export function handleGetPages(): Response {
	return Response.json({ pages });
}

export async function handlePush(req: Request): Promise<Response> {
	const parseResult = await req
		.json()
		.then(ok)
		.catch((e: Error) => err(e.message));

	if (!parseResult.ok) {
		return Response.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const validation = validatePushInput(parseResult.value);
	if (!validation.ok) {
		return Response.json({ error: validation.error }, { status: 400 });
	}

	addPage(validation.value);
	return Response.json({ ok: true });
}

export function handleDelete(path: string): Response {
	const id = path.split("/").pop();
	const validation = validateUUID(id);

	if (!validation.ok) {
		return Response.json({ error: validation.error }, { status: 400 });
	}

	const deleted = deletePage(validation.value);
	return Response.json({ ok: deleted, remaining: pages.length });
}

export function handleClear(): Response {
	const deleted = clearPages();
	return Response.json({ ok: true, deleted });
}
