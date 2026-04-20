import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
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

export const memories = sqliteTable(
	"memories",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		type: text("type").$type<MemoryType>().notNull(),
		title: text("title").notNull(),
		content: text("content").notNull(),
		status: text("status").$type<MemoryStatus>().notNull().default("draft"),
		permission: text("permission").$type<Permission>().notNull().default("guarded"),
		...timestamp,
	},
	(table) => [
		index("idx_memories_type").on(table.type),
		index("idx_memories_status").on(table.status),
	],
);

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
