import { describe, expect, test } from "bun:test";

import { buildActiveContextLoadout } from "../context/active-loadout";
import {
	attachDevModeMemory,
	attachProjectMemory,
	insertCommand,
	insertDevMode,
	insertMemory,
	insertProject,
	insertRule,
	setActiveLoadout,
} from "./helpers/fixtures";
import { withTestDb } from "./helpers/test-db";

describe("active context loadout", () => {
	test.concurrent("builds the canonical loadout with injectable sections and structured metadata", async () => {
		await withTestDb(async ({ db }) => {
			const project = await insertProject(db, {
				name: "minni-test-project",
				description: "Project context for tests.",
				stack: JSON.stringify(["Bun", "Drizzle"]),
			});
			const devMode = await insertDevMode(db, {
				name: "minni-test-dev-mode",
				description: "Dev mode context for tests.",
			});
			await setActiveLoadout(db, project.id, devMode.id);

			await insertRule(db, {
				projectId: project.id,
				kind: "convention",
				statement: "Use canonical loadout.",
			});
			await insertRule(db, {
				projectId: project.id,
				kind: "gotcha",
				statement: "Do not duplicate context builders.",
			});
			await insertRule(db, {
				devModeId: devMode.id,
				projectId: null,
				kind: "principle",
				statement: "Prefer contract tests over framework tests.",
			});

			const projectMemory = await insertMemory(db, { title: "Project-only memory" });
			const devModeMemory = await insertMemory(db, { title: "Dev-mode-only memory" });
			const sharedMemory = await insertMemory(db, { title: "Shared memory" });
			const lockedMemory = await insertMemory(db, { title: "Locked memory", permission: "locked" });
			await attachProjectMemory(db, project.id, projectMemory.id);
			await attachProjectMemory(db, project.id, sharedMemory.id);
			await attachProjectMemory(db, project.id, lockedMemory.id);
			await attachDevModeMemory(db, devMode.id, devModeMemory.id);
			await attachDevModeMemory(db, devMode.id, sharedMemory.id);

			await insertCommand(db, {
				projectId: project.id,
				key: "primary:test",
				visibility: "primary",
				permission: "guarded",
			});
			await insertCommand(db, {
				projectId: project.id,
				key: "secondary:test",
				visibility: "secondary",
				permission: "guarded",
			});
			await insertCommand(db, {
				projectId: project.id,
				key: "hidden:test",
				visibility: "hidden",
				permission: "guarded",
			});
			await insertCommand(db, {
				projectId: project.id,
				key: "locked:test",
				visibility: "primary",
				permission: "locked",
			});

			const loadout = await buildActiveContextLoadout(db);

			expect(loadout.sections.map((section) => section.key)).toEqual([
				"project",
				"commands",
				"dev-mode",
				"memories",
			]);
			expect(loadout.copyLayers.map((layer) => layer.key)).toEqual([
				"project-profile",
				"project-commands",
				"dev-mode-profile",
				"active-memories",
				"project-only-memories",
				"dev-mode-only-memories",
				"shared-memories",
			]);
			expect(loadout.counts).toMatchObject({ sections: 4, commands: 2, memories: 3 });

			const projectOverview = loadout.sections[0].items[0];
			expect(projectOverview.overview).toMatchObject({
				type: "project",
				name: "minni-test-project",
				stack: ["Bun", "Drizzle"],
				conventionCount: 1,
				gotchaCount: 1,
			});

			const commandItems =
				loadout.sections.find((section) => section.key === "commands")?.items ?? [];
			expect(commandItems.map((item) => item.title)).toEqual(["primary:test", "secondary:test"]);
			expect(commandItems.every((item) => item.command)).toBe(true);

			const principle = loadout.sections
				.find((section) => section.key === "dev-mode")
				?.items.find((item) => item.kind === "principle");
			expect(principle?.rule).toMatchObject({
				kind: "principle",
				statement: "Prefer contract tests over framework tests.",
			});

			const memoryItems =
				loadout.sections.find((section) => section.key === "memories")?.items ?? [];
			expect(memoryItems.map((item) => item.title).sort()).toEqual([
				"Dev-mode-only memory",
				"Project-only memory",
				"Shared memory",
			]);
			expect(
				memoryItems.find((item) => item.title === "Project-only memory")?.memory?.placement,
			).toBe("project");
			expect(
				memoryItems.find((item) => item.title === "Dev-mode-only memory")?.memory?.placement,
			).toBe("dev_mode");
			expect(memoryItems.find((item) => item.title === "Shared memory")?.memory?.placement).toBe(
				"shared",
			);
			expect(loadout.copyLayers.find((layer) => layer.key === "active-memories")?.text).toContain(
				"Project-only memory",
			);
			expect(loadout.copyLayers.find((layer) => layer.key === "active-memories")?.text).toContain(
				"Shared memory",
			);
			expect(
				loadout.copyLayers.find((layer) => layer.key === "project-only-memories")?.text,
			).toContain("Project-only memory");
			expect(
				loadout.copyLayers.find((layer) => layer.key === "project-only-memories")?.text,
			).not.toContain("Shared memory");
			expect(loadout.copyLayers.find((layer) => layer.key === "shared-memories")?.text).toContain(
				"Shared memory",
			);
			expect(loadout.text).toBe(loadout.sections.map((section) => section.text).join("\n\n"));
		});
	});

	test.concurrent("omits empty memory copy partitions", async () => {
		await withTestDb(async ({ db }) => {
			const project = await insertProject(db);
			const devMode = await insertDevMode(db);
			await setActiveLoadout(db, project.id, devMode.id);

			const projectMemory = await insertMemory(db, { title: "Only project memory" });
			await attachProjectMemory(db, project.id, projectMemory.id);

			const loadout = await buildActiveContextLoadout(db);
			const layerKeys = loadout.copyLayers.map((layer) => layer.key);

			expect(layerKeys).toContain("active-memories");
			expect(layerKeys).toContain("project-only-memories");
			expect(layerKeys).not.toContain("dev-mode-only-memories");
			expect(layerKeys).not.toContain("shared-memories");
		});
	});
});
