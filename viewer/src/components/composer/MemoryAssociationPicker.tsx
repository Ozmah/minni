import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Drawer } from "@/components/Drawer";
import { MarkdownContent } from "@/components/ui/renderers/MarkdownContent";

import type { Memory } from "../../../../src/schema";

type MemoryOption = Pick<
	Memory,
	"id" | "title" | "content" | "type" | "status" | "permission" | "updatedAt"
>;

export function MemoryAssociationPicker({
	open,
	onClose,
	scopeLabel,
	memories,
	selectedMemoryIds,
	onApply,
}: {
	open: boolean;
	onClose: () => void;
	scopeLabel: string;
	memories: MemoryOption[];
	selectedMemoryIds: number[];
	onApply: (memoryIds: number[]) => void;
}) {
	const [query, setQuery] = useState("");
	const [draftIds, setDraftIds] = useState<number[]>(selectedMemoryIds);
	const [previewId, setPreviewId] = useState<number | null>(selectedMemoryIds[0] ?? null);
	const [selectedOnly, setSelectedOnly] = useState(false);

	useEffect(() => {
		if (!open) return;
		setDraftIds(selectedMemoryIds);
		setPreviewId(selectedMemoryIds[0] ?? memories[0]?.id ?? null);
		setQuery("");
		setSelectedOnly(false);
	}, [memories, open, selectedMemoryIds]);

	const draftIdSet = useMemo(() => new Set(draftIds), [draftIds]);
	const filteredMemories = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		const scopedMemories = selectedOnly
			? memories.filter((memory) => draftIdSet.has(memory.id))
			: memories;
		if (!normalizedQuery) return scopedMemories;

		return scopedMemories.filter((memory) => {
			return [memory.title, memory.content, memory.type, memory.status, memory.permission]
				.join("\n")
				.toLowerCase()
				.includes(normalizedQuery);
		});
	}, [draftIdSet, memories, query, selectedOnly]);
	const memoryGroups = useMemo(() => groupMemoriesByType(filteredMemories), [filteredMemories]);

	const previewMemory =
		memories.find((memory) => memory.id === previewId) ?? filteredMemories[0] ?? null;

	function toggleMemory(memoryId: number) {
		setDraftIds((current) => {
			const next = current.includes(memoryId)
				? current.filter((id) => id !== memoryId)
				: [...current, memoryId];
			onApply(next);
			return next;
		});
	}

	function scrollToType(type: string) {
		document.getElementById(memoryTypeSectionId(type))?.scrollIntoView({ block: "start" });
	}

	return (
		<Drawer open={open} onClose={onClose} title={`Attach memories to ${scopeLabel}`}>
			<div className="space-y-4">
				<div className="flex flex-col gap-2 md:flex-row">
					<div className="relative min-w-0 flex-1">
						<Search
							size={16}
							className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-500"
							aria-hidden="true"
						/>
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search by title, content, type, status, or permission"
							className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 pr-3 pl-9 text-base text-white outline-none focus:border-gray-500"
						/>
					</div>
					<button
						type="button"
						aria-pressed={selectedOnly}
						onClick={() => setSelectedOnly((current) => !current)}
						className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
							selectedOnly
								? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
								: "border-gray-700 bg-gray-950 text-gray-300 hover:bg-gray-800"
						}`}
					>
						Selected only
						<span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400 tabular-nums">
							{draftIds.length}
						</span>
					</button>
				</div>

				{memoryGroups.length > 1 && (
					<div className="flex gap-2 overflow-x-auto pb-1">
						{memoryGroups.map((group) => (
							<button
								key={group.type}
								type="button"
								onClick={() => scrollToType(group.type)}
								className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-gray-800 bg-gray-950 px-3 text-xs text-gray-300 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
							>
								<span className="font-medium capitalize">{group.type}</span>
								<span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-gray-400 tabular-nums">
									{group.memories.length}
								</span>
							</button>
						))}
					</div>
				)}

				<div className="grid min-h-[32rem] gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
					<div className="min-h-0 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950/40 p-2">
						{filteredMemories.length === 0 ? (
							<p className="p-4 text-sm text-gray-500">No memories match this search.</p>
						) : (
							<div className="space-y-4">
								{memoryGroups.map((group) => (
									<section
										key={group.type}
										id={memoryTypeSectionId(group.type)}
										className="scroll-mt-2"
									>
										<div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/95 px-2 py-2 backdrop-blur">
											<p className="text-xs font-semibold tracking-wide text-gray-300 uppercase">
												{group.type}
											</p>
											<span className="text-xs text-gray-600 tabular-nums">
												{group.memories.length} memories
											</span>
										</div>

										<div className="space-y-2">
											{group.memories.map((memory) => {
												const selected = draftIdSet.has(memory.id);
												const previewing = previewMemory?.id === memory.id;
												return (
													<MemoryResultCard
														key={memory.id}
														memory={memory}
														previewing={previewing}
														selected={selected}
														onPreview={() => setPreviewId(memory.id)}
														onToggle={() => toggleMemory(memory.id)}
													/>
												);
											})}
										</div>
									</section>
								))}
							</div>
						)}
					</div>

					<div className="min-h-0 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-5">
						{previewMemory ? (
							<div>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="text-sm font-medium text-emerald-300">
											Memory M{previewMemory.id}
										</p>
										<h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
											{previewMemory.title}
										</h3>
										<div className="mt-3 flex flex-wrap gap-2">
											<MemoryBadge label="Type" value={previewMemory.type} />
											<MemoryBadge label="Status" value={previewMemory.status} />
											<MemoryBadge label="Permission" value={previewMemory.permission} />
											<MemoryBadge
												label="Updated"
												value={formatUpdatedAt(previewMemory.updatedAt)}
											/>
										</div>
									</div>
								</div>

								<div className="mt-5 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
									<MarkdownContent content={previewMemory.content} />
								</div>
							</div>
						) : (
							<p className="text-sm text-gray-500">Select a memory to preview it.</p>
						)}
					</div>
				</div>
			</div>
		</Drawer>
	);
}

function MemoryResultCard({
	memory,
	previewing,
	selected,
	onPreview,
	onToggle,
}: {
	memory: MemoryOption;
	previewing: boolean;
	selected: boolean;
	onPreview: () => void;
	onToggle: () => void;
}) {
	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onPreview}
			onDoubleClick={onToggle}
			onKeyDown={(event) => {
				if (event.key === "Enter") onPreview();
				if (event.key === " ") {
					event.preventDefault();
					onToggle();
				}
			}}
			className={`group w-full rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 motion-reduce:transition-none ${
				previewing
					? "border-emerald-500/40 bg-emerald-500/10"
					: "border-gray-800 bg-gray-900/40 hover:bg-gray-800/80"
			}`}
		>
			<div className="flex items-start gap-3">
				<div
					className={`mt-0.5 flex h-9 w-12 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold ${
						selected
							? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
							: "border-gray-700 bg-gray-950 text-gray-400"
					}`}
				>
					M{memory.id}
				</div>

				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-3">
						<p className="line-clamp-2 text-sm leading-5 font-medium text-gray-100">
							{memory.title}
						</p>
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								onToggle();
							}}
							aria-label={`${selected ? "Detach" : "Attach"} memory M${memory.id}`}
							className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${
								selected
									? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
									: "border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-300"
							}`}
						>
							{selected && <Check size={14} aria-hidden="true" />}
						</button>
					</div>

					<div className="mt-2 flex flex-wrap gap-1.5">
						<MemoryPill value={memory.type} tone="type" />
						<MemoryPill value={memory.status} tone="status" />
						<MemoryPill value={memory.permission} tone="permission" />
					</div>

					<p className="mt-3 line-clamp-3 text-sm leading-5 text-gray-500 group-hover:text-gray-400">
						{toPlainExcerpt(memory.content)}
					</p>
				</div>
			</div>
		</div>
	);
}

