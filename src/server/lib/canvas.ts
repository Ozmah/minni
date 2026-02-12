/**
 * Canvas DB operations and validation.
 *
 * Currently the only data layer since this is the only entity
 * consumed outside the routes for the time being
 */

import { desc, eq, count } from "drizzle-orm";

import type { MinniDB } from "../../helpers";

import { truncateWithWordBoundary } from "../../helpers";
import { canvas, type CanvasPage } from "../../schema";
import { DEFAULT_CONFIG, UUID_REGEX } from "../types";

export function getRuntimeInfo() {
	return {
		bunVersion: Bun.version,
	};
}

// ============================================================================
// CANVAS QUERIES
// ============================================================================

/** Returns the last `limit` canvas pages, newest first. */
export async function getPages(db: MinniDB, limit = 100): Promise<CanvasPage[]> {
	return db.select().from(canvas).orderBy(desc(canvas.createdAt)).limit(limit);
}

/** Returns the last `limit` canvas pages truncated, newest first. */
export async function getPagesTruncated(db: MinniDB, limit = 100): Promise<CanvasPage[]> {
	const fullCanvasPages = await db
		.select()
		.from(canvas)
		.orderBy(desc(canvas.createdAt))
		.limit(limit);

	let canvasPages: {
		id: string;
		content: string;
		createdAt: Date;
	}[] = [];

	for (const page of fullCanvasPages) {
		canvasPages.push({
			id: page.id,
			content: truncateWithWordBoundary(page.content, 25),
			createdAt: page.createdAt,
		});
	}

	return canvasPages;
}

/** Returns total canvas page count. */
export async function getPageCount(db: MinniDB): Promise<number> {
	const result = await db.select({ total: count() }).from(canvas);
	return result[0].total;
}

/** Inserts a canvas page and returns it. */
export async function addPage(db: MinniDB, content: string): Promise<CanvasPage> {
	const id = crypto.randomUUID();
	const createdAt = new Date();
	await db.insert(canvas).values({ id, content, createdAt });

	return { id, content, createdAt };
}

/** Deletes a canvas page by UUID. Returns true if deleted. */
export async function deletePage(db: MinniDB, id: string): Promise<boolean> {
	const result = await db.delete(canvas).where(eq(canvas.id, id));
	return result.changes > 0;
}

/** Deletes all canvas pages. Returns count deleted. */
export async function clearPages(db: MinniDB): Promise<number> {
	const total = await getPageCount(db);
	await db.delete(canvas);
	return total;
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

export function validateContent(content: unknown): string | null {
	if (typeof content !== "string") return "content must be a string";
	if (content.length === 0) return "content cannot be empty";
	if (content.length > DEFAULT_CONFIG.maxContentLength) return "content too large";
	return null;
}

export function validateUUID(id: string | undefined): string | null {
	if (!id || !UUID_REGEX.test(id)) return "Invalid ID";
	return null;
}
