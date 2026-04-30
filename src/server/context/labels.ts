import type { MemoryStatus, MemoryType } from "../../schema";
import type { ContextMemoryPlacement } from "./types";

export const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
	skill: "Skill",
	pattern: "Pattern",
	anti_pattern: "Anti-pattern",
	decision: "Decision",
	insight: "Insight",
	comparison: "Comparison",
	note: "Note",
	link: "Link",
	article: "Article",
	video: "Video",
	documentation: "Documentation",
};

export const MEMORY_STATUS_LABEL: Record<MemoryStatus, string> = {
	draft: "Draft",
	experimental: "Experimental",
	proven: "Proven",
	battle_tested: "Battle tested",
	deprecated: "Deprecated",
};

/** Human label for the active-context source that made a memory eligible for injection. */
export function formatContextMemoryPlacement(placement: ContextMemoryPlacement) {
	if (placement === "project") return "Project";
	if (placement === "dev_mode") return "Dev mode";
	if (placement === "shared") return "Shared";
	return null;
}
