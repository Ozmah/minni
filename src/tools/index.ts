import type { MinniDB } from "../helpers";

import { canvasTools } from "./canvas";
import { memoryTools } from "./memory";
import { projectTools } from "./project";
import { systemTools } from "./system";
import { taskTools } from "./task";

/**
 * Creates all Minni tools bound to a specific database instance.
 * Called once during plugin initialization.
 */
export function createTools(db: MinniDB) {
	return {
		...projectTools(db),
		...memoryTools(db),
		...taskTools(db),
		...canvasTools(),
		...systemTools(db),
	};
}
