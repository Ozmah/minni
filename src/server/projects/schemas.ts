import { z } from "zod";

import {
	commandSelectSchema,
	memorySelectSchema,
	projectInsertSchema,
	projectSelectSchema,
	projectUpdateSchema,
	ruleInsertSchema,
	ruleSelectSchema,
} from "../../schema";
import { ProjectCommandsBody } from "../commands/contracts";

export const ProjectCreateBody = projectInsertSchema
	.pick({ name: true, description: true, permission: true })
	.extend({ stack: z.array(z.string().trim().min(1)).max(50).default([]) });

export const ProjectPatchBody = projectUpdateSchema
	.pick({ name: true, description: true, permission: true })
	.partial()
	.extend({ stack: z.array(z.string().trim().min(1)).max(50).optional() });

export const ProjectRuleInputSchema = ruleInsertSchema
	.pick({
		kind: true,
		statement: true,
		rationale: true,
		severity: true,
		permission: true,
		example: true,
	})
	.extend({ id: z.number().int().optional() })
	.refine((rule) => rule.kind === "convention" || rule.kind === "gotcha", {
		message: "Project rules must be convention or gotcha",
		path: ["kind"],
	});

export const ProjectCompositionBody = ProjectCreateBody.extend({
	description: projectInsertSchema.shape.description.unwrap(),
	stack: z.array(z.string().trim().min(1)).max(50),
	rules: z.array(ProjectRuleInputSchema).max(100),
	memoryIds: z.array(z.number().int()).max(100),
	commands: ProjectCommandsBody.shape.commands,
});

const ProjectMemorySummarySchema = memorySelectSchema
	.pick({
		id: true,
		title: true,
		type: true,
		status: true,
		permission: true,
	})
	.extend({ sortOrder: z.number() });

const ProjectSummarySchema = z.object({
	conventionCount: z.number(),
	gotchaCount: z.number(),
	memoryCount: z.number(),
	commandCount: z.number(),
});

export const ProjectEnrichedResponseSchema = z.object({
	project: projectSelectSchema,
	rules: z.array(ruleSelectSchema),
	memories: z.array(ProjectMemorySummarySchema),
	commands: z.array(commandSelectSchema),
	isActive: z.boolean(),
	summary: ProjectSummarySchema,
	injectionPreview: z.string(),
});
