import { tool } from "@opencode-ai/plugin";
import { eq, desc } from "drizzle-orm";

import {
	type MinniDB,
	type ToolContext,
	guardedAction,
	getActiveDevMode,
	setActiveDevMode,
	validateEnum,
} from "../helpers";
import { devModes, PERMISSION, type Permission } from "../schema";

function normalizeDevModeName(name: string): string {
	return name.trim();
}

export function devModeTools(db: MinniDB) {
	return {
		minni_dev_mode: tool({
			description:
				"CRUD Dev Modes. Output: `[D{id}] {name}`. Use action load to switch the active Dev Mode.",
			args: {
				action: tool.schema.enum(["create", "update", "delete", "list", "load"]),
				name: tool.schema
					.string()
					.optional()
					.describe("Required for create/update/delete/load. Visible Dev Mode name."),
				description: tool.schema.string().optional(),
				permission: tool.schema
					.enum(["open", "guarded", "read_only", "locked"])
					.optional()
					.describe("Default: guarded"),
			},
			async execute(args, context) {
				if (args.action === "load") return handleLoad(db, args);
				if (args.action === "create") return handleCreate(db, args);
				if (args.action === "update") return handleUpdate(db, context, args);
				if (args.action === "delete") return handleDelete(db, context, args);
				if (args.action === "list") return handleList(db);

				return "Unknown action. Use: create, update, delete, list, load";
			},
		}),
	};
}

type LoadArgs = { name?: string };

async function handleLoad(db: MinniDB, args: LoadArgs): Promise<string> {
	if (!args.name) {
		await setActiveDevMode(db, null);

		const current = await getActiveDevMode(db);
		const modes = await db.select().from(devModes).orderBy(desc(devModes.updatedAt)).limit(10);
		const sections = ["## No Active Dev Mode\n", `Dev Modes: ${modes.length}`];

		if (current) sections.push(`Current: [D${current.id}] ${current.name}`);
		if (modes.length > 0) {
			sections.push("\n### Available Dev Modes");
			for (const mode of modes) {
				sections.push(`- [D${mode.id}] ${mode.name}`);
			}
		}

		return sections.join("\n");
	}

	const name = normalizeDevModeName(args.name);
	const mode = await db.select().from(devModes).where(eq(devModes.name, name)).limit(1);
	if (!mode[0]) return `Dev Mode "${name}" not found. Use action: create.`;

	await setActiveDevMode(db, {
		id: mode[0].id,
		name: mode[0].name,
		permission: mode[0].permission,
	});

	const lines = [`## ${mode[0].name}`];
	if (mode[0].description) lines.push(mode[0].description);
	lines.push(`Permission: ${mode[0].permission}`);

	return lines.join("\n");
}

type CreateArgs = { name?: string; description?: string; permission?: string };

async function handleCreate(db: MinniDB, args: CreateArgs): Promise<string> {
	if (!args.name) return "Name is required.";
	const name = normalizeDevModeName(args.name);
	if (!name) return "Name is required.";

	if (args.permission) {
		const err = validateEnum(args.permission, PERMISSION, "permission");
		if (err) return err;
	}

	const existing = await db.select().from(devModes).where(eq(devModes.name, name)).limit(1);
	if (existing[0]) return `Dev Mode "${name}" already exists. Use action: update.`;

	const result = await db
		.insert(devModes)
		.values({
			name,
			description: args.description ?? null,
			permission: (args.permission ?? "guarded") as Permission,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning({ id: devModes.id });

	return `Dev Mode created: [D${result[0].id}] ${name}`;
}

type UpdateArgs = { name?: string; description?: string; permission?: string };

async function handleUpdate(db: MinniDB, context: unknown, args: UpdateArgs): Promise<string> {
	if (!args.name) return "Name is required to identify the Dev Mode.";
	if (args.permission) {
		const err = validateEnum(args.permission, PERMISSION, "permission");
		if (err) return err;
	}

	const name = normalizeDevModeName(args.name);
	const mode = await db.select().from(devModes).where(eq(devModes.name, name)).limit(1);
	if (!mode[0]) return `Dev Mode "${name}" not found.`;

	const result = await guardedAction(
		db,
		context as ToolContext,
		{ id: mode[0].id, name: mode[0].name, type: "dev_mode", permission: mode[0].permission },
		"update",
		async () => {
			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (args.description) updates.description = args.description;
			if (args.permission) updates.permission = args.permission;
			await db.update(devModes).set(updates).where(eq(devModes.id, mode[0].id));
			return `Dev Mode updated: ${name}`;
		},
	);

	return result.isOk() ? result.value : result.error;
}

type DeleteArgs = { name?: string };

async function handleDelete(db: MinniDB, context: unknown, args: DeleteArgs): Promise<string> {
	if (!args.name) return "Name is required to identify the Dev Mode.";
	const name = normalizeDevModeName(args.name);
	const mode = await db.select().from(devModes).where(eq(devModes.name, name)).limit(1);
	if (!mode[0]) return `Dev Mode "${name}" not found.`;

	const result = await guardedAction(
		db,
		context as ToolContext,
		{ id: mode[0].id, name: mode[0].name, type: "dev_mode", permission: mode[0].permission },
		"delete",
		async () => {
			await db.delete(devModes).where(eq(devModes.id, mode[0].id));
			return `Dev Mode deleted: ${name}`;
		},
	);

	return result.isOk() ? result.value : result.error;
}

async function handleList(db: MinniDB): Promise<string> {
	const all = await db.select().from(devModes).orderBy(desc(devModes.updatedAt));
	if (all.length === 0) return "No Dev Modes.";
	return all.map((mode) => `[D${mode.id}] ${mode.name}`).join("\n");
}
