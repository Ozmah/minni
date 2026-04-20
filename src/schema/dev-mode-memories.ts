import { index, integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-orm/zod";

import { devModes } from "./dev-modes";
import { memories } from "./memories";

export const devModeMemories = sqliteTable(
	"dev_mode_memories",
	{
		devModeId: integer("dev_mode_id")
			.notNull()
			.references(() => devModes.id, { onDelete: "cascade" }),
		memoryId: integer("memory_id")
			.notNull()
			.references(() => memories.id, { onDelete: "cascade" }),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.devModeId, table.memoryId] }),
		index("idx_dev_mode_memories_dev_mode").on(table.devModeId),
		index("idx_dev_mode_memories_memory").on(table.memoryId),
	],
);

export type DevModeMemory = typeof devModeMemories.$inferSelect;

export const devModeMemorySelectSchema = createSelectSchema(devModeMemories);
