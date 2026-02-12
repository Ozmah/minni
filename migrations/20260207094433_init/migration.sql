CREATE TABLE `canvas` (
	`id` text PRIMARY KEY,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `global_context` (
	`id` integer PRIMARY KEY DEFAULT 1,
	`active_project_id` integer,
	`active_identity_id` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_global_context_active_project_id_projects_id_fk` FOREIGN KEY (`active_project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_global_context_active_identity_id_memories_id_fk` FOREIGN KEY (`active_identity_id`) REFERENCES `memories`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`project_id` integer,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`permission` text DEFAULT 'guarded' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_memories_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `memory_relations` (
	`memory_id` integer NOT NULL,
	`related_id` integer NOT NULL,
	CONSTRAINT `memory_relations_pk` PRIMARY KEY(`memory_id`, `related_id`),
	CONSTRAINT `fk_memory_relations_memory_id_memories_id_fk` FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_memory_relations_related_id_memories_id_fk` FOREIGN KEY (`related_id`) REFERENCES `memories`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `memory_tags` (
	`memory_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	CONSTRAINT `memory_tags_pk` PRIMARY KEY(`memory_id`, `tag_id`),
	CONSTRAINT `fk_memory_tags_memory_id_memories_id_fk` FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_memory_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`stack` text,
	`status` text DEFAULT 'active' NOT NULL,
	`permission` text DEFAULT 'guarded' NOT NULL,
	`default_memory_permission` text DEFAULT 'guarded' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`project_id` integer,
	`parent_id` integer,
	`title` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_tasks_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_tasks_parent_id_tasks_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_canvas_created_at` ON `canvas` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_memories_project` ON `memories` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_memories_type` ON `memories` (`type`);--> statement-breakpoint
CREATE INDEX `idx_memories_status` ON `memories` (`status`);--> statement-breakpoint
CREATE INDEX `idx_memories_project_type` ON `memories` (`project_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_memory_relations_memory` ON `memory_relations` (`memory_id`);--> statement-breakpoint
CREATE INDEX `idx_memory_relations_related` ON `memory_relations` (`related_id`);--> statement-breakpoint
CREATE INDEX `idx_memory_tags_memory` ON `memory_tags` (`memory_id`);--> statement-breakpoint
CREATE INDEX `idx_memory_tags_tag` ON `memory_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_parent` ON `tasks` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);