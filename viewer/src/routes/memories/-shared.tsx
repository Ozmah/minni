import type { QueryClient } from "@tanstack/react-query";

import {
	Blocks,
	BookOpen,
	Check,
	ChevronDown,
	CircleSlash,
	Copy,
	GitCompare,
	GitFork,
	GraduationCap,
	Hash,
	Lightbulb,
	Link2,
	type LucideIcon,
	Newspaper,
	Search,
	StickyNote,
	Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type {
	MemoryFilters,
	MemoryListItem,
	MemoryStatus,
	MemoryType,
	Permission,
	MemoriesListResponse,
} from "@/lib/memories";

import { CopyIconButton } from "@/components/ui";
import { copyText, copyWithAdapter } from "@/lib/clipboard";
import { memoryDetailToMarkdown } from "@/lib/copy-adapters/memory";

import { memoryDetailQueryOptions } from "./-queries";

export const TYPE_ICON: Record<MemoryType, LucideIcon> = {
	skill: GraduationCap,
	pattern: Blocks,
	anti_pattern: CircleSlash,
	decision: GitFork,
	insight: Lightbulb,
	comparison: GitCompare,
	note: StickyNote,
	link: Link2,
	article: Newspaper,
	video: Video,
	documentation: BookOpen,
};

export const TYPE_LABEL: Record<MemoryType, string> = {
	skill: "Skill",
	pattern: "Pattern",
	anti_pattern: "Anti-pattern",
	decision: "Decision",
	insight: "Insight",
	comparison: "Comparison",
	note: "Note",
	link: "Link",
	article: "Article",
	video: "Video",
	documentation: "Documentation",
};

export const STATUS_STYLE: Record<MemoryStatus, { label: string; color: string }> = {
	draft: { label: "Draft", color: "text-gray-500" },
	experimental: { label: "Experimental", color: "text-amber-400" },
	proven: { label: "Proven", color: "text-emerald-400" },
	battle_tested: { label: "Battle-tested", color: "text-sky-400" },
	deprecated: { label: "Deprecated", color: "text-red-400" },
};

export const PERMISSION_DOT: Record<Permission, string> = {
	open: "bg-emerald-500",
	guarded: "bg-amber-500",
	read_only: "bg-neutral-500",
	locked: "bg-red-500",
};

export const PERMISSION_LABEL: Record<Permission, string> = {
	open: "Open",
	guarded: "Guarded",
	read_only: "Read-only",
	locked: "Locked",
};

export type GroupBy = "type" | "status" | "updated";

export const INITIAL_FILTERS: MemoryFilters = {
	search: "",
	types: new Set(),
	statuses: new Set(),
	permissions: new Set(),
	onlyActive: false,
};

export function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	return (
		<div className="relative max-w-xs flex-1">
			<Search
				size={14}
				className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-500"
				aria-hidden="true"
			/>
			<input
				type="text"
				name="search"
				aria-label="Search memories"
				placeholder="Search memories"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full rounded-md bg-gray-800 py-1.5 pr-2 pl-7 text-sm text-gray-100 ring-1 ring-gray-700 ring-inset placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-1 focus:outline-emerald-500"
			/>
		</div>
	);
}

