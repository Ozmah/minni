import { describe, expect, test } from "bun:test";

import { commands } from "../../schema";
import {
	listInjectableProjectCommands,
	listProjectCommands,
	replaceProjectCommands,
} from "../commands/service";
import { commandInput, insertCommand, insertProject } from "./helpers/fixtures";
import { withTestDb } from "./helpers/test-db";

describe("commands service", () => {
	test.concurrent("replaces a project command deck with normalized persisted commands", async () => {
		await withTestDb(async ({ db }) => {
			const project = await insertProject(db);
			await insertCommand(db, { projectId: project.id, key: "old", command: "bun old" });

			await replaceProjectCommands(db, project.id, [
				commandInput({
					key: " quality:glados ",
					command: " bun run glados ",
					summary: " Full validation ",
					notes: " Before sync ",
				}),
				commandInput({ key: "", command: "bun ignored" }),
				commandInput({ key: "ignored", command: "" }),
			]);

			const rows = await listProjectCommands(db, project.id);

			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({
				projectId: project.id,
				key: "quality:glados",
				command: "bun run glados",
				summary: "Full validation",
				notes: "Before sync",
				sortOrder: 0,
			});
		});
	});

	test.concurrent("keeps command decks isolated per project", async () => {
		await withTestDb(async ({ db }) => {
			const first = await insertProject(db);
			const second = await insertProject(db);
			await insertCommand(db, { projectId: second.id, key: "second", command: "bun second" });

			await replaceProjectCommands(db, first.id, [commandInput({ key: "first" })]);

			expect((await listProjectCommands(db, first.id)).map((command) => command.key)).toEqual([
				"first",
			]);
			expect((await listProjectCommands(db, second.id)).map((command) => command.key)).toEqual([
				"second",
			]);
		});
	});

	test.concurrent("lists only injectable commands in composer order", async () => {
		await withTestDb(async ({ db }) => {
			const project = await insertProject(db);
			const now = new Date();
			await db.insert(commands).values([
				{
					projectId: project.id,
					key: "secondary-build",
					command: "bun run build",
					group: "build",
					risk: "safe",
					visibility: "secondary",
					permission: "guarded",
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				},
				{
					projectId: project.id,
					key: "primary-quality",
					command: "bun run glados",
					group: "quality",
					risk: "safe",
					visibility: "primary",
					permission: "guarded",
					sortOrder: 3,
					createdAt: now,
					updatedAt: now,
				},
				{
					projectId: project.id,
					key: "hidden-quality",
					command: "bun hidden",
					group: "quality",
					risk: "safe",
					visibility: "hidden",
					permission: "guarded",
					sortOrder: 1,
					createdAt: now,
					updatedAt: now,
				},
				{
					projectId: project.id,
					key: "locked-primary",
					command: "bun locked",
					group: "quality",
					risk: "safe",
					visibility: "primary",
					permission: "locked",
					sortOrder: 0,
					createdAt: now,
					updatedAt: now,
				},
			]);

			const visible = await listInjectableProjectCommands(db, project.id);

			expect(visible.map((command) => command.key)).toEqual(["secondary-build", "primary-quality"]);
		});
	});
});
