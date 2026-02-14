import DOMPurify from "dompurify";
import { useEffect, useState } from "react";

import { MERMAID_CLASS, parseMarkdown } from "@/lib/marked-config";

interface MarkdownContentProps {
	content: string;
	className?: string;
}

const MERMAID_PATTERN = new RegExp(`<div class="${MERMAID_CLASS}">([\\s\\S]*?)</div>`, "g");

function buildMermaidError(source: string, message: string): string {
	return `
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
			<p class="font-medium text-red-400">Invalid Mermaid diagram</p>
			<p class="mt-1 text-red-400/70">${DOMPurify.sanitize(message)}</p>
			<pre class="mt-2 overflow-x-auto text-xs text-gray-400"><code>${DOMPurify.sanitize(source)}</code></pre>
		</div>
	`;
}

function sanitize(raw: string): string {
	return DOMPurify.sanitize(raw, {
		ADD_TAGS: ["div"],
		ADD_ATTR: ["class"],
	});
}

/** Parse markdown, extract mermaid blocks before sanitizing, then render. */
async function processContent(content: string): Promise<string> {
	const raw = await parseMarkdown(content);

	// Extract mermaid blocks before sanitization to preserve their raw content
	const mermaidBlocks: Map<string, string> = new Map();
	let blockIndex = 0;
	const withPlaceholders = raw.replace(MERMAID_PATTERN, (_fullMatch, source) => {
		const id = `mermaid-placeholder-${blockIndex++}`;
		mermaidBlocks.set(id, source);
		return `<div class="${id}"></div>`;
	});

	// Sanitize the HTML (mermaid content is safely out)
	const html = sanitize(withPlaceholders);

	// No mermaid — done
	if (mermaidBlocks.size === 0) return html;

	// Restore mermaid blocks and render
	const mermaid = (await import("mermaid")).default;
	mermaid.initialize({ startOnLoad: false, theme: "dark" });

	let result = html;

	let i = 0;
	for (const [id, source] of mermaidBlocks) {
		const placeholderHtml = `<div class="${id}"></div>`;

		await mermaid.parse(source).then(
			async () => {
				const { svg } = await mermaid.render(`mermaid-${Date.now()}-${i}`, source);
				result = result.replace(placeholderHtml, svg);
			},
			(err: unknown) => {
				const message = err instanceof Error ? err.message : "Unknown syntax error";
				result = result.replace(placeholderHtml, buildMermaidError(source, message));
			},
		);
		i++;
	}

	return result;
}

/** Renders markdown content as sanitized HTML with prose styling. */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
	const [html, setHtml] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setHtml(null);

		processContent(content).then((result) => {
			if (!cancelled) setHtml(result);
		});

		return () => {
			cancelled = true;
		};
	}, [content]);

	if (html === null) {
		return <p className="text-sm text-gray-400">Rendering content...</p>;
	}

	return (
		<article
			className={`prose prose-invert max-w-none ${className}`}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
