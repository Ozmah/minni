import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { ChevronLeft, ChevronRight, Globe, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { MarkdownContent } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { canvasStore, navigateNext, navigatePrev, navigateTo } from "@/stores/canvas";

import { CopyButtons } from "./CopyButtons";
import { HtmlRenderer } from "./HtmlRenderer";

export function Canvas() {
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ["canvas"],
		queryFn: () => api.api.canvas.pages.get().then(unwrap),
	});

	const pages = data?.pages ?? [];
	const currentIndex = useStore(canvasStore, (s) => s.currentIndex);

	// Clamp index when pages shrink (e.g. deletion)
	const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, pages.length - 1));
	const currentPage = pages[safeIndex] ?? null;
	const canGoPrev = safeIndex > 0;
	const canGoNext = safeIndex < pages.length - 1;

	// Auto-navigate to newest page on first load and when new pages arrive
	const prevLength = useRef(0);
	useEffect(() => {
		if (pages.length > prevLength.current && pages.length > 0) {
			navigateTo(0);
		}
		prevLength.current = pages.length;
	}, [pages.length]);

	// Sync clamped index back to store after deletion
	useEffect(() => {
		if (safeIndex !== currentIndex) {
			navigateTo(safeIndex);
		}
	}, [safeIndex, currentIndex]);

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.api.canvas({ id }).delete(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["canvas"] });
		},
	});

	if (pages.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center text-gray-400">
				<p className="text-lg">No canvas pages yet</p>
				<p className="mt-2 text-sm">
					Use <code className="rounded bg-gray-800 px-2 py-1">minni_canvas</code> to send content
				</p>
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
						disabled={!canGoPrev}
						className="rounded p-1 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
					>
						<ChevronLeft size={20} />
					</button>
					<span className="min-w-15 text-center text-sm text-gray-400">
						{safeIndex + 1} / {pages.length}
					</span>
					<button
						onClick={() => navigateNext(pages.length)}
						disabled={!canGoNext}
						className="rounded p-1 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
					>
						<ChevronRight size={20} />
					</button>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-2">
					<CopyButtons page={currentPage} />
					{currentPage && (
						<button
							onClick={() => deleteMutation.mutate(currentPage.id)}
							className="ml-2 rounded border-l border-gray-600 p-1 pl-2 text-gray-400 hover:bg-red-900/50 hover:text-red-400"
							title="Delete page"
						>
							<Trash2 size={18} />
						</button>
					)}
				</div>
			</div>

			{/* Content */}
			{currentPage?.type === "html" ? (
				<HtmlRenderer content={currentPage.content} />
			) : (
				<div className="flex-1 overflow-auto p-6">
					{currentPage && <MarkdownContent content={currentPage.content} />}
				</div>
			)}

			{/* Footer */}
			{currentPage && (
				<div className="flex items-center gap-2 border-t border-gray-700 px-4 py-4 text-xs text-gray-500">
					{currentPage.type === "html" && <Globe size={12} className="text-blue-400" />}
					<span>{currentPage.type === "html" ? "HTML" : "Markdown"}</span>
					<span>&middot;</span>
					<span>{new Date(currentPage.createdAt).toLocaleString()}</span>
				</div>
			)}
		</div>
	);
}
