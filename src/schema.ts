import {
	sqliteTable,
	text,
	integer,
	primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const timestamp = {
	createdAt: integer("created_at", { mode: "timestamp_ms" as const })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" as const })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
};

/**
 * Root container for organizing memories, goals, milestones, and tasks.
 *
 * A project represents a codebase, initiative, or any logical grouping.
 * Not limited to software — a project can track anything: a campaign, a recipe book,
 * a research expedition, a home renovation. Memories can exist without a project
 * (global), but goals always require one.
 *
 * Names are normalized on write: lowercase, alphanumeric + hyphens only.
 * "Nakatomi Plaza" becomes "nakatomi-plaza". "NERV HQ" becomes "nerv-hq".
 *
 * Projects have TWO permission fields:
 * - `permission`: protects the project itself (settings, status, contextSummary)
 * - `defaultMemoryPermission`: inherited by memories created under this project
 *
 * @example
 * // Software project
 * { name: "death-star-api", description: "Imperial weapons platform backend", stack: '["TypeScript", "ElysiaJS", "Turso"]' }
 *
 * // Non-software project — stack is whatever tools you use
 * { name: "vault-101", description: "Fallout 3 survival playthrough notes", stack: '["Pip-Boy", "VATS", "Power Armor"]' }
 *
 * // Creative project
 * { name: "bebop-bounties", description: "Tracking bounty targets and payouts", stack: '["Swordfish II", "Jericom"]' }
 *
 * @field id - Auto-incrementing primary key.
 * @field name - Unique normalized identifier used in commands (e.g. "nakatomi-plaza", "vault-101"). Lowercase, alphanumeric + hyphens only.
 * @field description - Brief explanation of what the project is about.
 * @field stack - JSON-serialized string array of tools, technologies, or equipment. Not limited to programming — can be anything relevant to the project (e.g. '["ODM Gear", "Thunder Spears"]' for a Survey Corps mission tracker).
 * @field status - Lifecycle state: "active" | "paused" | "completed" | "archived".
 * @field permission - Protection of the project itself: "open" | "guarded" | "read_only" | "locked". Controls who can modify project settings.
 * @field defaultMemoryPermission - Permission inherited by new memories created under this project: "open" | "guarded" | "read_only" | "locked".
 * @field contextSummary - Last session narrative. Overwritten each time, never accumulated. This is the bridge between sessions: it tells agents where work left off.
 * @field contextUpdatedAt - Timestamp of the last context_summary write. Used to show recency in minni_load briefings.
 * @field createdAt - Row creation timestamp in milliseconds since epoch.
 * @field updatedAt - Last modification timestamp in milliseconds since epoch.
 */
export const projects = sqliteTable("projects", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description"),
	stack: text("stack"),
	status: text("status").notNull().default("active"),
	permission: text("permission").notNull().default("guarded"),
	defaultMemoryPermission: text("default_memory_permission").notNull().default("guarded"),
	contextSummary: text("context_summary"),
	contextUpdatedAt: integer("context_updated_at", { mode: "timestamp_ms" }),
	...timestamp,
});

/**
 * Singleton table for global user context. Always has exactly one row (id=1).
 *
 * Global context is the base layer that loads when no project is active.
 * It stores user identity, preferences, and cross-project knowledge that
 * agents should always have access to.
 *
 * When minni_load is called without a project, global context is loaded.
 * Memories with projectId=null belong to this global scope.
 *
 * @example
 * {
 *   identity: "Senior dev, prefers functional patterns, uses Arch + Hyprland. Always use TypeScript strict mode.",
 *   preferences: '{"editor": "zed", "formatter": "oxfmt", "tabs": true}',
 *   contextSummary: "Last session: explored TanStack Start server functions..."
 * }
 *
 * @field id - Always 1. Singleton row.
 * @field identity - Free-form text describing who the user is, work style, and core preferences. The "I know who you are" payload.
 * @field preferences - JSON object for structured preferences that tools might read programmatically.
 * @field activeProjectId - FK to projects.id. The currently loaded project. Null means global mode (no project active).
 * @field contextSummary - Last session narrative when in global mode. Same semantics as project contextSummary.
 * @field contextUpdatedAt - Timestamp of the last context_summary write.
 * @field createdAt - Row creation timestamp in milliseconds since epoch.
 * @field updatedAt - Last modification timestamp in milliseconds since epoch.
 */