function ToggleOnlyActive({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
	return (
		<label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
			<input
				type="checkbox"
				name="onlyActive"
				checked={value}
				onChange={(e) => onChange(e.target.checked)}
				className="size-3.5 accent-emerald-500"
			/>
			Only active context
		</label>
	);
}

interface MultiFilterDropdownProps<T extends string> {
	label: string;
	options: { value: T; label: string; count?: number }[];
	selected: Set<T>;
	onToggle: (value: T) => void;
	onClear: () => void;
}

function MultiFilterDropdown<T extends string>({
	label,
	options,
	selected,
	onToggle,
	onClear,
}: MultiFilterDropdownProps<T>) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const h = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", h);
		document.addEventListener("keydown", esc);
		return () => {
			document.removeEventListener("mousedown", h);
			document.removeEventListener("keydown", esc);
		};
	}, [open]);

	const count = selected.size;

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex items-center gap-2 rounded-md bg-gray-800 px-2.5 py-1.5 text-xs text-gray-200 ring-1 ring-gray-700 ring-inset hover:bg-gray-700/60"
			>
				<span>{label}</span>
				{count > 0 && (
					<span className="rounded bg-emerald-500/20 px-1.5 text-[10px] font-medium text-emerald-300 tabular-nums">
						{count}
					</span>
				)}
				<ChevronDown size={12} className="text-gray-500" />
			</button>
			{open && (
				<div className="absolute right-0 z-40 mt-1 w-56 rounded-md border border-gray-700 bg-gray-800 p-1 shadow-xl">
					{count > 0 && (
						<button
							type="button"
							onClick={onClear}
							className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-gray-400 hover:bg-gray-700"
						>
							Clear selection
						</button>
					)}
					<ul role="list" className="max-h-64 overflow-y-auto">
						{options.map((opt) => {
							const active = selected.has(opt.value);
							return (
								<li key={opt.value}>
									<button
										type="button"
										onClick={() => onToggle(opt.value)}
										className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
									>
										<span className="flex size-4 shrink-0 items-center justify-center rounded border border-gray-600 bg-gray-900">
											{active && <Check size={12} className="text-emerald-400" />}
										</span>
										<span className="flex-1 truncate">{opt.label}</span>
										{opt.count !== undefined && (
											<span className="text-xs text-gray-500 tabular-nums">{opt.count}</span>
										)}
									</button>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
}

export function Toolbar({
	filters,
	setFilters,
	facets,
}: {
	filters: MemoryFilters;
	setFilters: React.Dispatch<React.SetStateAction<MemoryFilters>>;
	facets?: MemoriesListResponse["facets"];
}) {
	const typeOptions = (facets?.type ?? []).map((f) => ({
		value: f.value,
		label: TYPE_LABEL[f.value],
		count: f.count,
	}));
	const statusOptions = (facets?.status ?? []).map((f) => ({
		value: f.value,
		label: STATUS_STYLE[f.value].label,
		count: f.count,
	}));
	const permissionOptions = (facets?.permission ?? []).map((f) => ({
		value: f.value,
		label: PERMISSION_LABEL[f.value],
		count: f.count,
	}));

	return (
		<div className="flex flex-wrap items-center gap-2">
			<SearchInput
				value={filters.search}
				onChange={(v) => setFilters((f) => ({ ...f, search: v }))}
			/>
			<MultiFilterDropdown
				label="Type"
				options={typeOptions}
				selected={filters.types}
				onToggle={(v) =>
					setFilters((f) => {
						const next = new Set(f.types);
						if (next.has(v)) next.delete(v);
						else next.add(v);
						return { ...f, types: next };
					})
				}
				onClear={() => setFilters((f) => ({ ...f, types: new Set() }))}
			/>
			<MultiFilterDropdown
				label="Status"
				options={statusOptions}
				selected={filters.statuses}
				onToggle={(v) =>
					setFilters((f) => {
						const next = new Set(f.statuses);
						if (next.has(v)) next.delete(v);
						else next.add(v);
						return { ...f, statuses: next };
					})
				}
				onClear={() => setFilters((f) => ({ ...f, statuses: new Set() }))}
			/>
			<MultiFilterDropdown
				label="Permission"
				options={permissionOptions}
				selected={filters.permissions}
				onToggle={(v) =>
					setFilters((f) => {
						const next = new Set(f.permissions);
						if (next.has(v)) next.delete(v);
						else next.add(v);
						return { ...f, permissions: next };
					})
				}
				onClear={() => setFilters((f) => ({ ...f, permissions: new Set() }))}
			/>
			<ToggleOnlyActive
				value={filters.onlyActive}
				onChange={(v) => setFilters((f) => ({ ...f, onlyActive: v }))}
			/>
		</div>
	);
}

export function formatRelative(iso: string) {
	const diffMs = Date.now() - new Date(iso).getTime();
	const m = Math.floor(diffMs / 60_000);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 48) return `${h}h ago`;
	const d = Math.floor(h / 24);
	return `${d}d ago`;
}

export function LibraryRow({
	memory,
	hideType,
	queryClient,
}: {
	memory: MemoryListItem;
	hideType: boolean;
	queryClient: QueryClient;
}) {
	const TypeIcon = TYPE_ICON[memory.type];
	const status = STATUS_STYLE[memory.status];

	const handleCopyMarkdown = async () => {
		const detail = await queryClient.fetchQuery(memoryDetailQueryOptions(memory.id));
		await copyWithAdapter(detail, memoryDetailToMarkdown);
	};

	const handleCopyId = async () => {
		await copyText(String(memory.id));
	};

	return (
		<div className="group/row pointer-events-none relative flex items-start gap-3 py-3 pr-2 pl-3 focus-within:bg-gray-800/40 hover:bg-gray-800/40">
			<TypeIcon size={16} className="pointer-events-none relative mt-0.5 shrink-0 text-gray-400" />
			<span
				aria-label={PERMISSION_LABEL[memory.permission]}
				className={`pointer-events-none relative mt-2 size-1.5 shrink-0 rounded-full ${PERMISSION_DOT[memory.permission]}`}
			/>
			<div className="pointer-events-none relative min-w-0 flex-1">
				<div className="flex items-baseline gap-2">
					<h4 className="truncate text-sm font-medium text-gray-100">{memory.title}</h4>
					<span className={`shrink-0 text-xs ${status.color}`}>{status.label}</span>
				</div>
				<p className="mt-0.5 truncate text-xs text-gray-500">
					{!hideType && <span className="text-gray-600">{TYPE_LABEL[memory.type]}</span>}
					{!hideType && memory.tags.length > 0 && " · "}
					{memory.tags.length > 0 && memory.tags.map((t) => `#${t}`).join(" ")}
					{memory.relationCount > 0 && <> · {memory.relationCount} rel</>}
					{" · "}
					{formatRelative(memory.updatedAt)}
				</p>
			</div>
			<div className="pointer-events-auto relative flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 motion-reduce:transition-none">
				<CopyIconButton icon={Copy} label="Copy as Markdown" onCopy={handleCopyMarkdown} />
				<CopyIconButton icon={Hash} label="Copy ID" onCopy={handleCopyId} />
			</div>
		</div>
	);
}

export const TYPE_ORDER: MemoryType[] = [
	"pattern",
	"decision",
	"skill",
	"anti_pattern",
	"insight",
	"comparison",
	"note",
	"link",
	"article",
	"video",
	"documentation",
];
export const STATUS_ORDER: MemoryStatus[] = [
	"battle_tested",
	"proven",
	"experimental",
	"draft",
	"deprecated",
];

export type Group = { key: string; title: string; items: MemoryListItem[] };

function updatedBucket(iso: string): { key: string; label: string; order: number } {
	const diffDays = (Date.now() - new Date(iso).getTime()) / 86_400_000;
	if (diffDays < 1) return { key: "today", label: "Today", order: 0 };
	if (diffDays < 7) return { key: "week", label: "This week", order: 1 };
	if (diffDays < 30) return { key: "month", label: "This month", order: 2 };
	return { key: "older", label: "Older", order: 3 };
}

export function groupItems(items: MemoryListItem[], mode: GroupBy): Group[] {
	const byUpdated = (a: MemoryListItem, b: MemoryListItem) =>
		new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

	if (mode === "type") {
		const map = new Map<MemoryType, MemoryListItem[]>();
		for (const memory of items) {
			const entries = map.get(memory.type) ?? [];
			entries.push(memory);
			map.set(memory.type, entries);
		}
		return TYPE_ORDER.filter((type) => map.has(type)).map((type) => ({
			key: type,
			title: TYPE_LABEL[type],
			items: (map.get(type) ?? []).sort(byUpdated),
		}));
	}

	if (mode === "status") {
		const map = new Map<MemoryStatus, MemoryListItem[]>();
		for (const memory of items) {
			const entries = map.get(memory.status) ?? [];
			entries.push(memory);
			map.set(memory.status, entries);
		}
		return STATUS_ORDER.filter((status) => map.has(status)).map((status) => ({
			key: status,
			title: STATUS_STYLE[status].label,
			items: (map.get(status) ?? []).sort(byUpdated),
		}));
	}

	const buckets = new Map<string, { label: string; order: number; items: MemoryListItem[] }>();
	for (const memory of items) {
		const bucket = updatedBucket(memory.updatedAt);
		const slot = buckets.get(bucket.key) ?? { label: bucket.label, order: bucket.order, items: [] };
		slot.items.push(memory);
		buckets.set(bucket.key, slot);
	}

	return [...buckets.entries()]
		.sort((a, b) => a[1].order - b[1].order)
		.map(([key, value]) => ({ key, title: value.label, items: value.items.sort(byUpdated) }));
}

export function SegmentedGroupBy({
	value,
	onChange,
}: {
	value: GroupBy;
	onChange: (v: GroupBy) => void;
}) {
	const options: { value: GroupBy; label: string }[] = [
		{ value: "type", label: "Type" },
		{ value: "status", label: "Status" },
		{ value: "updated", label: "Updated" },
	];

	return (
		<div
			role="radiogroup"
			aria-label="Group by"
			className="inline-flex items-center gap-0.5 rounded-md bg-gray-800 p-0.5 ring-1 ring-gray-700 ring-inset"
		>
			{options.map((opt) => {
				const active = value === opt.value;
				return (
					<button
						key={opt.value}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onChange(opt.value)}
						className={`rounded px-3 py-1 text-xs font-medium transition-colors ${active ? "bg-gray-700 text-gray-100 shadow-sm" : "text-gray-400 hover:text-gray-200"}`}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
