import { z } from "zod";

import { commandInsertSchema, commandSelectSchema } from "../../schema";

export const ProjectCommandInputSchema = commandInsertSchema
	.pick({
		key: true,
		command: true,
		summary: true,
		group: true,
		risk: true,
		visibility: true,
		permission: true,
		notes: true,
	})
	.extend({ id: z.number().int().optional() });

export const ProjectCommandsBody = z
	.object({
		commands: z.array(ProjectCommandInputSchema).max(100),
	})
	.refine(
		(body) => {
			const keys = body.commands.map((command) => command.key.trim()).filter(Boolean);
			return keys.length === new Set(keys).size;
		},
		{ message: "Command keys must be unique per project", path: ["commands"] },
	);

export const ProjectCommandsResponseSchema = z.array(commandSelectSchema);

export type ProjectCommandInput = z.infer<typeof ProjectCommandInputSchema>;
