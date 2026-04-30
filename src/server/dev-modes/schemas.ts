import { z } from "zod";

import { devModeSelectSchema, PERMISSION, ruleSelectSchema, RULE_SEVERITY } from "../../schema";

export const DevModePatchBody = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	permission: z.enum(["open", "guarded", "read_only", "locked"]).optional(),
});

export const DevModeCreateBody = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().max(500).optional(),
	permission: z.enum(PERMISSION).default("guarded"),
});

export const DevModePrincipleInputSchema = z.object({
	id: z.number().int().optional(),
	statement: z.string().trim().min(1),
	rationale: z.string().max(2000).nullable().optional(),
	severity: z.enum(RULE_SEVERITY).default("default"),
	permission: z.enum(PERMISSION).default("guarded"),
	example: z.string().max(2000).nullable().optional(),
});

export const DevModePrinciplesBody = z.object({
	principles: z.array(DevModePrincipleInputSchema).max(50),
});

export const DevModeMemoriesBody = z.object({
	memoryIds: z.array(z.number().int()).max(100),
});

export const DevModeCompositionBody = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().max(500),
	permission: z.enum(PERMISSION),
	principles: z.array(DevModePrincipleInputSchema).max(50),
	memoryIds: z.array(z.number().int()).max(100),
});

const DevModeMemorySummarySchema = z.object({
	id: z.number(),
	title: z.string(),
	type: z.string(),
	status: z.string(),
	permission: z.string(),
	sortOrder: z.number(),
});

const DevModeSummarySchema = z.object({
	principleCount: z.number(),
	memoryCount: z.number(),
});

export const DevModeEnrichedResponseSchema = z.object({
	devMode: devModeSelectSchema,
	principles: z.array(ruleSelectSchema),
	memories: z.array(DevModeMemorySummarySchema),
	isActive: z.boolean(),
	summary: DevModeSummarySchema,
	injectionPreview: z.string(),
});
