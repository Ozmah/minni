import { useStore } from "@tanstack/react-store";
import DOMPurify from "dompurify";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { marked } from "marked";
import { useEffect, useMemo } from "react";

import {
	canvasStore,
	currentPage,
	canNavigatePrev,
	canNavigateNext,
	pageCount,
	currentPageNumber,
	connectToCanvas,
	navigatePrev,
	navigateNext,
	deletePage,
} from "@/stores/canvas";

import { CopyButtons } from "./CopyButtons";

export function Canvas() {
	const page = useStore(currentPage);
	const hasPrev = useStore(canNavigatePrev);
	const hasNext = useStore(canNavigateNext);
	const total = useStore(pageCount);
	const current = useStore(currentPageNumber);
	const status = useStore(canvasStore, (s) => s.connectionStatus);

	useEffect(() => {
		connectToCanvas();
	}, []);

	if (total === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center text-gray-400">
				<p className="text-lg">No canvas pages yet</p>
				<p className="mt-2 text-sm">
					Use <code className="rounded bg-gray-800 px-2 py-1">minni_canvas</code> to send content
				</p>
				<p className="mt-4 text-xs text-gray-500">Status: {status}</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
				{/* Navigation */}
				<div className="flex items-center gap-2">
					<button
						onClick={navigatePrev}
						disabled={!hasPrev}
						className="rounded p-1 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
					>
						<ChevronLeft size={20} />
					</button>
					<span className="min-w-[60px] text-center text-sm text-gray-400">
						{current} / {total}
					</span>
					<button
						onClick={navigateNext}
						disabled={!hasNext}
						className="rounded p-1 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
					>
						<ChevronRight size={20} />
					</button>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2">
					<CopyButtons />
					{page && (
						<button
							onClick={() => deletePage(page.id)}
							className="ml-2 rounded border-l border-gray-600 p-1 pl-2 text-gray-400 hover:bg-red-900/50 hover:text-red-400"
							title="Delete page"
						>
							<Trash2 size={18} />
						</button>
					)}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-auto p-6">{page && <RenderedContent page={page} />}</div>

			{/* Footer */}
			{page && (
				<div className="border-t border-gray-700 px-4 py-2 text-xs text-gray-500">
					{new Date(page.timestamp).toLocaleString()}
				</div>
			)}
		</div>
	);
}

// Renders HTML from server or falls back to client-side marked
function RenderedContent({ page }: { page: { html: string; markdown: string } }) {
	const html = useMemo(() => {
		// Server rendered (Bun 1.3.8+) or client fallback
		const raw = page.html || marked.parse(page.markdown);
		return DOMPurify.sanitize(raw as string);
	}, [page.html, page.markdown]);

	return (
		<article className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
	);
}
