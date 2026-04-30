import type {
	MemoryStatus,
	MemoryType,
	Permission,
	Project,
	RuleSeverity,
} from "../../../src/schema";

import { parseJsonArray } from "./utils";

export type ProjectRuleKind = "convention" | "gotcha";

export type ProjectRule = {
	id: number;
	devModeId: number | null;
	projectId: number;
	kind: ProjectRuleKind;
	statement: string;
	rationale: string | null;
	severity: RuleSeverity;
	permission: Permission;
	example: string | null;
	sortOrder: number;
	createdAt: Date | string | number;
	updatedAt: Date | string | number;
};

export type ProjectMemorySummary = {
	id: number;
	title: string;
	type: MemoryType;
	status: MemoryStatus;
	permission: Permission;
	sortOrder: number;
};

export type EnrichedProject = {
	project: Project;
	rules: ProjectRule[];
	memories: ProjectMemorySummary[];
	isActive: boolean;
	summary: {
		conventionCount: number;
		gotchaCount: number;
		memoryCount: number;
	};
	injectionPreview: string;
};

export type ProjectRuleDraft = {
	clientKey: string;
	id?: number;
	kind: ProjectRuleKind;
	statement: string;
	rationale: string;
	severity: RuleSeverity;
	permission: Permission;
	example: string;
};

export type ProjectComposerDraft = {
	name: string;
	description: string;
	stack: string;
	permission: Permission;
	rules: ProjectRuleDraft[];
	memoryIds: number[];
};

export function createProjectComposerDraft(data: EnrichedProject): ProjectComposerDraft {
	return {
		name: data.project.name,
		description: data.project.description ?? "",
		stack: parseJsonArray(data.project.stack).join(", "),
		permission: data.project.permission,
		rules: data.rules.map((rule) => ({
			clientKey: `rule-${rule.id}`,
			id: rule.id,
			kind: rule.kind,
			statement: rule.statement,
			rationale: rule.rationale ?? "",
			severity: rule.severity,
			permission: rule.permission,
			example: rule.example ?? "",
		})),
		memoryIds: data.memories.map((memory) => memory.id),
	};
}

export function createEmptyProjectRule(kind: ProjectRuleKind): ProjectRuleDraft {
	return {
		clientKey: `new-${kind}-${crypto.randomUUID()}`,
		kind,
		statement: "",
		rationale: "",
		severity: "default",
		permission: "guarded",
		example: "",
	};
}

export function parseStackInput(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function buildProjectDraftPreview(draft: ProjectComposerDraft): string {
	const name = draft.name.trim() || "unnamed-project";
	const lines = [`[PROJECT:${name}]`];

	const description = draft.description.trim();
	if (description) lines.push(description);

	const stack = parseStackInput(draft.stack);
	if (description && (stack.length > 0 || draft.permission)) lines.push("");
	if (stack.length > 0) lines.push(`Stack: ${stack.join(", ")}`);
	lines.push(`Permission: ${draft.permission}`);

	const conventions = draft.rules.filter(
		(rule) => rule.kind === "convention" && rule.statement.trim(),
	);
	const gotchas = draft.rules.filter((rule) => rule.kind === "gotcha" && rule.statement.trim());

	if (conventions.length > 0) {
		lines.push("", "Conventions:");
		for (const convention of conventions) lines.push(`- ${convention.statement.trim()}`);
	}

	if (gotchas.length > 0) {
		lines.push("", "Gotchas:");
		for (const gotcha of gotchas) lines.push(`- ${gotcha.statement.trim()}`);
	}

	if (draft.memoryIds.length > 0) {
		lines.push("", `Associated memories: ${draft.memoryIds.length}`);
	}

	lines.push(`[/PROJECT:${name}]`);
	return lines.join("\n");
}
