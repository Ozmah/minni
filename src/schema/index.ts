// Base
export {
	timestamp,
	PROJECT_STATUS,
	WRITABLE_PROJECT_STATUS,
	PERMISSION,
	MEMORY_TYPE,
	MEMORY_STATUS,
	TASK_PRIORITY,
	TASK_STATUS,
	type ProjectStatus,
	type Permission,
	type MemoryType,
	type MemoryStatus,
	type TaskPriority,
	type TaskStatus,
} from "./base";

// Tables
export { projects } from "./projects";
export { globalContext } from "./global-context";
export { memories } from "./memories";
export { tasks } from "./tasks";
export { tags, memoryTags } from "./tags";
export { settings } from "./settings";
export { memoryRelations } from "./memory-relations";

// Types
export type { Project, NewProject } from "./projects";
export type { GlobalContext, NewGlobalContext } from "./global-context";
export type { Memory, NewMemory } from "./memories";
export type { Task, NewTask } from "./tasks";
export type { Tag, NewTag, MemoryTag } from "./tags";
export type { Settings } from "./settings";
export type { MemoryRelation } from "./memory-relations";

// Zod Schemas
export { projectSelectSchema, projectInsertSchema } from "./projects";
export { globalContextSelectSchema, globalContextInsertSchema } from "./global-context";
export { memorySelectSchema, memoryInsertSchema } from "./memories";
export { taskSelectSchema, taskInsertSchema } from "./tasks";
export { tagSelectSchema, tagInsertSchema } from "./tags";
export { settingsSelectSchema } from "./settings";
export { memoryRelationSelectSchema } from "./memory-relations";
