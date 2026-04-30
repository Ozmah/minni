import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowDownToLine,
	ArrowUpFromLine,
	Archive,
	Copy,
	Hash,
	Pencil,
	Trash2,
} from "lucide-react";

import { Drawer } from "@/components/Drawer";
import { CopyIconButton, ErrorState, LoadingState, MarkdownContent } from "@/components/ui";
import { copyText, copyWithAdapter } from "@/lib/clipboard";
import { memoryDetailToMarkdown } from "@/lib/copy-adapters/memory";
import {
	deriveMemoryActions,
	normalizeMemorySummary,
	type MemoryDetail,
	type MemoryRelationRef,
	type MemoryStatusAction,
} from "@/lib/memories";
import { formatDate } from "@/lib/utils";
import { setDeleteTarget, setEditTarget } from "@/stores/ui";

import { memoryDetailQueryOptions, useMemoryStatusMutation } from "./-queries";
import {
	NEXT_STATUS_ON_DEGRADE,
	NEXT_STATUS_ON_PROMOTE,
	PERMISSION_DOT,
	PERMISSION_LABEL,
	PLACEMENT_LABEL,
	STATUS_STYLE,
	TYPE_ICON,
	TYPE_LABEL,
} from "./-shared";

export function MemoryDetailRoute({ id }: { id: number }) {
	const navigate = useNavigate();
	const { data: memory, isLoading, error } = useQuery(memoryDetailQueryOptions(id));
	const handleClose = () => navigate({ to: "/memories" });

	return (
		<Drawer
			open={true}
			onClose={handleClose}
			title={memory?.title ?? "Memory"}
			content={memory ? <MemoryContent memory={memory} /> : undefined}
		>
			{isLoading && <LoadingState message="Loading memory..." />}
			{error && <ErrorState error={error} />}
			{memory && <MemoryHeader memory={memory} />}
		</Drawer>
	);
}

function MemoryHeader({ memory }: { memory: MemoryDetail }) {
	return (
		<div className="space-y-3 border-b border-gray-800/70 pb-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<MemoryEyebrow memory={memory} />
				<MemoryTopActions memory={memory} />
			</div>
			<StatusActions memory={memory} />
		</div>
	);
}

function MemoryEyebrow({ memory }: { memory: MemoryDetail }) {
	const TypeIcon = TYPE_ICON[memory.type];
	const status = STATUS_STYLE[memory.status];
	const { inActiveProject, inActiveDevMode } = memory.activeContext;
	const inActive = inActiveProject || inActiveDevMode;

	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
			<span className="inline-flex items-center gap-1.5 text-sm text-gray-300">
				<TypeIcon size={14} className="text-gray-500" aria-hidden="true" />
				{TYPE_LABEL[memory.type]}
			</span>
			<span aria-hidden="true" className="text-gray-700">
				·
			</span>
			<span className={`text-sm ${status.color}`}>{status.label}</span>
			<span aria-hidden="true" className="text-gray-700">
				·
			</span>
			<span className="inline-flex items-center gap-1.5 text-sm text-gray-300">
				<span
					aria-label={PERMISSION_LABEL[memory.permission]}
					className={`size-1.5 rounded-full ${PERMISSION_DOT[memory.permission]}`}
				/>
				{PERMISSION_LABEL[memory.permission]}
			</span>
			{inActive && (
				<>
					<span aria-hidden="true" className="text-gray-700">
						·
					</span>
					<span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
						<span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
						In active context
					</span>
				</>
			)}
		</div>
	);
}

function MemoryTopActions({ memory }: { memory: MemoryDetail }) {
	const handleCopyMarkdown = () => copyWithAdapter(memory, memoryDetailToMarkdown);
	const handleCopyId = () => copyText(String(memory.id));

	return (
		<div className="ml-auto flex shrink-0 items-center gap-1">
			<CopyIconButton icon={Copy} label="Copy as Markdown" onCopy={handleCopyMarkdown} />
			<CopyIconButton icon={Hash} label="Copy ID" onCopy={handleCopyId} />
			<span aria-hidden="true" className="mx-1 h-5 w-px bg-gray-800" />
			<button
				type="button"
				onClick={() =>
					setEditTarget({
						type: "memory",
						id: memory.id,
						data: {
							title: memory.title,
							content: memory.content,
							type: memory.type,
							status: memory.status,
							permission: memory.permission,
						},
					})
				}
				className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 motion-reduce:transition-none"
			>
				<Pencil size={14} aria-hidden="true" />
				Edit
			</button>
			<button
				type="button"
				onClick={() => setDeleteTarget({ type: "memory", id: memory.id, name: memory.title })}
				className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 motion-reduce:transition-none"
			>
				<Trash2 size={14} aria-hidden="true" />
				Delete
			</button>
		</div>
	);
}

