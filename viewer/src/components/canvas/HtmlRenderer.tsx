/**
 * Renders HTML content in a sandboxed iframe.
 *
 * Security: The iframe sandbox restricts the embedded content from accessing
 * the parent window's DOM, cookies, localStorage, or making requests to the
 * Minni API. Only scripts within the iframe itself are allowed to execute.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox
 */
export function HtmlRenderer({ content }: { content: string }) {
	return (
		<iframe
			srcDoc={content}
			sandbox="allow-scripts"
			className="h-full w-full flex-1 border-0"
			title="Canvas HTML Preview"
		/>
	);
}
