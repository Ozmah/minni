/**
 * Discriminated union for type-safe error handling.
 * Eliminates try/catch scattered throughout the codebase.
 *
 * @example
 * const result = await tryAsync(() => fetch(url));
 * if (!result.ok) return result.error;
 * const data = result.value;
 */
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

/** Creates a successful result */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** Creates a failed result */
export const err = <E = string>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Wraps an async operation in a Result.
 * Converts thrown errors to Result.error.
 *
 * @example
 * const result = await tryAsync(() => fetch('/api/data').then(r => r.json()));
 * if (!result.ok) return `Failed: ${result.error}`;
 * return result.value;
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
	try {
		const value = await fn();
		return ok(value);
	} catch (e) {
		return err(e instanceof Error ? e.message : String(e));
	}
}

/**
 * Wraps a sync operation in a Result.
 *
 * @example
 * const result = trySync(() => JSON.parse(maybeInvalidJson));
 */
export function trySync<T>(fn: () => T): Result<T> {
	try {
		const value = fn();
		return ok(value);
	} catch (e) {
		return err(e instanceof Error ? e.message : String(e));
	}
}

/**
 * Maps a successful Result value to a new value.
 *
 * @example
 * const result = await tryAsync(() => fetch(url));
 * const mapped = map(result, response => response.status);
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
	if (!result.ok) return result;
	return ok(fn(result.value));
}

/**
 * Chains Result-returning operations.
 *
 * @example
 * const result = await tryAsync(() => fetch(url));
 * const chained = await flatMap(result, async (r) => tryAsync(() => r.json()));
 */
export async function flatMap<T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => Promise<Result<U, E>>,
): Promise<Result<U, E>> {
	if (!result.ok) return result;
	return fn(result.value);
}

/**
 * Unwraps a Result, throwing if it's an error.
 * Most likely won't be used
 */
export function unwrap<T>(result: Result<T>): T {
	if (!result.ok) throw new Error(result.error);
	return result.value;
}

/**
 * Unwraps a Result with a default value for errors.
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
	if (!result.ok) return defaultValue;
	return result.value;
}
