import { ClipboardCopy, FileText, Code } from "lucide-react";

import { CopyIconButton } from "@/components/ui";
import { copyWithAdapter } from "@/lib/clipboard";
import { parseMarkdown } from "@/lib/marked-config";

import type { CanvasPage } from "../../../../src/schema";

type CopyType = "markdown" | "text" | "html";

export function CopyButtons({ page }: { page: CanvasPage | null }) {
	const copy = async (type: CopyType) => {
		if (!page) return;

		await copyWithAdapter(page, async (currentPage) => {
			if (currentPage.type === "html") return currentPage.content;

			switch (type) {
				case "markdown":
					return currentPage.content;
				case "html":
					return parseMarkdown(currentPage.content);
				case "text":
					return stripMarkdown(currentPage.content);
			}
		});
	};

	if (!page) return null;

	return (
		<div className="flex items-center gap-1">
			<CopyIconButton
				icon={ClipboardCopy}
				label="Copy Markdown"
				onCopy={() => copy("markdown")}
				iconSize={16}
			/>
			<CopyIconButton
				icon={FileText}
				label="Copy Plain Text"
				onCopy={() => copy("text")}
				iconSize={16}
			/>
			<CopyIconButton icon={Code} label="Copy HTML" onCopy={() => copy("html")} iconSize={16} />
		</div>
	);
}

function stripMarkdown(md: string): string {
	return md
		.replace(/#{1,6}\s?/g, "")
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/\*(.+?)\*/g, "$1")
		.replace(/`{3}[\s\S]*?`{3}/g, "")
		.replace(/`(.+?)`/g, "$1")
		.replace(/\[(.+?)\]\(.+?\)/g, "$1")
		.replace(/^\s*[-*+]\s/gm, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
