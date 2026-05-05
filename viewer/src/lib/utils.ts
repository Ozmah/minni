import { Result } from "better-result";

/**
 * Safely parses a JSON string representing an array of strings.
 * Returns empty array on invalid input.
 */
export function parseJsonArray(json: string | null): string[] {
	if (!json) return [];
	return Result.try(() => JSON.parse(json))
		.map((parsed) => (Array.isArray(parsed) ? parsed : []))
		.unwrapOr([]);
}

/**
 * Formats a date for display in the UI.
 * Accepts Date, string, or timestamp number.
 */
export function formatDate(date: string | Date | number): string {
	return new Date(date).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Extracts the first line from a project description.
 */
export function extractDescription(markdown: string | null): string | null {
	if (!markdown) return null;
	const firstLine = markdown.split("\n")[0]?.trim();
	return firstLine || null;
}
