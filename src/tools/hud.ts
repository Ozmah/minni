import { tool } from "@opencode-ai/plugin";

import { type MinniDB, getHudData } from "../helpers";

export function hudTools(db: MinniDB) {
	return {
		minni_hud: tool({
			description:
				"System state and navigation. Cheap to call, always fresh from DB. Call often to refresh your awareness.",
			args: {},
			async execute() {
				const hud = await getHudData(db);

				const projectLine = hud.project
					? `project: ${hud.project.name} (P${hud.project.id})`
					: "project: none";

				const devModeLine = hud.devMode
					? `dev mode: ${hud.devMode.name} (D${hud.devMode.id})`
					: "dev mode: none";

				const countsLine = `counts: ${hud.counts.projects}P ${hud.counts.devModes}D ${hud.counts.memories}M ${hud.counts.commands}C ${hud.counts.rules}R ${hud.counts.canvas}Canvas`;

				return ["[HUD]", projectLine, devModeLine, countsLine, "[/HUD]"].join("\n");
			},
		}),
	};
}
