import { sql } from "drizzle-orm";
import { check, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";

import { timestamp } from "./base";
import { devModes } from "./dev-modes";
import { projects } from "./projects";

export const activeState = sqliteTable(
	"active_state",
	{
		id: integer("id").primaryKey().default(1),
		activeProjectId: integer("active_project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		activeDevModeId: integer("active_dev_mode_id").references(() => devModes.id, {
			onDelete: "set null",
		}),
		...timestamp,
	},
	(table) => [check("active_state_singleton_check", sql`${table.id} = 1`)],
);

export type ActiveState = typeof activeState.$inferSelect;
export type NewActiveState = typeof activeState.$inferInsert;

export const activeStateSelectSchema = createSelectSchema(activeState);
export const activeStateInsertSchema = createInsertSchema(activeState);
