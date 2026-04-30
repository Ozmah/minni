import { z } from "zod";

import { PERMISSION, projectSelectSchema, ruleSelectSchema, RULE_SEVERITY } from "../../schema";

export const ProjectCreateBody = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().max(5000).optional(),
	stack: z.array(z.string().trim().min(1)).max(50).default([]),
	permission: z.enum(PERMISSION).default("guarded"),
});

export const ProjectPatchBody = z.object({
	name: z.string().trim().min(1).max(100).optional(),
	description: z.string().max(5000).optional(),
	stack: z.array(z.string().trim().min(1)).max(50).optional(),
	permission: z.enum(PERMISSION).optional(),
});

export const ProjectRuleInputSchema = z.object({
	id: z.number().int().optional(),
	kind: z.enum(["convention", "gotcha"]),
	statement: z.string().trim().min(1),
	rationale: z.string().max(2000).nullable().optional(),
	severity: z.enum(RULE_SEVERITY).default("default"),
	permission: z.enum(PERMISSION).default("guarded"),
	example: z.string().max(2000).nullable().optional(),
});

export const ProjectCompositionBody = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().max(5000),
	stack: z.array(z.string().trim().min(1)).max(50),
	permission: z.enum(PERMISSION),
	rules: z.array(ProjectRuleInputSchema).max(100),
	memoryIds: z.array(z.number().int()).max(100),
});

const ProjectMemorySummarySchema = z.object({
	id: z.number(),
	title: z.string(),
	type: z.string(),
	status: z.string(),
	permission: z.string(),
	sortOrder: z.number(),
});

const ProjectSummarySchema = z.object({
	conventionCount: z.number(),
	gotchaCount: z.number(),
	memoryCount: z.number(),
});

export const ProjectEnrichedResponseSchema = z.object({
	project: projectSelectSchema,
	rules: z.array(ruleSelectSchema),
	memories: z.array(ProjectMemorySummarySchema),
	isActive: z.boolean(),
	summary: ProjectSummarySchema,
	injectionPreview: z.string(),
});
