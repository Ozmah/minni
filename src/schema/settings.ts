import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-orm/zod";

export const settings = sqliteTable("settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
});

export type Settings = typeof settings.$inferSelect;

export const settingsSelectSchema = createSelectSchema(settings);
