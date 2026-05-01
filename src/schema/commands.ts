import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { z } from "zod";

import {
	COMMAND_GROUP,
	COMMAND_RISK,
	COMMAND_VISIBILITY,
	PERMISSION,
	timestamp,
	type CommandGroup,
	type CommandRisk,
	type CommandVisibility,
	type Permission,
} from "./base";
import { projects } from "./projects";

export const commands = sqliteTable(
	"commands",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		command: text("command").notNull(),
		summary: text("summary"),
		group: text("group").$type<CommandGroup>().notNull().default("misc"),
		risk: text("risk").$type<CommandRisk>().notNull().default("safe"),
		visibility: text("visibility").$type<CommandVisibility>().notNull().default("secondary"),
		permission: text("permission").$type<Permission>().notNull().default("guarded"),
		notes: text("notes"),
		sortOrder: integer("sort_order").notNull().default(0),
		...timestamp,
	},
	(table) => [
		uniqueIndex("commands_project_key_unique").on(table.projectId, table.key),
		index("idx_commands_project").on(table.projectId),
		index("idx_commands_group").on(table.group),
		index("idx_commands_visibility").on(table.visibility),
	],
);

export type Command = typeof commands.$inferSelect;
export type NewCommand = typeof commands.$inferInsert;

export const commandSelectSchema = createSelectSchema(commands, {
	group: z.enum(COMMAND_GROUP),
	risk: z.enum(COMMAND_RISK),
	visibility: z.enum(COMMAND_VISIBILITY),
	permission: z.enum(PERMISSION),
});

export const commandInsertSchema = createInsertSchema(commands, {
	key: (s) => s.min(1).max(100),
	command: (s) => s.min(1),
	summary: (s) => s.max(500).optional(),
	group: z.enum(COMMAND_GROUP).default("misc"),
	risk: z.enum(COMMAND_RISK).default("safe"),
	visibility: z.enum(COMMAND_VISIBILITY).default("secondary"),
	permission: z.enum(PERMISSION).default("guarded"),
	notes: (s) => s.max(2000).optional(),
	sortOrder: z.number().int().default(0),
});

export const commandUpdateSchema = createUpdateSchema(commands, {
	key: (s) => s.min(1).max(100),
	command: (s) => s.min(1),
	summary: (s) => s.max(500).optional(),
	group: z.enum(COMMAND_GROUP),
	risk: z.enum(COMMAND_RISK),
	visibility: z.enum(COMMAND_VISIBILITY),
	permission: z.enum(PERMISSION),
	notes: (s) => s.max(2000).optional(),
	sortOrder: z.number().int(),
});
