import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";
import { migrate } from "drizzle-orm/tursodatabase/migrator";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { MinniDB } from "../../../helpers";

type TestDbContext = {
	db: MinniDB;
	dbPath: string;
	tempDir: string;
};

const migrationsPath = join(import.meta.dir, "../../../../migrations");

/** Creates an isolated, file-backed database for one integration test. */
export async function withTestDb<T>(run: (context: TestDbContext) => Promise<T>): Promise<T> {
	const tempDir = await mkdtemp(join(tmpdir(), "minni-test-"));
	const dbPath = join(tempDir, "minni.db");
	const db = drizzle(dbPath);

	try {
		await migrate(db, { migrationsFolder: migrationsPath });
		await db.run(sql`
			INSERT OR IGNORE INTO active_state (id, created_at, updated_at)
			VALUES (1, cast(unixepoch() * 1000 as integer), cast(unixepoch() * 1000 as integer))
		`);
		return await run({ db, dbPath, tempDir });
	} finally {
		await db.$client.close();
		if (process.env.MINNI_KEEP_TEST_DB !== "1") {
			await rm(tempDir, { recursive: true, force: true });
		}
	}
}
