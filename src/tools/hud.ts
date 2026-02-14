import { tool } from "@opencode-ai/plugin";
import { Result } from "better-result";

import { type MinniDB, getHudData, getActiveIdentity, getSetting } from "../helpers";

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
				const hud = await getHudData(db);

				const projectLine = hud.project
					? `project: ${hud.project.name} (P${hud.project.id}) | ${hud.project.status ?? "unknown"}`
					: "project: global";

				const identityLine = hud.identity
					? `identity: ${hud.identity.title} (M${hud.identity.id})`
					: "identity: none";

				const { tasks: t } = hud.counts;
				const countsLine = `counts: ${hud.counts.projects}P ${t.total}T(${t.todo}/${t.inProgress}/${t.done}) ${hud.counts.memories}M ${hud.counts.canvas}C`;

				const lines = ["[HUD]", projectLine, identityLine, countsLine, "[/HUD]"];

				// TODO add a very clear warning on the seetings UI and
				// file that this option will add a considerable amount of
				// tokens to the context each call based on the size of
				// the identity they add as default
				//
				// Optional identity injection (needs full Memory for content)
				const forceIdentity = await getSetting(db, "force_identity_on_hud");
				if (forceIdentity === "true" && hud.identity) {
					const identity = await getActiveIdentity(db);
					if (identity) {
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
				}

				return lines.join("\n");
			},
		}),
	};
}
