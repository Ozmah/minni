import { describe, expect, test } from "bun:test";

import type { Command, Memory, Rule } from "../../schema";

import {
	formatCommandContextBlock,
	formatMemoryContextBlock,
	formatRuleContextBlock,
	joinContextBlocks,
	parseProjectStack,
} from "../context/formatters";

const now = new Date("2026-05-01T00:00:00.000Z");

function commandFixture(overrides: Partial<Command> = {}): Command {
	return {
		id: 1,
		projectId: 9,
		key: "test:unit:coverage",
		command: "CHROME_BIN=/usr/bin/chromium-browser npm test -- --code-coverage",
		summary: "Run Angular unit tests with coverage",
		group: "test",
		risk: "mutating",
		visibility: "secondary",
		permission: "guarded",
		notes: "Requires Chromium in CI.",
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function memoryFixture(overrides: Partial<Memory> = {}): Memory {
	return {
		id: 42,
		type: "pattern",
		title: "Canonical context pipeline",
		content: "All active context must flow through buildActiveContextLoadout.",
		status: "proven",
		permission: "guarded",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function ruleFixture(overrides: Partial<Rule> = {}): Rule {
	return {
		id: 7,
		devModeId: null,
		projectId: 9,
		kind: "convention",
		statement: "Use the canonical context loadout for all injected context.",
		rationale: "Parallel context builders drift and create agent-visible contradictions.",
		severity: "critical",
		permission: "guarded",
		example: "minni_equip(active:true) and Cockpit must render the same blocks.",
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

describe("context formatters", () => {
	test("formats command blocks as stable LLM-facing contracts", () => {
		expect(formatCommandContextBlock(commandFixture())).toBe(
			[
				"[COMMAND:test/test:unit:coverage]",
				"Command: CHROME_BIN=/usr/bin/chromium-browser npm test -- --code-coverage",
				"Risk: mutating",
				"Visibility: secondary",
				"Summary: Run Angular unit tests with coverage",
				"",
				"Notes:",
				"Requires Chromium in CI.",
				"[/COMMAND:test/test:unit:coverage]",
			].join("\n"),
		);
	});

	test("omits memory permission from injected memory context", () => {
		const block = formatMemoryContextBlock(memoryFixture({ permission: "locked" }), "shared");

		expect(block).toContain("[MEMORY:M42]");
		expect(block).toContain("Placement: Shared");
		expect(block).toContain("Status: Proven");
		expect(block).toContain("All active context must flow through buildActiveContextLoadout.");
		expect(block).not.toContain("Permission:");
	});

	test("formats rules with rationale and example only when domain data exists", () => {
		const guardedRule = formatRuleContextBlock("convention", ruleFixture());
		const openRule = formatRuleContextBlock(
			"principle",
			ruleFixture({
				devModeId: 3,
				projectId: null,
				kind: "principle",
				permission: "open",
				rationale: null,
				example: null,
			}),
		);

		expect(guardedRule).toContain("Permission: guarded");
		expect(guardedRule).toContain("Rationale:\nParallel context builders drift");
		expect(guardedRule).toContain("Example:\nminni_equip(active:true)");
		expect(openRule).not.toContain("Permission:");
		expect(openRule).not.toContain("Rationale:");
		expect(openRule).not.toContain("Example:");
	});

	test("keeps project stack parsing compatible with JSON and legacy plain text", () => {
		expect(parseProjectStack('["TanStack Start","ElysiaJS","Bun"]')).toEqual([
			"TanStack Start",
			"ElysiaJS",
			"Bun",
		]);
		expect(parseProjectStack("Laravel, Inertia, React")).toEqual(["Laravel, Inertia, React"]);
		expect(parseProjectStack(null)).toEqual([]);
	});

	test("joins context blocks with the separator expected by active equip", () => {
		expect(joinContextBlocks(["", "[PROJECT:minni]", "", "[DEV_MODE:minni-core]"])).toBe(
			"[PROJECT:minni]\n\n[DEV_MODE:minni-core]",
		);
	});
});
