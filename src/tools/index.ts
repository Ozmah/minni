import type { MinniDB } from "../helpers";

import { canvasTools } from "./canvas";
import { equipTools } from "./equip";
import { hudTools } from "./hud";
import { memoryTools } from "./memory";
import { projectTools } from "./project";
import { taskTools } from "./task";

/**
 * Creates all Minni tools bound to a specific database instance.
 * Called once during plugin initialization.
 */
export function createTools(db: MinniDB) {
	return {
		...hudTools(db),
		...equipTools(db),
		...memoryTools(db),
		...projectTools(db),
		...taskTools(db),
		...canvasTools(),
	};
}
