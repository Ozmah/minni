import { drizzle } from "drizzle-orm/libsql";
import { homedir } from "node:os";
import { join } from "node:path";

import { initializeDatabase } from "../src/init";

const dbPath = join(homedir(), ".config", "opencode", "minni.db");

async function main() {
	console.log(`[Minni] setting up database at ${dbPath}`);

	const db = drizzle(`file:${dbPath}`);
	await initializeDatabase(db);

	console.log("[Minni] database setup complete");
}

main().catch((error) => {
	console.error("[Minni] database setup failed", error);
	process.exit(1);
});
