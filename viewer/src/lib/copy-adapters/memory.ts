import type { MemoryDetail } from "@/lib/memories";

const TYPE_LABEL: Record<MemoryDetail["type"], string> = {
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

const STATUS_LABEL: Record<MemoryDetail["status"], string> = {
	draft: "Draft",
	experimental: "Experimental",
	proven: "Proven",
	battle_tested: "Battle-tested",
	deprecated: "Deprecated",
};

const PERMISSION_LABEL: Record<MemoryDetail["permission"], string> = {
	open: "Open",
	guarded: "Guarded",
	read_only: "Read-only",
	locked: "Locked",
};

export function memoryDetailToMarkdown(memory: MemoryDetail): string {
	const lines: string[] = [];
	lines.push(`# ${memory.title}`);
	lines.push("");
	lines.push(memory.content);
	lines.push("");
	lines.push("---");
	lines.push(`- **Type:** ${TYPE_LABEL[memory.type]}`);
	lines.push(`- **Status:** ${STATUS_LABEL[memory.status]}`);
	lines.push(`- **Permission:** ${PERMISSION_LABEL[memory.permission]}`);

	if (memory.tags.length > 0) {
		lines.push(`- **Tags:** ${memory.tags.map((tag) => `#${tag}`).join(", ")}`);
	}

	if (memory.associations.projects.length > 0) {
		lines.push(
			`- **Projects:** ${memory.associations.projects.map((project) => project.name).join(", ")}`,
		);
	}

	if (memory.associations.devModes.length > 0) {
		lines.push(
			`- **Dev modes:** ${memory.associations.devModes.map((mode) => mode.name).join(", ")}`,
		);
	}

	lines.push(`- **Updated:** ${memory.updatedAt}`);
	return lines.join("\n");
}
