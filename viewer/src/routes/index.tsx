import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Brain,
	CheckCircle2,
	Copy,
	FileText,
	FolderKanban,
	Hammer,
	Shield,
	type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CopyIconButton } from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { copyText } from "@/lib/clipboard";

import type {
	ActiveContextLoadout,
	ContextLoadoutItem,
	ContextLoadoutSection,
} from "../../../src/server/lib/context-loadout";

export const Route = createFileRoute("/")({
	component: Cockpit,
});

const SECTION_ICON: Record<ContextLoadoutSection["key"], LucideIcon> = {
	project: FolderKanban,
	"dev-mode": Hammer,
	memories: Brain,
};

function Cockpit() {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	const { data: hud } = useQuery({
		queryKey: ["hud"],
		queryFn: () => api.api.hud.get().then(unwrap),
		refetchInterval: 3000,
	});

	const { data: loadout } = useQuery({
		queryKey: ["context", "active-loadout"],
		queryFn: () =>
			api.api.context["active-loadout"]
				.get()
				.then(unwrap)
				.then((value) => value as ActiveContextLoadout),
		refetchInterval: 3000,
	});

	const sections = loadout?.sections ?? [];
	const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);
	const selectedItem = items.find((item) => item.key === selectedKey) ?? items[0] ?? null;
	const selectedSection = sections.find((section) =>
		section.items.some((item) => item.key === selectedItem?.key),
	);
	const selectedText = selectedItem?.text ?? "No active context selected.";
	const fullContext = loadout?.text ?? "No active context selected.";

	useEffect(() => {
		if (items.length === 0) {
			setSelectedKey(null);
			return;
		}

		if (!selectedKey || !items.some((item) => item.key === selectedKey)) {
			setSelectedKey(items[0]?.key ?? null);
		}
	}, [items, selectedKey]);

	return (
		<div className="min-h-full bg-gray-900 p-6 text-gray-100">
			<div className="mx-auto flex max-w-7xl flex-col gap-5">
				<header className="rounded-xl border border-gray-800 bg-gray-900/70 p-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="text-sm font-medium tracking-wide text-emerald-400 uppercase">
								Cockpit
							</p>
							<h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
								Active context loadout
							</h2>
							<p className="mt-2 max-w-2xl text-sm text-gray-400">
								This is the canonical context pipeline used by <code>minni_equip(active:true)</code>
								.
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<ContextPill
								icon={FolderKanban}
								label="Project"
								value={loadout?.activeProject?.name ?? hud?.project?.name}
							/>
							<ContextPill
								icon={Hammer}
								label="Dev Mode"
								value={loadout?.activeDevMode?.name ?? hud?.devMode?.name}
							/>
							<CopyIconButton
								icon={Copy}
								label="Copy full active context"
								onCopy={() => copyText(fullContext)}
								className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-200 hover:bg-emerald-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50"
							/>
						</div>
					</div>
				</header>

				<div className="grid min-h-[calc(100vh-14rem)] gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
					<aside className="min-h-0 rounded-xl border border-gray-800 bg-gray-900/70 p-4">
						<div className="mb-4 flex items-center justify-between gap-3">
							<h3 className="font-medium text-white">Loadout slots</h3>
							<span className="text-xs text-gray-500 tabular-nums">{items.length} items</span>
						</div>

						<div className="max-h-[calc(100vh-18rem)] space-y-4 overflow-auto pr-1">
							{sections.length === 0 ? (
								<EmptyState message="Select a project and dev mode to assemble context." />
							) : (
								sections.map((section) => (
									<LoadoutSectionList
										key={section.key}
										section={section}
										selectedKey={selectedItem?.key ?? null}
										onSelect={setSelectedKey}
									/>
								))
							)}
						</div>
					</aside>

					<main className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
						<section className="min-h-0 rounded-xl border border-gray-800 bg-gray-900/70 p-5">
							<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
								<div>
									<h3 className="font-medium text-white">Selected context text</h3>
									<p className="mt-1 text-sm text-gray-500">
										{selectedItem?.title ?? "Nothing selected"}
									</p>
								</div>
								<CopyIconButton
									icon={Copy}
									label="Copy selected item"
									onCopy={() => copyText(selectedText)}
									className="rounded-md border border-gray-700 bg-gray-950 p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50"
								/>
							</div>

							<pre className="max-h-[calc(100vh-23rem)] min-h-[28rem] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm leading-6 whitespace-pre-wrap text-gray-300">
								{selectedText}
							</pre>
						</section>

						<aside className="min-h-0 space-y-5">
							<Panel title="Selected item">
								{selectedItem ? (
									<div className="space-y-3">
										<div>
											<p className="text-sm font-medium text-white">{selectedItem.title}</p>
											<p className="mt-1 text-sm text-gray-500">{selectedItem.subtitle}</p>
										</div>
										{selectedSection && (
											<div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-400">
												<p>Layer: {selectedSection.title}</p>
												<p>Kind: {selectedItem.kind}</p>
												{selectedItem.memoryId && <p>Memory: M{selectedItem.memoryId}</p>}
											</div>
										)}
									</div>
								) : (
									<EmptyState message="No selected item." />
								)}
							</Panel>

							<Panel title="Copy by layer">
								<div className="space-y-2">
									{sections.map((section) => (
										<button
											key={section.key}
											type="button"
											onClick={() => void copyText(section.text)}
											className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/40 px-3 text-left text-sm text-gray-300 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
										>
											<span>{section.title}</span>
											<Copy size={14} aria-hidden="true" />
										</button>
									))}
								</div>
							</Panel>

							<Panel title="Context health">
								<div className="grid grid-cols-2 gap-3 text-sm">
									<HealthTile
										label="Project"
										value={loadout?.activeProject ? "loaded" : "missing"}
									/>
									<HealthTile
										label="Dev Mode"
										value={loadout?.activeDevMode ? "loaded" : "missing"}
									/>
									<HealthTile label="Memories" value={String(loadout?.counts.memories ?? 0)} />
									<HealthTile label="Items" value={String(loadout?.counts.items ?? 0)} />
								</div>
							</Panel>
						</aside>
					</main>
				</div>
			</div>
		</div>
	);
}