export const globalContext = sqliteTable("global_context", {
	id: integer("id").primaryKey().default(1),
	activeProjectId: integer("active_project_id").references(() => projects.id, {
		onDelete: "set null",
	}),
	identity: text("identity"),
	preferences: text("preferences"),
	contextSummary: text("context_summary"),
	contextUpdatedAt: integer("context_updated_at", { mode: "timestamp_ms" }),
	...timestamp,
});

/**
 * Core storage for all knowledge, references, decisions, and notes.
 *
 * A memory is any reusable piece of information stored in Minni. Every record
 * is differentiated by its type and optionally classified via a path.
 * Permission enforcement is programmatic: locked memories are invisible to the LLM,
 * read_only memories reject writes, and guarded memories require user confirmation.
 *
 * @example
 * // skill — procedural knowledge, how to do something
 * { type: "skill", title: "Wall Maria breach containment protocol", path: "Combat -> Titan -> Colossal", status: "battle_tested" }
 *
 * // anti_pattern — what NOT to do and why
 * { type: "anti_pattern", title: "Never attempt human transmutation", path: "Alchemy -> Transmutation -> Forbidden", status: "proven" }
 *
 * // decision — why X over Y (Architectural Decision Record)
 * { type: "decision", title: "Chose Swordfish II over Red Tail for solo bounties", path: "Equipment -> Ship -> Selection" }
 *
 * // insight — discovery, aha moment
 * { type: "insight", title: "Xenomorphs have acid for blood", path: "Biology -> Xenomorph -> Defense", status: "battle_tested" }
 *
 * // link — external reference with personal context
 * { type: "link", title: "Pochta's contract details", path: "Contracts -> Devil -> Chainsaw", content: "https://..." }
 *
 * @field id - Auto-incrementing primary key.
 * @field projectId - FK to projects.id. Null means the memory is global (not project-scoped).
 * @field type - Classification of the memory. One of: "skill" | "pattern" | "anti_pattern" | "decision" | "insight" | "comparison" | "note" | "link" | "article" | "video" | "documentation".
 * @field title - Human-readable name. Used as the primary display in search results.
 * @field content - The actual knowledge payload. Free-form text, may include code snippets or markdown.
 * @field path - Display-format classification pipe (e.g. "Alchemy -> Transmutation -> Forbidden"). Null if unclassified. Segments are indexed separately in memory_paths for efficient querying.
 * @field status - Maturity level: "draft" | "experimental" | "proven" | "battle_tested" | "deprecated". Knowledge matures as it's validated in real scenarios.
 * @field permission - Access control level: "open" | "guarded" | "read_only" | "locked". Cannot be changed via tools after creation — only via Minni Studio (direct DB access). Locked memories are completely invisible to the LLM.
 * @field createdAt - Row creation timestamp in milliseconds since epoch.
 * @field updatedAt - Last modification timestamp in milliseconds since epoch.
 */
export const memories = sqliteTable("memories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	projectId: integer("project_id").references(() => projects.id, {
		onDelete: "cascade",
	}),
	type: text("type").notNull(),
	title: text("title").notNull(),
	content: text("content").notNull(),
	path: text("path"),
	status: text("status").notNull().default("draft"),
	permission: text("permission").notNull().default("guarded"),
	...timestamp,
});

/**
 * Long-term objectives that belong to a project.
 *
 * Goals sit at the top of the planning hierarchy: Project > Goal > Milestone > Task.
 * A goal always belongs to a project and can have multiple milestones beneath it.
 *
 * @example
 * // project: "vault-101"
 * { title: "Escape the Vault", description: "Find dad and get out of Vault 101 alive" }
 *
 * // project: "nakatomi-plaza"
 * { title: "Neutralize Hans Gruber", description: "Save hostages from the 30th floor" }
 *
 * @field id - Auto-incrementing primary key.
 * @field projectId - FK to projects.id. Required — goals cannot be standalone.
 * @field title - Short description of the objective.
 * @field description - Detailed explanation or acceptance criteria.
 * @field status - Lifecycle state: "active" | "completed" | "paused" | "cancelled".
 * @field createdAt - Row creation timestamp in milliseconds since epoch.
 * @field updatedAt - Last modification timestamp in milliseconds since epoch.
 */
export const goals = sqliteTable("goals", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	projectId: integer("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"),
	status: text("status").notNull().default("active"),
	...timestamp,
});

