import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { z } from "zod";

import { timestamp, PERMISSION, type Permission } from "./base";

export const projects = sqliteTable("projects", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description"),
	stack: text("stack"),
	permission: text("permission").$type<Permission>().notNull().default("guarded"),
	...timestamp,
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export const projectSelectSchema = createSelectSchema(projects, {
	permission: z.enum(PERMISSION),
});

export const projectInsertSchema = createInsertSchema(projects, {
	name: (s) => s.min(1).max(100),
	description: (s) => s.max(5000).optional(),
	permission: z.enum(PERMISSION).default("guarded"),
});

export const projectUpdateSchema = createUpdateSchema(projects, {
	name: (s) => s.min(1).max(100),
	description: (s) => s.max(5000).optional(),
	permission: z.enum(PERMISSION),
});
