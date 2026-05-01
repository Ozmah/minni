import type { ContextMemoryPlacement } from "./types";

import { commands, devModes, memories, projects, rules } from "../../schema";
import { formatContextMemoryPlacement, MEMORY_STATUS_LABEL, MEMORY_TYPE_LABEL } from "./labels";

/** Parses stored project stack JSON while preserving legacy plain-text stack values. */
export function parseProjectStack(stack: string | null): string[] {
	if (!stack) return [];
	try {
		const parsed = JSON.parse(stack) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((item): item is string => typeof item === "string")
			: [stack];
	} catch {
		return [stack];
	}
}

/** Joins context blocks using the same separator expected by LLM-facing tool output. */
export function joinContextBlocks(blocks: string[]) {
	return blocks.filter(Boolean).join("\n\n");
}

/** Formats the project overview block shared by Cockpit and active-context equip. */
export function formatProjectOverview(project: typeof projects.$inferSelect) {
	const stack = parseProjectStack(project.stack);
	const lines = [`[PROJECT:${project.name}]`];
	if (project.description) lines.push(project.description);
	if (stack.length > 0) lines.push("", `Stack: ${stack.join(", ")}`);
	lines.push(`Permission: ${project.permission}`);
	lines.push(`[/PROJECT:${project.name}]`);
	return lines.join("\n");
}

/** Formats the Dev Mode overview block shared by Cockpit and active-context equip. */
export function formatDevModeOverview(devMode: typeof devModes.$inferSelect) {
	const lines = [`[DEV_MODE:${devMode.name}]`];
	if (devMode.description) lines.push(devMode.description);
	lines.push(`Permission: ${devMode.permission}`);
	lines.push(`[/DEV_MODE:${devMode.name}]`);
	return lines.join("\n");
}

/** Formats one project rule or Dev Mode principle as an inspectable context block. */
export function formatRuleContextBlock(
	kind: "convention" | "gotcha" | "principle",
	rule: typeof rules.$inferSelect,
) {
	const label = kind === "convention" ? "CONVENTION" : kind === "gotcha" ? "GOTCHA" : "PRINCIPLE";
	const lines = [`[${label}:R${rule.id}]`, rule.statement, `Severity: ${rule.severity}`];
	if (rule.permission !== "open") lines.push(`Permission: ${rule.permission}`);
	if (rule.rationale) lines.push("", "Rationale:", rule.rationale);
	if (rule.example) lines.push("", "Example:", rule.example);
	lines.push(`[/${label}:R${rule.id}]`);
	return lines.join("\n");
}

/** Formats a memory for LLM injection; permission is intentionally omitted from context text. */
export function formatMemoryContextBlock(
	memory: typeof memories.$inferSelect,
	placement: ContextMemoryPlacement,
) {
	const lines = [
		`[MEMORY:M${memory.id}]`,
		`Title: ${memory.title}`,
		`Type: ${MEMORY_TYPE_LABEL[memory.type]}`,
		`Status: ${MEMORY_STATUS_LABEL[memory.status]}`,
	];
	const label = formatContextMemoryPlacement(placement);
	if (label) lines.push(`Placement: ${label}`);
	lines.push("", memory.content, `[/MEMORY:M${memory.id}]`);
	return lines.join("\n");
}

/** Formats one project command as inspectable, copyable LLM context. */
export function formatCommandContextBlock(command: typeof commands.$inferSelect) {
	const lines = [
		`[COMMAND:${command.group}/${command.key}]`,
		`Command: ${command.command}`,
		`Risk: ${command.risk}`,
		`Visibility: ${command.visibility}`,
	];
	if (command.summary) lines.push(`Summary: ${command.summary}`);
	if (command.notes) lines.push("", "Notes:", command.notes);
	lines.push(`[/COMMAND:${command.group}/${command.key}]`);
	return lines.join("\n");
}

/** One-line metadata shown in command loadout lists without affecting command execution. */
export function formatCommandLoadoutSubtitle(command: typeof commands.$inferSelect) {
	return `${command.group} · ${command.risk} · ${command.visibility}`;
}

/** Compact project preview used by Composer cards; not the full active-context loadout. */
export function buildProjectInjectionPreview(args: {
	project: typeof projects.$inferSelect;
	projectRules: Array<typeof rules.$inferSelect>;
	memoryCount: number;
	commandCount: number;
}) {
	const lines = [`[PROJECT:${args.project.name}]`];
	if (args.project.description) lines.push(args.project.description);

	const stack = parseProjectStack(args.project.stack);
	if (args.project.description && (stack.length > 0 || args.project.permission)) lines.push("");
	if (stack.length > 0) lines.push(`Stack: ${stack.join(", ")}`);
	lines.push(`Permission: ${args.project.permission}`);

	const conventions = args.projectRules.filter((rule) => rule.kind === "convention");
	const gotchas = args.projectRules.filter((rule) => rule.kind === "gotcha");

	if (conventions.length > 0) {
		lines.push("", "Conventions:");
		for (const convention of conventions) lines.push(`- ${convention.statement}`);
	}

	if (gotchas.length > 0) {
		lines.push("", "Gotchas:");
		for (const gotcha of gotchas) lines.push(`- ${gotcha.statement}`);
	}

	if (args.memoryCount > 0) lines.push("", `Associated memories: ${args.memoryCount}`);
	if (args.commandCount > 0) lines.push("", `Configured commands: ${args.commandCount}`);

	lines.push(`[/PROJECT:${args.project.name}]`);
	return lines.join("\n");
}

/** Compact Dev Mode preview used by Composer cards; not the full active-context loadout. */
export function buildDevModeInjectionPreview(args: {
	devMode: typeof devModes.$inferSelect;
	principles: Array<typeof rules.$inferSelect>;
	memoryCount: number;
}) {
	const lines = [`[DEV_MODE:${args.devMode.name}]`];
	if (args.devMode.description) lines.push(args.devMode.description);
	lines.push(`Permission: ${args.devMode.permission}`);

	if (args.principles.length > 0) {
		lines.push("", "Principles:");
		for (const principle of args.principles) lines.push(`- ${principle.statement}`);
	}

	if (args.memoryCount > 0) lines.push("", `Associated memories: ${args.memoryCount}`);

	lines.push(`[/DEV_MODE:${args.devMode.name}]`);
	return lines.join("\n");
}

/** One-line metadata shown in loadout lists without affecting the injected context block. */
export function formatMemoryLoadoutSubtitle(
	memory: typeof memories.$inferSelect,
	placement: ContextMemoryPlacement,
) {
	const label = formatContextMemoryPlacement(placement);
	return [label, MEMORY_STATUS_LABEL[memory.status]].filter(Boolean).join(" · ");
}
