import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { timestamp } from "./base";
import { projects } from "./projects";

export const globalContext = sqliteTable("global_context", {
	id: integer("id").primaryKey().default(1),
	activeProjectId: integer("active_project_id").references(() => projects.id, {
		onDelete: "set null",
	}),
	identity: text("identity"),
	preferences: text("preferences"),
	contextSummary: text("context_summary"),
	contextUpdatedAt: integer("context_updated_at", { mode: "timestamp_ms" }),
	...timestamp,
});

export type GlobalContext = typeof globalContext.$inferSelect;
export type NewGlobalContext = typeof globalContext.$inferInsert;

export const globalContextSelectSchema = createSelectSchema(globalContext);
export const globalContextInsertSchema = createInsertSchema(globalContext);