function StatusActions({ memory }: { memory: MemoryDetail }) {
	const mutation = useMemoryStatusMutation(memory.id);
	const { canPromote, canDegrade, canDeprecate } =
		memory.actions ?? deriveMemoryActions(memory.status, memory.permission);

	if (memory.permission === "locked" || memory.permission === "read_only") {
		return (
			<p className="text-xs text-gray-600">
				Status locked — {PERMISSION_LABEL[memory.permission].toLowerCase()} permission.
			</p>
		);
	}

	const promoteTarget = NEXT_STATUS_ON_PROMOTE[memory.status];
	const degradeTarget = NEXT_STATUS_ON_DEGRADE[memory.status];

	const run = (action: MemoryStatusAction) => mutation.mutate(action);

	return (
		<div className="flex flex-wrap items-center gap-2">
			<StatusButton
				icon={ArrowUpFromLine}
				label={promoteTarget ? `Promote to ${STATUS_STYLE[promoteTarget].label}` : "Promote"}
				tone="primary"
				disabled={!canPromote || mutation.isPending}
				onClick={() => run("promote")}
			/>
			<StatusButton
				icon={ArrowDownToLine}
				label={degradeTarget ? `Degrade to ${STATUS_STYLE[degradeTarget].label}` : "Degrade"}
				tone="neutral"
				disabled={!canDegrade || mutation.isPending}
				onClick={() => run("degrade")}
			/>
			<StatusButton
				icon={Archive}
				label="Deprecate"
				tone="warning"
				disabled={!canDeprecate || mutation.isPending}
				onClick={() => run("deprecate")}
			/>
			{mutation.isError && (
				<span className="text-xs text-red-400" role="alert">
					{mutation.error instanceof Error ? mutation.error.message : "Action failed"}
				</span>
			)}
		</div>
	);
}

type StatusButtonTone = "primary" | "neutral" | "warning";

const TONE_CLASSES: Record<StatusButtonTone, string> = {
	primary: "hover:bg-emerald-500/10 hover:text-emerald-300 focus-visible:outline-emerald-500",
	neutral: "hover:bg-gray-700 hover:text-gray-100 focus-visible:outline-emerald-500",
	warning: "hover:bg-amber-500/10 hover:text-amber-300 focus-visible:outline-amber-500",
};

