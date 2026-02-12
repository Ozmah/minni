import { sqliteTable, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-orm/zod";

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
	(table) => [
		primaryKey({ columns: [table.memoryId, table.relatedId] }),
		index("idx_memory_relations_memory").on(table.memoryId),
		index("idx_memory_relations_related").on(table.relatedId),
	],
);

export type MemoryRelation = typeof memoryRelations.$inferSelect;

export const memoryRelationSelectSchema = createSelectSchema(memoryRelations);
