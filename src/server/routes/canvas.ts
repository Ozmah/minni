import { Elysia } from "elysia";
import { z } from "zod";

import type { MinniDB } from "../../helpers";

import { canvasPageSelectSchema } from "../../schema";
import { markChanged } from "../changes";
import {
	getPages,
	getPagesTruncated,
	addPage,
	deletePage,
	clearPages,
	validateContent,
	validateUUID,
} from "../lib/canvas";
import { ErrorResponse } from "../types";

export const canvasRoutes = (db: MinniDB) =>
	new Elysia({ prefix: "/api/canvas" })
		.get(
			"/pages",
			async ({ query }) => {
				if (query.truncated) {
					return { pages: await getPagesTruncated(db, query.limit) };
				}
				return { pages: await getPages(db, query.limit) };
			},
			{
				query: z.object({
					limit: z.coerce.number().int().min(1).max(100).optional(),
					truncated: z.coerce.boolean().optional(),
				}),
				response: {
					200: z.object({ pages: z.array(canvasPageSelectSchema) }),
				},
			},
		)
		.post(
			"/push",
			async ({ body, status }) => {
				const err = validateContent(body.content);
				if (err) return status(400, { error: err });

				const page = await addPage(db, body.content, body.type ?? "markdown");
				markChanged("canvas");
				return { ok: true, id: page.id };
			},
			{
				body: z.object({
					content: z.string().min(1),
					type: z.enum(["markdown", "html"]).optional(),
				}),
				response: {
					400: ErrorResponse,
				},
			},
		)
		.delete(
			"/:id",
			async ({ params, status }) => {
				const err = validateUUID(params.id);
				if (err) return status(400, { error: err });

				const deleted = await deletePage(db, params.id);
				if (deleted) markChanged("canvas");
				return { ok: deleted };
			},
			{
				params: z.object({ id: z.string() }),
				response: {
					400: ErrorResponse,
				},
			},
		)
		.post("/clear", async () => {
			const deleted = await clearPages(db);
			markChanged("canvas");
			return { ok: true, deleted };
		});