function StatusButton({
	icon: Icon,
	label,
	tone,
	disabled,
	onClick,
}: {
	icon: typeof ArrowUpFromLine;
	label: string;
	tone: StatusButtonTone;
	disabled: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-gray-400 ring-1 ring-gray-700 transition-colors ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400 motion-reduce:transition-none ${TONE_CLASSES[tone]}`}
		>
			<Icon size={12} aria-hidden="true" />
			{label}
		</button>
	);
}

function MemoryContent({ memory }: { memory: MemoryDetail }) {
	return (
		<div className="space-y-8">
			<MemoryDetails memory={memory} />
			<MemoryRelations memory={memory} />
			<MemoryBody memory={memory} />
			<MemoryFootnote memory={memory} />
		</div>
	);
}

function MemoryDetails({ memory }: { memory: MemoryDetail }) {
	const hasProjects = memory.associations.projects.length > 0;
	const hasDevModes = memory.associations.devModes.length > 0;
	const hasTags = memory.tags.length > 0;
	const summary = normalizeMemorySummary(memory.summary, {
		relationCount: memory.relations.outgoing.length + memory.relations.incoming.length,
		projectCount: memory.associations.projects.length,
		devModeCount: memory.associations.devModes.length,
		tagCount: memory.tags.length,
	});

	return (
		<section>
			<h3 className="mb-4 text-sm font-medium text-gray-300">Details</h3>
			<dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 text-sm">
				<dt className="font-medium text-gray-300">Placement</dt>
				<dd className="text-gray-400">{PLACEMENT_LABEL[memory.placement]}</dd>

				<dt className="font-medium text-gray-300">
					Projects{" "}
					<span className="font-normal text-gray-600 tabular-nums">· {summary.projectCount}</span>
				</dt>
				<dd className="text-gray-400">
					{hasProjects ? (
						<ul role="list" className="flex flex-wrap gap-1.5">
							{memory.associations.projects.map((project) => (
								<li
									key={project.id}
									className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-200 ring-1 ring-gray-700 ring-inset"
								>
									{project.name}
								</li>
							))}
						</ul>
					) : (
						<span className="text-gray-600">None</span>
					)}
				</dd>

				<dt className="font-medium text-gray-300">
					Dev modes{" "}
					<span className="font-normal text-gray-600 tabular-nums">· {summary.devModeCount}</span>
				</dt>
				<dd className="text-gray-400">
					{hasDevModes ? (
						<ul role="list" className="flex flex-wrap gap-1.5">
							{memory.associations.devModes.map((mode) => (
								<li
									key={mode.id}
									className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-200 ring-1 ring-gray-700 ring-inset"
								>
									{mode.name}
								</li>
							))}
						</ul>
					) : (
						<span className="text-gray-600">None</span>
					)}
				</dd>

				<dt className="font-medium text-gray-300">
					Tags <span className="font-normal text-gray-600 tabular-nums">· {summary.tagCount}</span>
				</dt>
				<dd className="text-gray-400">
					{hasTags ? (
						<p className="text-sm">
							{memory.tags.map((tag) => (
								<span key={tag} className="mr-2 text-gray-500">
									#{tag}
								</span>
							))}
						</p>
					) : (
						<span className="text-gray-600">None</span>
					)}
				</dd>
			</dl>
		</section>
	);
}

function MemoryRelations({ memory }: { memory: MemoryDetail }) {
	const { outgoing, incoming } = memory.relations;
	const summary = normalizeMemorySummary(memory.summary, {
		relationCount: outgoing.length + incoming.length,
		projectCount: memory.associations.projects.length,
		devModeCount: memory.associations.devModes.length,
		tagCount: memory.tags.length,
	});
	if (outgoing.length === 0 && incoming.length === 0) return null;

	return (
		<section className="border-t border-gray-800 pt-6">
			<h3 className="mb-4 flex items-baseline gap-2 text-sm font-medium text-gray-300">
				Related memories
				<span className="text-xs font-normal text-gray-600 tabular-nums">
					· {summary.relationCount}
				</span>
			</h3>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				<RelationColumn title="Outgoing" items={outgoing} />
				<RelationColumn title="Incoming" items={incoming} />
			</div>
		</section>
	);
}

function RelationColumn({ title, items }: { title: string; items: MemoryRelationRef[] }) {
	return (
		<div>
			<h4 className="mb-2 font-mono text-[0.6875rem] tracking-widest text-gray-500 uppercase">
				{title}
				<span className="ml-1.5 text-gray-700 normal-case tabular-nums">({items.length})</span>
			</h4>
			{items.length > 0 ? (
				<ul role="list" className="-mx-2">
					{items.map((item) => {
						const TypeIcon = TYPE_ICON[item.type];
						return (
							<li key={item.id}>
								<Link
									to="/memories/$id"
									params={{ id: String(item.id) }}
									className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
								>
									<TypeIcon size={12} className="shrink-0 text-gray-500" aria-hidden="true" />
									<span className="truncate">{item.title}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="text-sm text-gray-600">None</p>
			)}
		</div>
	);
}

function MemoryBody({ memory }: { memory: MemoryDetail }) {
	return (
		<section className="border-t border-gray-800 pt-6">
			<h3 className="mb-4 text-sm font-medium text-gray-300">Content</h3>
			<MarkdownContent content={memory.content} className="max-w-none" />
		</section>
	);
}

function MemoryFootnote({ memory }: { memory: MemoryDetail }) {
	return (
		<footer className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-gray-800/60 pt-4 text-xs text-gray-500 tabular-nums">
			<span>Created {formatDate(memory.createdAt)}</span>
			<span>Updated {formatDate(memory.updatedAt)}</span>
			<span>ID #{memory.id}</span>
		</footer>
	);
}
