import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
// TODO [T70]: drizzle-zod → drizzle-orm/zod when 1.0 stable
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { timestamp } from "./base";
import { memories } from "./memories";
import { projects } from "./projects";

export const globalContext = sqliteTable("global_context", {
	id: integer("id").primaryKey().default(1),
	activeProjectId: integer("active_project_id").references(() => projects.id, {
		onDelete: "set null",
	}),
	activeIdentityId: integer("active_identity_id").references(() => memories.id, {
		onDelete: "set null",
	}),
	...timestamp,
});

export type GlobalContext = typeof globalContext.$inferSelect;
export type NewGlobalContext = typeof globalContext.$inferInsert;

export const globalContextSelectSchema = createSelectSchema(globalContext);
export const globalContextInsertSchema = createInsertSchema(globalContext);
