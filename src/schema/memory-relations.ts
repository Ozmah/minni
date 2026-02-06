import { sqliteTable, integer, primaryKey } from "drizzle-orm/sqlite-core";
// TODO [T70]: drizzle-zod → drizzle-orm/zod when 1.0 stable
import { createSelectSchema } from "drizzle-zod";

import { memories } from "./memories";

export const memoryRelations = sqliteTable(
	"memory_relations",
	{
		memoryId: integer("memory_id")
			.notNull()
			.references(() => memories.id, { onDelete: "cascade" }),
		relatedId: integer("related_id")
			.notNull()
			.references(() => memories.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.memoryId, table.relatedId] })],
);

export type MemoryRelation = typeof memoryRelations.$inferSelect;

export const memoryRelationSelectSchema = createSelectSchema(memoryRelations);
