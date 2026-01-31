import { tool } from "@opencode-ai/plugin";
import { eq, count } from "drizzle-orm";

import {
	type MinniDB,
	type ToolContext,
	getActiveProject,
	resolveProject,
	guardedAction,
} from "../helpers";
import { projects, memories, globalContext } from "../schema";

/**
 * Creates system-related tools: minni_ping, minni_summary
 */
export function systemTools(db: MinniDB) {
	return {
		minni_ping: tool({
			description: "DB health check + stats",
			args: {},
			async execute() {
				const memoryCount = await db.select({ total: count() }).from(memories);
				const projectCount = await db.select({ total: count() }).from(projects);
				const ctx = await db.select().from(globalContext).where(eq(globalContext.id, 1)).limit(1);
				const active = await getActiveProject(db);

				const lines = [
					"Minni DB: Connected",
					`Projects: ${projectCount[0].total}`,
					`Memories: ${memoryCount[0].total}`,
					`Identity: ${ctx[0]?.identity ? "configured" : "not set"}`,
					`Preferences: ${ctx[0]?.preferences ? "custom" : "defaults"}`,
					active ? `Active project: ${active.name}` : "Mode: Global",
				];

				return lines.join("\n");
			},
		}),

		minni_summary: tool({
			description: "Save context summary for project or global",
			args: {
				summary: tool.schema.string(),
				project: tool.schema.string().optional().describe("Default: active project or global"),
			},
			async execute(args, context) {
				const resolved = await resolveProject(db, args.project);

				// No project = update global context
				if (!resolved) {
					await db
						.update(globalContext)
						.set({
							contextSummary: args.summary,
							contextUpdatedAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(globalContext.id, 1));
					return "Global context updated.";
				}

				// Get full project with permission
				const proj = await db.select().from(projects).where(eq(projects.id, resolved.id)).limit(1);
				if (!proj[0]) return "Project not found.";

				const result = await guardedAction(
					context as ToolContext,
					{ id: proj[0].id, name: proj[0].name, type: "project", permission: proj[0].permission },
					"update",
					async () => {
						await db
							.update(projects)
							.set({
								contextSummary: args.summary,
								contextUpdatedAt: new Date(),
								updatedAt: new Date(),
							})
							.where(eq(projects.id, proj[0].id));
						return `Context updated for ${proj[0].name}`;
					},
				);

				return result.ok ? result.value : result.error;
			},
		}),
	};
}
