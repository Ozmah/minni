import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	CheckCircle2,
	Cog,
	LinkIcon,
	Plus,
	Save,
	Shield,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api, unwrap } from "@/lib/api";
import {
	buildDraftPreview,
	createComposerDraft,
	createEmptyPrinciple,
	moveItem,
	type DevModeComposerDraft,
	type DevModeMemorySummary,
	type EnrichedDevMode,
	type PrincipleDraft,
} from "@/lib/dev-modes";

import type { Memory, Permission, RuleSeverity } from "../../../src/schema";

export const Route = createFileRoute("/composer/dev-modes/$id")({
	component: DevModeComposer,
});

const PERMISSIONS: Permission[] = ["open", "guarded", "read_only", "locked"];
const SEVERITIES: RuleSeverity[] = ["critical", "strong", "default"];

function DevModeComposer() {
	const { id } = Route.useParams();
	const numericId = Number(id);
	const qc = useQueryClient();
	const [draft, setDraft] = useState<DevModeComposerDraft | null>(null);
	const [loadedId, setLoadedId] = useState<number | null>(null);
	const [memoryQuery, setMemoryQuery] = useState("");
	const [selectedMemoryId, setSelectedMemoryId] = useState("");

	const { data, isLoading, error } = useQuery({
		queryKey: ["dev-mode", String(numericId), "enriched"],
		queryFn: () =>
			api.api["dev-modes"]({ id: numericId })
				.enriched.get()
				.then(unwrap)
				.then((value) => value as EnrichedDevMode),
		refetchOnWindowFocus: false,
	});

	const { data: availableMemories } = useQuery({
		queryKey: ["memories", "composer-options"],
		queryFn: () => api.api.memories.get({ query: { limit: 100 } }).then(unwrap),
		refetchOnWindowFocus: false,
	});

	useEffect(() => {
		if (!data) return;
		if (loadedId === data.devMode.id) return;
		setDraft(createComposerDraft(data));
		setLoadedId(data.devMode.id);
	}, [data, loadedId]);

	const saveMutation = useMutation({
		mutationFn: async (nextDraft: DevModeComposerDraft) => {
			const composition = {
				name: nextDraft.name.trim(),
				description: nextDraft.description.trim(),
				permission: nextDraft.permission,
				memoryIds: nextDraft.memoryIds,
				principles: nextDraft.principles
					.filter((principle) => principle.statement.trim())
					.map((principle) => ({
						id: principle.id,
						statement: principle.statement.trim(),
						rationale: principle.rationale.trim() || null,
						severity: principle.severity,
						permission: principle.permission,
						example: principle.example.trim() || null,
					})),
			};

			return api.api["dev-modes"]({ id: numericId }).composition.put(composition).then(unwrap);
		},
		onSuccess: async (updated) => {
			const enriched = updated as EnrichedDevMode;
			setDraft(createComposerDraft(enriched));
			setLoadedId(enriched.devMode.id);
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["dev-mode", String(numericId)] }),
				qc.invalidateQueries({ queryKey: ["dev-modes"] }),
				qc.invalidateQueries({ queryKey: ["hud"] }),
			]);
		},
	});

	const activateMutation = useMutation({
		mutationFn: () => api.api["dev-modes"]({ id: numericId }).activate.post().then(unwrap),
		onSuccess: async () => {
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["dev-mode", String(numericId)] }),
				qc.invalidateQueries({ queryKey: ["dev-modes"] }),
				qc.invalidateQueries({ queryKey: ["hud"] }),
			]);
		},
	});

	const memoryLookup = useMemo(() => {
		const map = new Map<number, Memory | DevModeMemorySummary>();
		for (const memory of data?.memories ?? []) map.set(memory.id, memory);
		for (const memory of availableMemories ?? []) map.set(memory.id, memory);
		return map;
	}, [availableMemories, data?.memories]);

	const selectedMemoryIds = useMemo(() => new Set(draft?.memoryIds ?? []), [draft?.memoryIds]);
	const attachableMemories = useMemo(() => {
		const query = memoryQuery.trim().toLowerCase();
		return (availableMemories ?? []).filter((memory) => {
			if (selectedMemoryIds.has(memory.id)) return false;
			if (!query) return true;
			return (
				memory.title.toLowerCase().includes(query) || memory.type.toLowerCase().includes(query)
			);
		});
	}, [availableMemories, memoryQuery, selectedMemoryIds]);

	const baseline = data ? createComposerDraft(data) : null;
	const isDirty = draft && baseline ? JSON.stringify(draft) !== JSON.stringify(baseline) : false;
	const preview = draft ? buildDraftPreview(draft) : data?.injectionPreview;
	const canSave = Boolean(draft?.name.trim()) && !saveMutation.isPending;

	if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading composer...</div>;
	if (error) return <div className="p-6 text-sm text-red-400">Failed to load dev mode.</div>;
	if (!data || !draft) return <div className="p-6 text-sm text-gray-400">Dev mode not found.</div>;
	const enrichedDevMode = data;

	function updateDraft(mutator: (current: DevModeComposerDraft) => DevModeComposerDraft) {
		setDraft((current) => (current ? mutator(current) : current));
	}

	function addSelectedMemory() {
		const memoryId = Number(selectedMemoryId);
		if (!memoryId || selectedMemoryIds.has(memoryId)) return;
		updateDraft((current) => ({ ...current, memoryIds: [...current.memoryIds, memoryId] }));
		setSelectedMemoryId("");
	}

	function resetDraft() {
		setDraft(createComposerDraft(enrichedDevMode));
		setMemoryQuery("");
		setSelectedMemoryId("");
	}

	return (
		<form
			className="min-h-screen bg-gray-900"
			onSubmit={(event) => {
				event.preventDefault();
				if (canSave) saveMutation.mutate(draft);
			}}
		>
			<header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/95 px-6 py-4 backdrop-blur">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="min-w-0">
						<Link
							to="/composer"
							className="mb-2 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300"
						>
							<ArrowLeft size={14} aria-hidden="true" />
							Composer
						</Link>
						<div className="flex items-center gap-3">
							<div className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-300">
								<Cog size={20} aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<h2 className="truncate text-2xl font-semibold tracking-tight text-white">
									{draft.name || data.devMode.name}
								</h2>
								<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
									<span>Dev Mode</span>
									<span>·</span>
									<span>{draft.permission}</span>
									{data.isActive && (
										<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
											<CheckCircle2 size={12} aria-hidden="true" /> Active
										</span>
									)}
									{isDirty && <span className="text-amber-300">Unsaved changes</span>}
								</div>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => activateMutation.mutate()}
							disabled={data.isActive || activateMutation.isPending}
							className="min-h-10 rounded-md border border-gray-700 px-3 text-sm text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{data.isActive ? "Active" : "Activate"}
						</button>
						<button
							type="button"
							onClick={resetDraft}
							disabled={!isDirty || saveMutation.isPending}
							className="min-h-10 rounded-md border border-gray-700 px-3 text-sm text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Reset
						</button>
						<button
							type="submit"
							disabled={!canSave}
							className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-gray-950 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<Save size={16} aria-hidden="true" />
							{saveMutation.isPending ? "Saving..." : "Save"}
						</button>
					</div>
				</div>
			</header>

			<main className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
				<div className="space-y-6">
					<Panel title="Identity" description="The metadata that names and guards this dev mode.">
						<div className="grid gap-4 md:grid-cols-2">
							<label className="block md:col-span-2">
								<span className="mb-1 block text-sm font-medium text-gray-300">Name</span>
								<input
									value={draft.name}
									onChange={(event) =>
										updateDraft((current) => ({ ...current, name: event.target.value }))
									}
									className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
									required
								/>
							</label>

							<label className="block md:col-span-2">
								<span className="mb-1 block text-sm font-medium text-gray-300">Description</span>
								<textarea
									value={draft.description}
									onChange={(event) =>
										updateDraft((current) => ({ ...current, description: event.target.value }))
									}
									rows={4}
									className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-base text-white outline-none focus:border-gray-500"
								/>
							</label>

							<label className="block">
								<span className="mb-1 block text-sm font-medium text-gray-300">Permission</span>
								<select
									value={draft.permission}
									onChange={(event) =>
										updateDraft((current) => ({
											...current,
											permission: event.target.value as Permission,
										}))
									}
									className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
								>
									{PERMISSIONS.map((permission) => (
										<option key={permission} value={permission}>
											{permission}
										</option>
									))}
								</select>
							</label>
						</div>
					</Panel>

					<Panel
						title="Principles"
						description="Behavioral rules injected with this dev mode. Empty principles are ignored on save."
						action={
							<button
								type="button"
								onClick={() =>
									updateDraft((current) => ({
										...current,
										principles: [...current.principles, createEmptyPrinciple()],
									}))
								}
								className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-300 hover:bg-gray-800"
							>
								<Plus size={16} aria-hidden="true" /> Principle
							</button>
						}
					>
						{draft.principles.length === 0 ? (
							<p className="rounded-md border border-dashed border-gray-700 p-4 text-sm text-gray-500">
								No principles yet. Add one to define this dev mode's posture.
							</p>
						) : (
							<div className="space-y-3">
								{draft.principles.map((principle, index) => (
									<PrincipleEditor
										key={principle.clientKey}
										principle={principle}
										index={index}
										count={draft.principles.length}
										onChange={(next) =>
											updateDraft((current) => ({
												...current,
												principles: current.principles.map((item) =>
													item.clientKey === principle.clientKey ? next : item,
												),
											}))
										}
										onMove={(direction) =>
											updateDraft((current) => ({
												...current,
												principles: moveItem(
													current.principles,
													index,
													direction === "up" ? index - 1 : index + 1,
												),
											}))
										}
										onDelete={() =>
											updateDraft((current) => ({
												...current,
												principles: current.principles.filter(
													(item) => item.clientKey !== principle.clientKey,
												),
											}))
										}
									/>
								))}
							</div>
						)}
					</Panel>

					<Panel
						title="Associated memories"
						description="V1 only attaches existing memories. Create or edit memory content from Memories."
					>
						<div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
							<input
								value={memoryQuery}
								onChange={(event) => setMemoryQuery(event.target.value)}
								placeholder="Filter existing memories"
								className="min-h-11 rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
							/>
							<select
								value={selectedMemoryId}
								onChange={(event) => setSelectedMemoryId(event.target.value)}
								className="min-h-11 rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
							>
								<option value="">Select memory...</option>
								{attachableMemories.map((memory) => (
									<option key={memory.id} value={memory.id}>
										[M{memory.id}] {memory.title}
									</option>
								))}
							</select>
							<button
								type="button"
								onClick={addSelectedMemory}
								disabled={!selectedMemoryId}
								className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<LinkIcon size={16} aria-hidden="true" /> Attach
							</button>
						</div>

						{draft.memoryIds.length === 0 ? (
							<p className="rounded-md border border-dashed border-gray-700 p-4 text-sm text-gray-500">
								No memories associated with this dev mode.
							</p>
						) : (
							<div className="space-y-2">
								{draft.memoryIds.map((memoryId, index) => {
									const memory = memoryLookup.get(memoryId);
									return (
										<MemoryRow
											key={memoryId}
											memoryId={memoryId}
											memory={memory}
											index={index}
											count={draft.memoryIds.length}
											onMove={(direction) =>
												updateDraft((current) => ({
													...current,
													memoryIds: moveItem(
														current.memoryIds,
														index,
														direction === "up" ? index - 1 : index + 1,
													),
												}))
											}
											onDelete={() =>
												updateDraft((current) => ({
													...current,
													memoryIds: current.memoryIds.filter((id) => id !== memoryId),
												}))
											}
										/>
									);
								})}
							</div>
						)}
					</Panel>
				</div>

				<aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
					<Panel
						title="Injection preview"
						description="Approximation of what equip will inject for this dev mode."
					>
						<pre className="max-h-[460px] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm leading-6 whitespace-pre-wrap text-gray-300">
							{preview}
						</pre>
					</Panel>

					<Panel title="Summary">
						<div className="grid grid-cols-2 gap-3 text-sm">
							<SummaryItem
								label="Principles"
								value={draft.principles.filter((p) => p.statement.trim()).length}
							/>
							<SummaryItem label="Memories" value={draft.memoryIds.length} />
							<SummaryItem label="Permission" value={draft.permission} />
							<SummaryItem label="State" value={isDirty ? "dirty" : "clean"} />
						</div>
						{saveMutation.error && (
							<p className="mt-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
								{saveMutation.error instanceof Error ? saveMutation.error.message : "Save failed"}
							</p>
						)}
					</Panel>
				</aside>
			</main>
		</form>
	);
}

