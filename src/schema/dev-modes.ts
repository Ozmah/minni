import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { z } from "zod";

import { PERMISSION, timestamp, type Permission } from "./base";

export const devModes = sqliteTable("dev_modes", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description"),
	permission: text("permission").$type<Permission>().notNull().default("guarded"),
	...timestamp,
});

export type DevMode = typeof devModes.$inferSelect;
export type NewDevMode = typeof devModes.$inferInsert;

export const devModeSelectSchema = createSelectSchema(devModes, {
	permission: z.enum(PERMISSION),
});

export const devModeInsertSchema = createInsertSchema(devModes, {
	name: (s) => s.min(1).max(100),
	description: (s) => s.max(500).optional(),
	permission: z.enum(PERMISSION).default("guarded"),
});

export const devModeUpdateSchema = createUpdateSchema(devModes, {
	name: (s) => s.min(1).max(100),
	description: (s) => s.max(500).optional(),
	permission: z.enum(PERMISSION),
});
