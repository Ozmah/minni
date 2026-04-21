CREATE TABLE `active_state` (
	`id` integer PRIMARY KEY DEFAULT 1,
	`active_project_id` integer,
	`active_dev_mode_id` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_active_state_active_project_id_projects_id_fk` FOREIGN KEY (`active_project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_active_state_active_dev_mode_id_dev_modes_id_fk` FOREIGN KEY (`active_dev_mode_id`) REFERENCES `dev_modes`(`id`) ON DELETE SET NULL,
	CONSTRAINT "active_state_singleton_check" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `commands` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`project_id` integer NOT NULL,
	`key` text NOT NULL,
	`command` text NOT NULL,
	`summary` text,
	`group` text DEFAULT 'misc' NOT NULL,
	`risk` text DEFAULT 'safe' NOT NULL,
	`visibility` text DEFAULT 'secondary' NOT NULL,
	`permission` text DEFAULT 'guarded' NOT NULL,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_commands_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `dev_mode_memories` (
	`dev_mode_id` integer NOT NULL,
	`memory_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `dev_mode_memories_pk` PRIMARY KEY(`dev_mode_id`, `memory_id`),
	CONSTRAINT `fk_dev_mode_memories_dev_mode_id_dev_modes_id_fk` FOREIGN KEY (`dev_mode_id`) REFERENCES `dev_modes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_dev_mode_memories_memory_id_memories_id_fk` FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `dev_modes` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`permission` text DEFAULT 'guarded' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_memories` (
	`project_id` integer NOT NULL,
	`memory_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `project_memories_pk` PRIMARY KEY(`project_id`, `memory_id`),
	CONSTRAINT `fk_project_memories_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_project_memories_memory_id_memories_id_fk` FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`dev_mode_id` integer,
	`project_id` integer,
	`kind` text NOT NULL,
	`statement` text NOT NULL,
	`rationale` text,
	`severity` text DEFAULT 'default' NOT NULL,
	`permission` text DEFAULT 'guarded' NOT NULL,
	`example` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_rules_dev_mode_id_dev_modes_id_fk` FOREIGN KEY (`dev_mode_id`) REFERENCES `dev_modes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_rules_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
	CONSTRAINT "rules_kind_scope_check" CHECK((
				("kind" = 'principle' AND "dev_mode_id" IS NOT NULL AND "project_id" IS NULL)
				OR
				("kind" IN ('convention', 'gotcha') AND "project_id" IS NOT NULL AND "dev_mode_id" IS NULL)
			))
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_memories` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`permission` text DEFAULT 'guarded' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_memories`(`id`, `type`, `title`, `content`, `status`, `permission`, `created_at`, `updated_at`) SELECT `id`, `type`, `title`, `content`, `status`, `permission`, `created_at`, `updated_at` FROM `memories`;--> statement-breakpoint
DROP TABLE `memories`;--> statement-breakpoint
ALTER TABLE `__new_memories` RENAME TO `memories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_memories_project`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_memories_project_type`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_tasks_project`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_tasks_parent`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_tasks_status`;--> statement-breakpoint
CREATE INDEX `idx_memories_type` ON `memories` (`type`);--> statement-breakpoint
CREATE INDEX `idx_memories_status` ON `memories` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `commands_project_key_unique` ON `commands` (`project_id`,`key`);--> statement-breakpoint
CREATE INDEX `idx_commands_project` ON `commands` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_commands_group` ON `commands` (`group`);--> statement-breakpoint
CREATE INDEX `idx_commands_visibility` ON `commands` (`visibility`);--> statement-breakpoint
CREATE INDEX `idx_dev_mode_memories_dev_mode` ON `dev_mode_memories` (`dev_mode_id`);--> statement-breakpoint
CREATE INDEX `idx_dev_mode_memories_memory` ON `dev_mode_memories` (`memory_id`);--> statement-breakpoint
CREATE INDEX `idx_project_memories_project` ON `project_memories` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_project_memories_memory` ON `project_memories` (`memory_id`);--> statement-breakpoint
CREATE INDEX `idx_rules_dev_mode` ON `rules` (`dev_mode_id`);--> statement-breakpoint
CREATE INDEX `idx_rules_project` ON `rules` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_rules_kind` ON `rules` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_rules_severity` ON `rules` (`severity`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE `global_context`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `default_memory_permission`;