function ContextPill({
	icon: Icon,
	label,
	value,
}: {
	icon: LucideIcon;
	label: string;
	value?: string;
}) {
	return (
		<div className="flex min-h-10 items-center gap-2 rounded-md border border-gray-800 bg-gray-950/50 px-3 text-sm">
			<Icon size={15} className="text-gray-500" aria-hidden="true" />
			<span className="text-gray-500">{label}</span>
			<span className="max-w-44 truncate font-medium text-gray-200">{value ?? "Not selected"}</span>
		</div>
	);
}

function LoadoutSectionList({
	section,
	selectedKey,
	onSelect,
}: {
	section: ContextLoadoutSection;
	selectedKey: string | null;
	onSelect: (key: string) => void;
}) {
	const Icon = SECTION_ICON[section.key];

	return (
		<section>
			<div className="mb-2 flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<Icon size={16} className="shrink-0 text-gray-500" aria-hidden="true" />
					<div className="min-w-0">
						<p className="text-sm font-medium text-gray-200">{section.title}</p>
						<p className="truncate text-xs text-gray-600">{section.description}</p>
					</div>
				</div>
				<CopyIconButton
					icon={Copy}
					label={`Copy ${section.title}`}
					onCopy={() => copyText(section.text)}
				/>
			</div>
			<div className="space-y-1">
				{section.items.map((item: ContextLoadoutItem) => (
					<button
						key={item.key}
						type="button"
						onClick={() => onSelect(item.key)}
						className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 motion-reduce:transition-none ${
							selectedKey === item.key
								? "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-500/30 ring-inset"
								: "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
						}`}
					>
						<span className="min-w-0">
							<span className="block truncate text-sm font-medium">{item.title}</span>
							<span className="block truncate text-xs text-gray-600">{item.subtitle}</span>
						</span>
						{selectedKey === item.key && (
							<CheckCircle2 size={14} className="shrink-0" aria-hidden="true" />
						)}
					</button>
				))}
			</div>
		</section>
	);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
			<h3 className="mb-3 font-medium text-white">{title}</h3>
			{children}
		</section>
	);
}

function HealthTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
			<p className="flex items-center gap-1.5 text-xs text-gray-500">
				<Shield size={12} aria-hidden="true" /> {label}
			</p>
			<p className="mt-1 text-sm font-medium text-gray-200 tabular-nums">{value}</p>
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="rounded-lg border border-dashed border-gray-800 p-5 text-center text-sm text-gray-500">
			<FileText size={18} className="mx-auto mb-2 text-gray-600" aria-hidden="true" />
			{message}
		</div>
	);
}
