import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { timestamp, PROJECT_STATUS, PERMISSION } from "./base";

export const projects = sqliteTable("projects", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description"),
	stack: text("stack"),
	status: text("status").notNull().default("active"),
	permission: text("permission").notNull().default("guarded"),
	defaultMemoryPermission: text("default_memory_permission").notNull().default("guarded"),
	contextSummary: text("context_summary"),
	contextUpdatedAt: integer("context_updated_at", { mode: "timestamp_ms" }),
	...timestamp,
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export const projectSelectSchema = createSelectSchema(projects, {
	status: z.enum(PROJECT_STATUS),
	permission: z.enum(PERMISSION),
	defaultMemoryPermission: z.enum(PERMISSION),
});

export const projectInsertSchema = createInsertSchema(projects, {
	name: (s) => s.min(1).max(100),
	description: (s) => s.max(500).optional(),
	status: z.enum(PROJECT_STATUS).default("active"),
	permission: z.enum(PERMISSION).default("guarded"),
	defaultMemoryPermission: z.enum(PERMISSION).default("guarded"),
});
