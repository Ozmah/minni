import { useStore } from "@tanstack/react-store";
import { ClipboardCopy, FileText, Code } from "lucide-react";
import { marked } from "marked";
import { useState } from "react";

import { currentPage } from "@/stores/canvas";

type CopyType = "markdown" | "text" | "html";

export function CopyButtons() {
	const page = useStore(currentPage);
	const [copied, setCopied] = useState<CopyType | null>(null);

	const copy = async (type: CopyType) => {
		if (!page) return;

		let content: string;
		switch (type) {
			case "markdown":
				content = page.markdown;
				break;
			case "html":
				content = page.html || (marked.parse(page.markdown) as string);
				break;
			case "text":
				content = stripMarkdown(page.markdown);
				break;
		}

		await navigator.clipboard.writeText(content);
		setCopied(type);
		setTimeout(() => setCopied(null), 1500);
	};

	if (!page) return null;

	return (
		<div className="flex items-center gap-1">
			<CopyButton
				onClick={() => copy("markdown")}
				active={copied === "markdown"}
				title="Copy Markdown"
				icon={<ClipboardCopy size={16} />}
			/>
			<CopyButton
				onClick={() => copy("text")}
				active={copied === "text"}
				title="Copy Plain Text"
				icon={<FileText size={16} />}
			/>
			<CopyButton
				onClick={() => copy("html")}
				active={copied === "html"}
				title="Copy HTML"
				icon={<Code size={16} />}
			/>
		</div>
	);
}

function CopyButton({
	onClick,
	active,
	title,
	icon,
}: {
	onClick: () => void;
	active: boolean;
	title: string;
	icon: React.ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			title={title}
			className={`rounded p-1.5 transition-colors ${
				active
					? "bg-green-900/50 text-green-400"
					: "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
			}`}
		>
			{active ? "✓" : icon}
		</button>
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
