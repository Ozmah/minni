import { sqliteTable, text } from "drizzle-orm/sqlite-core";
// TODO [T70]: drizzle-zod → drizzle-orm/zod when 1.0 stable
import { createSelectSchema } from "drizzle-zod";

export const settings = sqliteTable("settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
});

export type Settings = typeof settings.$inferSelect;

export const settingsSelectSchema = createSelectSchema(settings);