/**
 * Intermediate checkpoints within a goal.
 *
 * Milestones break a goal into measurable progress markers.
 * They always belong to a goal and can have tasks beneath them.
 *
 * @example
 * // goal: "Escape the Vault"
 * { title: "Obtain the Pip-Boy", status: "completed" }
 * { title: "Reach the Vault door", status: "active" }
 * { title: "Survive the Wasteland entrance", status: "active" }
 *
 * @field id - Auto-incrementing primary key.
 * @field goalId - FK to goals.id. Required — milestones cannot be standalone.
 * @field title - Short description of the checkpoint.
 * @field description - Detailed explanation or deliverables.
 * @field status - Lifecycle state: "active" | "completed" | "paused" | "cancelled".
 * @field createdAt - Row creation timestamp in milliseconds since epoch.
 * @field updatedAt - Last modification timestamp in milliseconds since epoch.
 */
export const milestones = sqliteTable("milestones", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	goalId: integer("goal_id")
		.notNull()
		.references(() => goals.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"),
	status: text("status").notNull().default("active"),
	...timestamp,
});

/**
 * Specific actionable items. The most flexible entity in the planning system.
 *
 * A task can belong to any level of the hierarchy or none at all:
 * - Attached to a milestone (most specific)
 * - Attached to a goal directly (skipping milestones)
 * - Attached to a project directly (general project work)
 * - Standalone (floating task, no parent)
 *
 * @example
 * // milestone-scoped: "Reach the Vault door"
 * { title: "Get the password from the Overseer's terminal", priority: "high", status: "in_progress" }
 *
 * // project-scoped, no milestone: "nerv-hq"
 * { title: "Calibrate Unit-01 sync ratio", priority: "medium", status: "todo" }
 *
 * // standalone, floating
 * { title: "Remember to feed Ein", priority: "low", status: "todo" }
 *
 * @field id - Auto-incrementing primary key.
 * @field projectId - FK to projects.id. Null for standalone tasks.
 * @field goalId - FK to goals.id. Null if not goal-scoped.
 * @field milestoneId - FK to milestones.id. Null if not milestone-scoped.
 * @field title - Short description of the action.
 * @field description - Detailed explanation, steps, or acceptance criteria.
 * @field priority - Urgency level: "high" | "medium" | "low". Defaults to "medium".
 * @field status - Progress state: "todo" | "in_progress" | "done" | "cancelled".
 * @field createdAt - Row creation timestamp in milliseconds since epoch.
 * @field updatedAt - Last modification timestamp in milliseconds since epoch.
 */
export const tasks = sqliteTable("tasks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	projectId: integer("project_id").references(() => projects.id, {
		onDelete: "cascade",
	}),
	goalId: integer("goal_id").references(() => goals.id, {
		onDelete: "cascade",
	}),
	milestoneId: integer("milestone_id").references(() => milestones.id, {
		onDelete: "cascade",
	}),
	title: text("title").notNull(),
	description: text("description"),
	priority: text("priority").notNull().default("medium"),
	status: text("status").notNull().default("todo"),
	...timestamp,
});

/**
 * Reusable labels for cross-cutting classification of memories.
 *
 * Tags enable searching across types and paths. They are normalized
 * (lowercase, trimmed) and deduplicated at insert time.
 *
 * @field id - Auto-incrementing primary key.
 * @field name - Unique normalized tag name (e.g. "xenomorph", "alchemy", "bounty-hunting").
 */
export const tags = sqliteTable("tags", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
});

/**
 * Many-to-many join table between memories and tags.
 *
 * A memory can have zero or many tags. A tag can belong to many memories.
 * The composite primary key prevents duplicate associations.
 *
 * @field memoryId - FK to memories.id.
 * @field tagId - FK to tags.id.
 */
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

/**
 * Indexed path segments for efficient memory classification queries.
 *
 * When a memory has a path like "Alchemy -> Transmutation -> Forbidden", each segment
 * is stored as a separate normalized row: ("alchemy", 0), ("transmutation", 1), ("forbidden", 2).
 * The original display format is preserved in memories.path.
 *
 * @field id - Auto-incrementing primary key.
 * @field memoryId - FK to memories.id. The memory this segment belongs to.
 * @field position - Zero-based index of the segment within the pipe (0 = first segment).
 * @field segment - Normalized (lowercase, trimmed) segment text for indexed matching.
 */
export const memoryPaths = sqliteTable("memory_paths", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	memoryId: integer("memory_id")
		.notNull()
		.references(() => memories.id, { onDelete: "cascade" }),
	position: integer("position").notNull(),
	segment: text("segment").notNull(),
});
