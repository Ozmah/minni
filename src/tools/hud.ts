import { tool } from "@opencode-ai/plugin";
import { Result } from "better-result";
import { sql, eq, count } from "drizzle-orm";

import { type MinniDB, getActiveProject, getActiveIdentity, getSetting } from "../helpers";
import { projects, memories, tasks } from "../schema";
import { getPages } from "../server";

/**
 * Creates HUD tool: minni_hud
 */
export function hudTools(db: MinniDB) {
	return {
		minni_hud: tool({
			description:
				"System state and navigation. Cheap to call, always fresh from DB. Call often to refresh your awareness.",
			args: {},
			async execute(_args, context) {
				const active = await getActiveProject(db);
				const identity = await getActiveIdentity(db);

				// Task and Memory Counts scoped to active project when set
				const taskFilter = active ? eq(tasks.projectId, active.id) : sql`1=1`;
				const memoryFilter = active ? eq(memories.projectId, active.id) : sql`1=1`;

				const [projectCount, taskCounts, memoryCount] = await Promise.all([
					db
						.select({ total: count() })
						.from(projects)
						.where(sql`${projects.status} != 'deleted'`),
					db
						.select({ status: tasks.status, total: count() })
						.from(tasks)
						.where(taskFilter)
						.groupBy(tasks.status),
					db.select({ total: count() }).from(memories).where(memoryFilter),
				]);

				// TODO this will be changed in the canvas refactor
				const canvasPages = getPages().length;

				const todo = taskCounts.find((t) => t.status === "todo")?.total ?? 0;
				const wip = taskCounts.find((t) => t.status === "in_progress")?.total ?? 0;
				const done = taskCounts.find((t) => t.status === "done")?.total ?? 0;
				const totalTasks = taskCounts.reduce((sum, t) => sum + t.total, 0);

				// Resolve project status for HUD line
				let projectLine: string;
				if (active) {
					const proj = await db
						.select({ status: projects.status })
						.from(projects)
						.where(eq(projects.id, active.id))
						.limit(1);
					projectLine = `project: ${active.name} (P${active.id}) | ${proj[0]?.status ?? "unknown"}`;
				} else {
					projectLine = "project: global";
				}

				const identityLine = identity
					? `identity: ${identity.title} (M${identity.id})`
					: "identity: none";

				const countsLine = `counts: ${projectCount[0].total}P ${totalTasks}T(${todo}/${wip}/${done}) ${memoryCount[0].total}M ${canvasPages}C`;

				const lines = ["[HUD]", projectLine, identityLine, countsLine, "[/HUD]"];

				// TODO add a very clear warning on the seetings UI and
				// file that this option will add a considerable amount of
				// tokens to the context each call based on the size of
				// the identity they add as default
				//
				// Optional identity injection
				const forceIdentity = await getSetting(db, "force_identity_on_hud");
				if (forceIdentity === "true" && identity) {
					const askFirst = await getSetting(db, "ask_before_identity_injection");
					let inject = true;

					if (askFirst === "true") {
						const confirmed = await Result.tryPromise({
							try: () =>
								context.ask({
									permission: "minni_identity_injection",
									patterns: [`[${identity.id}] ${identity.title}`],
									always: [],
									metadata: { identityId: identity.id },
								}),
							catch: () => "User denied identity injection.",
						});
						inject = confirmed.isOk();
					}

					if (inject) {
						lines.push("");
						lines.push(`[IDENTITY:${identity.title}]`);
						lines.push(identity.content);
						lines.push(`[/IDENTITY:${identity.title}]`);
					}
				}

				return lines.join("\n");
			},
		}),
	};
}
