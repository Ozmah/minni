import { drizzle } from "drizzle-orm/tursodatabase/database";
import { homedir } from "node:os";
import { join } from "node:path";

import { initializeDatabase } from "./init";

async function seed() {
	const dbPath = join(homedir(), ".config", "opencode", "minni.db");
	const db = drizzle(dbPath);

	console.log(`Initializing Minni database at ${dbPath}...`);
	await initializeDatabase(db);
	console.log("Done.");
}

seed().catch((err) => {
	console.error("Seeder failed:", err);
	process.exit(1);
});
