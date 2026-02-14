import { marked } from "marked";
import markedShiki from "marked-shiki";
import { createHighlighter } from "shiki/bundle/web";

const MERMAID_CLASS = "mermaid-diagram";

/** Shiki highlighter (lazy singleton) */
let highlighterReady: ReturnType<typeof createHighlighter> | null = null;

function getHighlighter() {
	if (!highlighterReady) {
		highlighterReady = createHighlighter({
			themes: ["github-dark"],
			langs: [
				"typescript",
				"javascript",
				"bash",
				"json",
				"html",
				"css",
				"sql",
				"yaml",
				"tsx",
				"jsx",
			],
		});
	}
	return highlighterReady;
}

/** Initialize marked with all extensions. Call once at app startup. */
export async function initMarked(): Promise<void> {
	const highlighter = await getHighlighter();
	const loadedLangs = new Set(highlighter.getLoadedLanguages());

	// Mermaid is handled inside highlight — marked-shiki's walkTokens converts
	// code tokens to html tokens, so a separate renderer.code never fires.
	marked.use(
		markedShiki({
			highlight(code, lang) {
				if (lang === "mermaid") {
					return `<div class="${MERMAID_CLASS}">${code}</div>`;
				}
				const resolved = lang && loadedLangs.has(lang) ? lang : "text";
				return highlighter.codeToHtml(code, {
					lang: resolved,
					theme: "github-dark",
				});
			},
		}),
	);
}

/** Parse markdown with all extensions applied. */
export async function parseMarkdown(content: string): Promise<string> {
	return marked.parse(content);
}

export { MERMAID_CLASS };
