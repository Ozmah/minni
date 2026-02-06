import type { LucideIcon } from "lucide-react";

import { Circle, CircleCheck, CircleDot, CircleX } from "lucide-react";

import type {
	TaskStatus,
	TaskPriority,
	MemoryType,
	MemoryStatus,
	ProjectStatus,
} from "../../../src/schema";

// === Types ===

export interface StatusConfig {
	color: string;
	label: string;
}

export interface StatusConfigWithIcon extends StatusConfig {
	icon: LucideIcon;
}

// === Task Configs ===

export const TASK_STATUS_CONFIG: Record<TaskStatus, StatusConfigWithIcon> = {
	todo: { color: "bg-gray-500/20 text-gray-400", label: "To Do", icon: Circle },
	in_progress: { color: "bg-yellow-500/20 text-yellow-400", label: "In Progress", icon: CircleDot },
	done: { color: "bg-green-500/20 text-green-400", label: "Done", icon: CircleCheck },
	cancelled: { color: "bg-red-500/20 text-red-400", label: "Cancelled", icon: CircleX },
};

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, StatusConfig> = {
	high: { color: "bg-red-500/20 text-red-400", label: "High" },
	medium: { color: "bg-yellow-500/20 text-yellow-400", label: "Medium" },
	low: { color: "bg-gray-500/20 text-gray-400", label: "Low" },
};

// === Memory Configs ===

export const MEMORY_TYPE_CONFIG: Record<MemoryType, StatusConfig> = {
	skill: { color: "bg-blue-500/20 text-blue-400", label: "Skill" },
	pattern: { color: "bg-green-500/20 text-green-400", label: "Pattern" },
	anti_pattern: { color: "bg-red-500/20 text-red-400", label: "Anti-Pattern" },
	decision: { color: "bg-purple-500/20 text-purple-400", label: "Decision" },
	insight: { color: "bg-yellow-500/20 text-yellow-400", label: "Insight" },
	comparison: { color: "bg-cyan-500/20 text-cyan-400", label: "Comparison" },
	note: { color: "bg-gray-500/20 text-gray-400", label: "Note" },
	link: { color: "bg-indigo-500/20 text-indigo-400", label: "Link" },
	article: { color: "bg-orange-500/20 text-orange-400", label: "Article" },
	video: { color: "bg-pink-500/20 text-pink-400", label: "Video" },
	documentation: { color: "bg-teal-500/20 text-teal-400", label: "Documentation" },
	identity: { color: "bg-amber-500/20 text-amber-400", label: "Identity" },
	context: { color: "bg-emerald-500/20 text-emerald-400", label: "Context" },
	scratchpad: { color: "bg-slate-500/20 text-slate-400", label: "Scratchpad" },
};

export const MEMORY_STATUS_CONFIG: Record<MemoryStatus, StatusConfig> = {
	draft: { color: "bg-gray-500/20 text-gray-400", label: "Draft" },
	experimental: { color: "bg-yellow-500/20 text-yellow-400", label: "Experimental" },
	proven: { color: "bg-green-500/20 text-green-400", label: "Proven" },
	battle_tested: { color: "bg-blue-500/20 text-blue-400", label: "Battle Tested" },
	deprecated: { color: "bg-red-500/20 text-red-400", label: "Deprecated" },
};

// === Project Configs ===

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, StatusConfig> = {
	active: { color: "bg-green-500/20 text-green-400", label: "Active" },
	paused: { color: "bg-yellow-500/20 text-yellow-400", label: "Paused" },
	completed: { color: "bg-blue-500/20 text-blue-400", label: "Completed" },
	archived: { color: "bg-gray-500/20 text-gray-400", label: "Archived" },
	deleted: { color: "bg-red-500/20 text-red-400", label: "Deleted" },
};

// === Fallback ===

export const DEFAULT_STATUS_CONFIG: StatusConfig = {
	color: "bg-gray-500/20 text-gray-400",
	label: "Unknown",
};

// === Helpers ===

/**
 * Gets config for a status/type key with fallback for unknown values.
 * Accepts string to handle data from backend that might have values not in the config.
 */
export function getStatusConfig<K extends string, T extends StatusConfig>(
	config: Record<K, T>,
	key: string,
	fallbackLabel?: string,
): T {
	const value = (config as Record<string, T>)[key];
	return value ?? ({ ...DEFAULT_STATUS_CONFIG, label: fallbackLabel ?? key } as T);
}
