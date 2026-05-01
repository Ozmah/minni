import { z } from "zod";

import {
	devModeInsertSchema,
	devModeSelectSchema,
	devModeUpdateSchema,
	memorySelectSchema,
	ruleInsertSchema,
	ruleSelectSchema,
} from "../../schema";

export const DevModePatchBody = devModeUpdateSchema
	.pick({
		name: true,
		description: true,
		permission: true,
	})
	.partial();

export const DevModeCreateBody = devModeInsertSchema.pick({
	name: true,
	description: true,
	permission: true,
});

export const DevModePrincipleInputSchema = ruleInsertSchema
	.pick({ statement: true, rationale: true, severity: true, permission: true, example: true })
	.extend({ id: z.number().int().optional() });

export const DevModePrinciplesBody = z.object({
	principles: z.array(DevModePrincipleInputSchema).max(50),
});

export const DevModeMemoriesBody = z.object({
	memoryIds: z.array(z.number().int()).max(100),
});

export const DevModeCompositionBody = DevModeCreateBody.extend({
	description: devModeInsertSchema.shape.description.unwrap(),
	principles: z.array(DevModePrincipleInputSchema).max(50),
	memoryIds: z.array(z.number().int()).max(100),
});

const DevModeMemorySummarySchema = memorySelectSchema
	.pick({ id: true, title: true, type: true, status: true, permission: true })
	.extend({ sortOrder: z.number() });

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
