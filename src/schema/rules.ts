import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";

import {
	PERMISSION,
	RULE_KIND,
	RULE_SEVERITY,
	timestamp,
	type Permission,
	type RuleKind,
	type RuleSeverity,
} from "./base";
import { devModes } from "./dev-modes";
import { projects } from "./projects";

export const rules = sqliteTable(
	"rules",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		devModeId: integer("dev_mode_id").references(() => devModes.id, { onDelete: "cascade" }),
		projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
		kind: text("kind").$type<RuleKind>().notNull(),
		statement: text("statement").notNull(),
		rationale: text("rationale"),
		severity: text("severity").$type<RuleSeverity>().notNull().default("default"),
		permission: text("permission").$type<Permission>().notNull().default("guarded"),
		example: text("example"),
		sortOrder: integer("sort_order").notNull().default(0),
		...timestamp,
	},
	(table) => [
		check(
			"rules_kind_scope_check",
			sql`(
				(${table.kind} = 'principle' AND ${table.devModeId} IS NOT NULL AND ${table.projectId} IS NULL)
				OR
				(${table.kind} IN ('convention', 'gotcha') AND ${table.projectId} IS NOT NULL AND ${table.devModeId} IS NULL)
			)`,
		),
		index("idx_rules_dev_mode").on(table.devModeId),
		index("idx_rules_project").on(table.projectId),
		index("idx_rules_kind").on(table.kind),
		index("idx_rules_severity").on(table.severity),
	],
);

export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;

export const ruleSelectSchema = createSelectSchema(rules, {
	kind: z.enum(RULE_KIND),
	severity: z.enum(RULE_SEVERITY),
	permission: z.enum(PERMISSION),
});

export const ruleInsertSchema = createInsertSchema(rules, {
	kind: z.enum(RULE_KIND),
	statement: (s) => s.min(1),
	rationale: (s) => s.max(2000).optional(),
	severity: z.enum(RULE_SEVERITY).default("default"),
	permission: z.enum(PERMISSION).default("guarded"),
	example: (s) => s.max(2000).optional(),
	sortOrder: z.number().int().default(0),
});
