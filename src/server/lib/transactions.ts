import { sql } from "drizzle-orm";

import type { MinniDB } from "../../helpers";

/** Runs a libsql transaction for route mutations that need all-or-nothing persistence. */
export async function withTransaction<T>(db: MinniDB, operation: () => Promise<T>): Promise<T> {
	await db.run(sql`BEGIN`);
	try {
		const result = await operation();
		await db.run(sql`COMMIT`);
		return result;
	} catch (error) {
		await db.run(sql`ROLLBACK`);
		throw error;
	}
}
