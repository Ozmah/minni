import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

/** Reusable timestamp columns for all tables. */
export const timestamp = {
	createdAt: integer("created_at", { mode: "timestamp_ms" as const })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" as const })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
};

export const PROJECT_STATUS = ["active", "paused", "completed", "archived"] as const;
export const PERMISSION = ["open", "guarded", "read_only", "locked"] as const;
export const MEMORY_TYPE = [
	"skill",
	"pattern",
	"anti_pattern",
	"decision",
	"insight",
	"comparison",
	"note",
	"link",
	"article",
	"video",
	"documentation",
] as const;
export const MEMORY_STATUS = ["draft", "experimental", "proven", "battle_tested", "deprecated"] as const;
export const TASK_PRIORITY = ["high", "medium", "low"] as const;
export const TASK_STATUS = ["todo", "in_progress", "done", "cancelled"] as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[number];
export type Permission = (typeof PERMISSION)[number];
export type MemoryType = (typeof MEMORY_TYPE)[number];
export type MemoryStatus = (typeof MEMORY_STATUS)[number];
export type TaskPriority = (typeof TASK_PRIORITY)[number];
export type TaskStatus = (typeof TASK_STATUS)[number];
