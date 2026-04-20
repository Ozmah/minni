import { index, integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-orm/zod";

import { memories } from "./memories";
import { projects } from "./projects";

export const projectMemories = sqliteTable(
	"project_memories",
	{
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		memoryId: integer("memory_id")
			.notNull()
			.references(() => memories.id, { onDelete: "cascade" }),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.memoryId] }),
		index("idx_project_memories_project").on(table.projectId),
		index("idx_project_memories_memory").on(table.memoryId),
	],
);

export type ProjectMemory = typeof projectMemories.$inferSelect;

export const projectMemorySelectSchema = createSelectSchema(projectMemories);