function MemoryPill({ value, tone }: { value: string; tone: "type" | "status" | "permission" }) {
	const toneClass =
		tone === "type"
			? "border-sky-500/20 bg-sky-500/10 text-sky-200"
			: tone === "status"
				? "border-violet-500/20 bg-violet-500/10 text-violet-200"
				: "border-gray-700 bg-gray-950 text-gray-300";

	return <span className={`rounded px-1.5 py-0.5 text-xs ${toneClass}`}>{value}</span>;
}

function MemoryBadge({ label, value }: { label: string; value: string }) {
	return (
		<span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900 px-2.5 text-xs text-gray-300">
			<span className="text-gray-500">{label}</span>
			<span className="font-medium">{value}</span>
		</span>
	);
}

function toPlainExcerpt(content: string) {
	return content
		.replace(/```[\s\S]*?```/g, " code block ")
		.replace(/[#>*_`\-[\]()]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function formatUpdatedAt(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "unknown";
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupMemoriesByType(memories: MemoryOption[]) {
	const groups = new Map<string, MemoryOption[]>();
	for (const memory of memories) {
		const current = groups.get(memory.type) ?? [];
		current.push(memory);
		groups.set(memory.type, current);
	}

	return [...groups.entries()]
		.sort(([typeA], [typeB]) => typeA.localeCompare(typeB))
		.map(([type, groupMemories]) => ({ type, memories: groupMemories }));
}

function memoryTypeSectionId(type: string) {
	return `memory-type-${type.replace(/[^a-z0-9_-]/gi, "-")}`;
}