function Panel({
	title,
	description,
	action,
	children,
}: {
	title: string;
	description?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-xl border border-gray-800 bg-gray-900/70 p-5 shadow-sm">
			<div className="mb-4 flex items-start justify-between gap-4">
				<div>
					<h3 className="font-medium text-white">{title}</h3>
					{description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
				</div>
				{action}
			</div>
			{children}
		</section>
	);
}

function PrincipleEditor({
	principle,
	index,
	count,
	onChange,
	onMove,
	onDelete,
}: {
	principle: PrincipleDraft;
	index: number;
	count: number;
	onChange: (principle: PrincipleDraft) => void;
	onMove: (direction: "up" | "down") => void;
	onDelete: () => void;
}) {
	return (
		<div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="text-sm font-medium text-gray-300">Principle {index + 1}</p>
				<RowActions
					index={index}
					count={count}
					onMove={onMove}
					onDelete={onDelete}
					deleteLabel="Delete principle"
				/>
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<label className="block md:col-span-2">
					<span className="mb-1 block text-sm text-gray-400">Statement</span>
					<input
						value={principle.statement}
						onChange={(event) => onChange({ ...principle, statement: event.target.value })}
						className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
						placeholder="Fight structural dishonesty before polishing abstractions."
					/>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm text-gray-400">Severity</span>
					<select
						value={principle.severity}
						onChange={(event) =>
							onChange({ ...principle, severity: event.target.value as RuleSeverity })
						}
						className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
					>
						{SEVERITIES.map((severity) => (
							<option key={severity} value={severity}>
								{severity}
							</option>
						))}
					</select>
				</label>

				<label className="block">
					<span className="mb-1 block text-sm text-gray-400">Permission</span>
					<select
						value={principle.permission}
						onChange={(event) =>
							onChange({ ...principle, permission: event.target.value as Permission })
						}
						className="min-h-11 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-base text-white outline-none focus:border-gray-500"
					>
						{PERMISSIONS.map((permission) => (
							<option key={permission} value={permission}>
								{permission}
							</option>
						))}
					</select>
				</label>

				<label className="block md:col-span-2">
					<span className="mb-1 block text-sm text-gray-400">Rationale</span>
					<textarea
						value={principle.rationale}
						onChange={(event) => onChange({ ...principle, rationale: event.target.value })}
						rows={2}
						className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-base text-white outline-none focus:border-gray-500"
					/>
				</label>

				<label className="block md:col-span-2">
					<span className="mb-1 block text-sm text-gray-400">Example</span>
					<textarea
						value={principle.example}
						onChange={(event) => onChange({ ...principle, example: event.target.value })}
						rows={2}
						className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-base text-white outline-none focus:border-gray-500"
					/>
				</label>
			</div>
		</div>
	);
}

function MemoryRow({
	memoryId,
	memory,
	index,
	count,
	onMove,
	onDelete,
}: {
	memoryId: number;
	memory: Memory | DevModeMemorySummary | undefined;
	index: number;
	count: number;
	onMove: (direction: "up" | "down") => void;
	onDelete: () => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/40 p-3">
			<div className="min-w-0">
				<p className="truncate text-sm font-medium text-gray-200">
					[M{memoryId}] {memory?.title ?? "Unknown memory"}
				</p>
				<p className="mt-1 text-xs text-gray-500">
					{memory
						? `${memory.type} · ${memory.status} · ${memory.permission}`
						: "This memory is not in the current option list."}
				</p>
			</div>
			<RowActions
				index={index}
				count={count}
				onMove={onMove}
				onDelete={onDelete}
				deleteLabel="Detach memory"
			/>
		</div>
	);
}

function RowActions({
	index,
	count,
	onMove,
	onDelete,
	deleteLabel,
}: {
	index: number;
	count: number;
	onMove: (direction: "up" | "down") => void;
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
				className="inline-flex size-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<ArrowUp size={16} aria-hidden="true" />
			</button>
			<button
				type="button"
				onClick={() => onMove("down")}
				disabled={index === count - 1}
				aria-label="Move down"
				className="inline-flex size-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<ArrowDown size={16} aria-hidden="true" />
			</button>
			<button
				type="button"
				onClick={onDelete}
				aria-label={deleteLabel}
				className="inline-flex size-9 items-center justify-center rounded-md text-red-300 hover:bg-red-500/10"
			>
				<Trash2 size={16} aria-hidden="true" />
			</button>
		</div>
	);
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
			<p className="flex items-center gap-2 text-xs text-gray-500">
				<Shield size={12} aria-hidden="true" /> {label}
			</p>
			<p className="mt-1 text-sm font-medium text-gray-200">{value}</p>
		</div>
	);
}
