import type { AnyColumn } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { timestamp, TASK_PRIORITY, TASK_STATUS } from "./base";
import { projects } from "./projects";

export const tasks = sqliteTable("tasks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	projectId: integer("project_id").references(() => projects.id, {
		onDelete: "cascade",
	}),
	parentId: integer("parent_id").references((): AnyColumn => tasks.id, {
		onDelete: "cascade",
	}),
	title: text("title").notNull(),
	description: text("description"),
	priority: text("priority").notNull().default("medium"),
	status: text("status").notNull().default("todo"),
	...timestamp,
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export const taskSelectSchema = createSelectSchema(tasks, {
	priority: z.enum(TASK_PRIORITY),
	status: z.enum(TASK_STATUS),
});

export const taskInsertSchema = createInsertSchema(tasks, {
	title: (s) => s.min(1).max(200),
	description: (s) => s.max(2000).optional(),
	priority: z.enum(TASK_PRIORITY).default("medium"),
	status: z.enum(TASK_STATUS).default("todo"),
});
