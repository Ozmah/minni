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

/** Parses comma-separated project stack input before sending it to the API. */
export function parseProjectStackInput(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

/** Parses stored project stack while preserving legacy plain-text stack values. */
export function parseProjectStackValue(value: string | null): string[] {
	if (!value) return [];
	const parsed = Result.try(() => JSON.parse(value))
		.map((result) => (Array.isArray(result) ? result : null))
		.unwrapOr(null);

	if (parsed) return parsed.filter((item): item is string => typeof item === "string");
	return parseProjectStackInput(value);
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
