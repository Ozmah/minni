export type ClipboardAdapter<T> = (value: T) => string | Promise<string>;

export async function copyText(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}

export async function copyWithAdapter<T>(value: T, adapter: ClipboardAdapter<T>): Promise<void> {
	const content = await adapter(value);
	await copyText(content);
}
