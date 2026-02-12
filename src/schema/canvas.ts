import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-orm/zod";

export const canvas = sqliteTable(
	"canvas",
	{
		id: text("id").primaryKey(),
		content: text("content").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" as const })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [index("idx_canvas_created_at").on(table.createdAt)],
);

export type CanvasPage = typeof canvas.$inferSelect;
export type NewCanvasPage = typeof canvas.$inferInsert;

export const canvasPageSelectSchema = createSelectSchema(canvas);
