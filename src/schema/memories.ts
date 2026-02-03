import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import {
	timestamp,
	MEMORY_TYPE,
	MEMORY_STATUS,
	PERMISSION,
	type MemoryType,
	type MemoryStatus,
	type Permission,
} from "./base";
import { projects } from "./projects";

export const memories = sqliteTable("memories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	projectId: integer("project_id").references(() => projects.id, {
		onDelete: "cascade",
	}),
	type: text("type").$type<MemoryType>().notNull(),
	title: text("title").notNull(),
	content: text("content").notNull(),
	path: text("path"),
	status: text("status").$type<MemoryStatus>().notNull().default("draft"),
	permission: text("permission").$type<Permission>().notNull().default("guarded"),
	...timestamp,
});

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export const memorySelectSchema = createSelectSchema(memories, {
	type: z.enum(MEMORY_TYPE),
	status: z.enum(MEMORY_STATUS),
	permission: z.enum(PERMISSION),
});

export const memoryInsertSchema = createInsertSchema(memories, {
	type: z.enum(MEMORY_TYPE),
	title: (s) => s.min(1).max(200),
	content: (s) => s.min(1),
	status: z.enum(MEMORY_STATUS).default("draft"),
	permission: z.enum(PERMISSION).default("guarded"),
});
