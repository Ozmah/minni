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
export const MEMORY_STATUS = [
	"draft",
	"experimental",
	"proven",
	"battle_tested",
	"deprecated",
] as const;
export const COMMAND_GROUP = [
	"run",
	"quality",
	"build",
	"test",
	"db",
	"infra",
	"worker",
	"setup",
	"misc",
] as const;
export const COMMAND_RISK = ["safe", "mutating", "destructive"] as const;
export const COMMAND_VISIBILITY = ["primary", "secondary", "hidden"] as const;
export const RULE_KIND = ["principle", "convention", "gotcha"] as const;
export const RULE_SEVERITY = ["critical", "strong", "default"] as const;
export const CANVAS_PAGE_TYPE = ["markdown", "html"] as const;

export type Permission = (typeof PERMISSION)[number];
export type MemoryType = (typeof MEMORY_TYPE)[number];
export type MemoryStatus = (typeof MEMORY_STATUS)[number];
export type CommandGroup = (typeof COMMAND_GROUP)[number];
export type CommandRisk = (typeof COMMAND_RISK)[number];
export type CommandVisibility = (typeof COMMAND_VISIBILITY)[number];
export type RuleKind = (typeof RULE_KIND)[number];
export type RuleSeverity = (typeof RULE_SEVERITY)[number];
export type CanvasPageType = (typeof CANVAS_PAGE_TYPE)[number];
