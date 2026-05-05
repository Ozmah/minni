import type { ReactNode } from "react";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

export type ComposerMoveDirection = "up" | "down";

export function ComposerRowActions({
	index,
	count,
	onMove,
	onDelete,
	deleteLabel,
}: {
	index: number;
	count: number;
	onMove: (direction: ComposerMoveDirection) => void;
	onDelete: () => void;
	deleteLabel: string;
}) {
	return (
		<div className="flex shrink-0 items-center gap-1">
			<button
				type="button"
				onClick={() => onMove("up")}
				disabled={index === 0}
				aria-label="Move up"
				className="inline-flex size-11 items-center justify-center rounded-md text-gray-400 outline-none hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<ArrowUp size={16} aria-hidden="true" />
			</button>
			<button
				type="button"
				onClick={() => onMove("down")}
				disabled={index === count - 1}
				aria-label="Move down"
				className="inline-flex size-11 items-center justify-center rounded-md text-gray-400 outline-none hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<ArrowDown size={16} aria-hidden="true" />
			</button>
			<button
				type="button"
				onClick={onDelete}
				aria-label={deleteLabel}
				className="inline-flex size-11 items-center justify-center rounded-md text-red-300 outline-none hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400/60"
			>
				<Trash2 size={16} aria-hidden="true" />
			</button>
		</div>
	);
}

export function ComposerCollapsibleListItem({
	expanded,
	onOpen,
	openLabel,
	collapsedTitle,
	collapsedMeta,
	collapsedExtras,
	headerActions,
	editorTitle,
	index,
	count,
	onMove,
	onDelete,
	deleteLabel,
	dragHandle,
	children,
}: {
	expanded: boolean;
	onOpen: () => void;
	openLabel: string;
	collapsedTitle: ReactNode;
	collapsedMeta?: ReactNode;
	collapsedExtras?: ReactNode;
	headerActions?: ReactNode;
	editorTitle: ReactNode;
	index: number;
	count: number;
	onMove: (direction: ComposerMoveDirection) => void;
	onDelete: () => void;
	deleteLabel: string;
	dragHandle?: ReactNode;
	children: ReactNode;
}) {
	if (!expanded) {
		return (
			<div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-1 items-center gap-3">
						{dragHandle}
						<button
							type="button"
							onClick={onOpen}
							aria-label={openLabel}
							aria-expanded={false}
							className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
						>
							<p className="truncate text-sm font-medium text-gray-200">{collapsedTitle}</p>
							{collapsedMeta && (
								<p className="mt-1 truncate text-xs text-gray-500">{collapsedMeta}</p>
							)}
						</button>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						{headerActions}
						<ComposerRowActions
							index={index}
							count={count}
							onMove={onMove}
							onDelete={onDelete}
							deleteLabel={deleteLabel}
						/>
					</div>
				</div>
				{collapsedExtras && <div className="mt-2 pl-14">{collapsedExtras}</div>}
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
			<div className="mb-3 flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					{dragHandle}
					<p className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-300">
						{editorTitle}
					</p>
				</div>
				<ComposerRowActions
					index={index}
					count={count}
					onMove={onMove}
					onDelete={onDelete}
					deleteLabel={deleteLabel}
				/>
			</div>
			{children}
		</div>
	);
}
