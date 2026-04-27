import type {
	DevMode,
	MemoryStatus,
	MemoryType,
	Permission,
	RuleSeverity,
} from "../../../src/schema";

export type DevModePrinciple = {
	id: number;
	devModeId: number;
	projectId: number | null;
	kind: "principle";
	statement: string;
	rationale: string | null;
	severity: RuleSeverity;
	permission: Permission;
	example: string | null;
	sortOrder: number;
	createdAt: Date | string | number;
	updatedAt: Date | string | number;
};

export type DevModeMemorySummary = {
	id: number;
	title: string;
	type: MemoryType;
	status: MemoryStatus;
	permission: Permission;
	sortOrder: number;
};

export type EnrichedDevMode = {
	devMode: DevMode;
	principles: DevModePrinciple[];
	memories: DevModeMemorySummary[];
	isActive: boolean;
	summary: {
		principleCount: number;
		memoryCount: number;
	};
	injectionPreview: string;
};

export type PrincipleDraft = {
	clientKey: string;
	id?: number;
	statement: string;
	rationale: string;
	severity: RuleSeverity;
	permission: Permission;
	example: string;
};

export type DevModeComposerDraft = {
	name: string;
	description: string;
	permission: Permission;
	principles: PrincipleDraft[];
	memoryIds: number[];
};

export function createComposerDraft(data: EnrichedDevMode): DevModeComposerDraft {
	return {
		name: data.devMode.name,
		description: data.devMode.description ?? "",
		permission: data.devMode.permission,
		principles: data.principles.map((principle) => ({
			clientKey: `principle-${principle.id}`,
			id: principle.id,
			statement: principle.statement,
			rationale: principle.rationale ?? "",
			severity: principle.severity,
			permission: principle.permission,
			example: principle.example ?? "",
		})),
		memoryIds: data.memories.map((memory) => memory.id),
	};
}

export function buildDraftPreview(draft: DevModeComposerDraft): string {
	const name = draft.name.trim() || "unnamed-dev-mode";
	const lines = [`[DEV_MODE:${name}]`];

	const description = draft.description.trim();
	if (description) lines.push(description);
	lines.push(`Permission: ${draft.permission}`);

	const activePrinciples = draft.principles.filter((principle) => principle.statement.trim());
	if (activePrinciples.length > 0) {
		lines.push("");
		lines.push("Principles:");
		for (const principle of activePrinciples) lines.push(`- ${principle.statement.trim()}`);
	}

	if (draft.memoryIds.length > 0) {
		lines.push("");
		lines.push(`Associated memories: ${draft.memoryIds.length}`);
	}

	lines.push(`[/DEV_MODE:${name}]`);
	return lines.join("\n");
}

export function createEmptyPrinciple(): PrincipleDraft {
	return {
		clientKey: `new-${crypto.randomUUID()}`,
		statement: "",
		rationale: "",
		severity: "default",
		permission: "guarded",
		example: "",
	};
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
	if (to < 0 || to >= items.length) return items;
	const next = [...items];
	const [item] = next.splice(from, 1);
	if (!item) return items;
	next.splice(to, 0, item);
	return next;
}
