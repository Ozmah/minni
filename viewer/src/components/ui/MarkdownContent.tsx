import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

interface MarkdownContentProps {
	content: string;
	className?: string;
}

/** Renders markdown content as sanitized HTML with prose styling. */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
	const html = useMemo(() => {
		const raw = marked.parse(content);
		return DOMPurify.sanitize(raw as string);
	}, [content]);

	return (
		<article
			className={`prose prose-invert max-w-none ${className}`}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
