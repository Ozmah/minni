import { defineConfig } from "drizzle-kit";
import { homedir } from "node:os";
import { join } from "node:path";

export default defineConfig({
	schema: "./src/schema/index.ts",
	out: "./migrations",
	dialect: "turso",
	dbCredentials: {
		url: `file:${join(homedir(), ".config", "opencode", "minni.db")}`,
	},
});
