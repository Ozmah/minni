import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { memories } from "./memories";

export const tags = sqliteTable("tags", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
});

export const memoryTags = sqliteTable(
	"memory_tags",
	{
		memoryId: integer("memory_id")
			.notNull()
			.references(() => memories.id, { onDelete: "cascade" }),
		tagId: integer("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.memoryId, table.tagId] })],
);

export const memoryPaths = sqliteTable("memory_paths", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	memoryId: integer("memory_id")
		.notNull()
		.references(() => memories.id, { onDelete: "cascade" }),
	position: integer("position").notNull(),
	segment: text("segment").notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type MemoryTag = typeof memoryTags.$inferSelect;
export type MemoryPath = typeof memoryPaths.$inferSelect;

export const tagSelectSchema = createSelectSchema(tags);
export const tagInsertSchema = createInsertSchema(tags, {
	name: (s) => s.min(1).max(50),
});
