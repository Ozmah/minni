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
	TerminalSquare,
	type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CopyIconButton } from "@/components/ui";
import { MarkdownContent } from "@/components/ui/renderers/MarkdownContent";
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
	commands: TerminalSquare,
	memories: Brain,
};

function Cockpit() {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [selectedView, setSelectedView] = useState<"human" | "agent">("human");

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
									<h3 className="font-medium text-white">Selected context</h3>
									<p className="mt-1 text-sm text-gray-500">
										{selectedItem?.title ?? "Nothing selected"}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<ViewTabs value={selectedView} onChange={setSelectedView} />
									<CopyIconButton
										icon={Copy}
										label="Copy selected agent block"
										onCopy={() => copyText(selectedText)}
										className="rounded-md border border-gray-700 bg-gray-950 p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50"
									/>
								</div>
							</div>

							<SelectedContextDisplay item={selectedItem} view={selectedView} />
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
									<HealthTile label="Commands" value={String(loadout?.counts.commands ?? 0)} />
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

function ViewTabs({
	value,
	onChange,
}: {
	value: "human" | "agent";
	onChange: (value: "human" | "agent") => void;
}) {
	return (
		<div className="inline-flex rounded-md border border-gray-800 bg-gray-950 p-1" role="tablist">
			{(["human", "agent"] as const).map((tab) => (
				<button
					key={tab}
					type="button"
					role="tab"
					aria-selected={value === tab}
					onClick={() => onChange(tab)}
					className={`min-h-9 rounded px-3 text-sm capitalize outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
						value === tab
							? "bg-gray-800 text-white"
							: "text-gray-500 hover:bg-gray-900 hover:text-gray-300"
					}`}
				>
					{tab}
				</button>
			))}
		</div>
	);
}

function SelectedContextDisplay({
	item,
	view,
}: {
	item: ContextLoadoutItem | null;
	view: "human" | "agent";
}) {
	if (!item) return <EmptyState message="No active context selected." />;
	if (view === "agent") return <AgentRawBlock value={item.text} />;
	return <HumanLoadoutItem item={item} />;
}

function AgentRawBlock({ value }: { value: string }) {
	return (
		<pre className="max-h-[calc(100vh-23rem)] min-h-[28rem] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm leading-6 whitespace-pre-wrap text-gray-300">
			{value}
		</pre>
	);
}

function HumanLoadoutItem({ item }: { item: ContextLoadoutItem }) {
	if (item.kind === "command") return <HumanCommandView item={item} />;
	if (item.kind === "overview" && item.overview) return <HumanOverviewView item={item} />;
	if ((item.kind === "rule" || item.kind === "principle") && item.rule) {
		return <HumanRuleView item={item} />;
	}
	if (item.kind === "memory" && item.memory) return <HumanMemoryView item={item} />;

	return (
		<div className="max-h-[calc(100vh-23rem)] min-h-[28rem] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-5">
			<p className="text-sm font-medium text-white">{item.title}</p>
			<p className="mt-1 text-sm text-gray-500">{item.subtitle}</p>
			<p className="mt-4 text-sm text-gray-400">
				Switch to Agent to inspect the canonical context block.
			</p>
		</div>
	);
}

function HumanOverviewView({ item }: { item: ContextLoadoutItem }) {
	const overview = item.overview;
	if (!overview) return null;
	const markdown = formatOverviewMarkdown(overview);
	const isProject = overview.type === "project";
	const Icon = isProject ? FolderKanban : Hammer;

	return (
		<HumanPanel>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
						<Icon size={15} aria-hidden="true" /> {isProject ? "Project" : "Dev Mode"}
					</p>
					<h4 className="mt-2 truncate text-xl font-semibold tracking-tight text-white">
						{overview.name}
					</h4>
				</div>

				<CopyActionButton label="Copy markdown" onCopy={() => copyText(markdown)} />
			</div>

			<div className="mt-5 flex flex-wrap gap-2">
				<MetadataBadge label="Permission" value={overview.permission} />
				{overview.type === "project" && (
					<>
						<MetadataBadge label="Conventions" value={String(overview.conventionCount ?? 0)} />
						<MetadataBadge label="Gotchas" value={String(overview.gotchaCount ?? 0)} />
					</>
				)}
				{overview.type === "dev-mode" && (
					<MetadataBadge label="Principles" value={String(overview.principleCount ?? 0)} />
				)}
			</div>

			{overview.stack && overview.stack.length > 0 && (
				<div className="mt-5">
					<p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">Stack</p>
					<div className="flex flex-wrap gap-2">
						{overview.stack.map((item) => (
							<span
								key={item}
								className="rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-xs text-gray-300"
							>
								{item}
							</span>
						))}
					</div>
				</div>
			)}

			{overview.description && (
				<div className="mt-5 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
					<p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
						Description
					</p>
					<p className="text-sm leading-6 whitespace-pre-wrap text-gray-300">
						{overview.description}
					</p>
				</div>
			)}
		</HumanPanel>
	);
}

function HumanRuleView({ item }: { item: ContextLoadoutItem }) {
	const rule = item.rule;
	if (!rule) return null;
	const label =
		rule.kind === "principle" ? "Principle" : rule.kind === "gotcha" ? "Gotcha" : "Convention";
	const markdown = formatRuleMarkdown(rule);

	return (
		<HumanPanel>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
						<Shield size={15} aria-hidden="true" /> {label}
					</p>
					<h4 className="mt-2 text-xl leading-7 font-semibold tracking-tight text-white">
						{rule.statement}
					</h4>
				</div>

				<CopyActionButton label="Copy markdown" onCopy={() => copyText(markdown)} />
			</div>

			<div className="mt-5 flex flex-wrap gap-2">
				<MetadataBadge
					label="Severity"
					value={rule.severity}
					tone={
						rule.severity === "critical"
							? "danger"
							: rule.severity === "strong"
								? "warn"
								: "default"
					}
				/>
				<MetadataBadge label="Permission" value={rule.permission} />
			</div>

			{rule.rationale && <HumanTextSection title="Rationale" value={rule.rationale} />}
			{rule.example && <HumanTextSection title="Example" value={rule.example} mono />}
		</HumanPanel>
	);
}

function HumanMemoryView({ item }: { item: ContextLoadoutItem }) {
	const memory = item.memory;
	if (!memory) return null;
	const markdown = formatMemoryMarkdown(memory);

	return (
		<HumanPanel>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
						<Brain size={15} aria-hidden="true" /> Memory M{memory.id}
					</p>
					<h4 className="mt-2 truncate text-xl font-semibold tracking-tight text-white">
						{memory.title}
					</h4>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<CopyActionButton label="Copy markdown" onCopy={() => copyText(markdown)} />
					<CopyActionButton label="Copy ID" onCopy={() => copyText(`M${memory.id}`)} />
				</div>
			</div>

			<div className="mt-5 flex flex-wrap gap-2">
				<MetadataBadge label="Type" value={memory.type} />
				<MetadataBadge label="Status" value={memory.status} />
				<MetadataBadge label="Permission" value={memory.permission} />
				{memory.placement && (
					<MetadataBadge label="Placement" value={formatMemoryPlacementLabel(memory.placement)} />
				)}
			</div>

			<div className="mt-5 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
				<p className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">Content</p>
				<MarkdownContent content={memory.content} className="prose-sm" />
			</div>
		</HumanPanel>
	);
}

function HumanCommandView({ item }: { item: ContextLoadoutItem }) {
	const command = getCommandDetails(item);
	const markdown = formatCommandMarkdown(command);

	return (
		<HumanPanel>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
						<TerminalSquare size={15} aria-hidden="true" /> Command
					</p>
					<h4 className="mt-2 truncate text-xl font-semibold tracking-tight text-white">
						{command.key}
					</h4>
					{command.summary && <p className="mt-2 text-sm text-gray-400">{command.summary}</p>}
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<CopyActionButton label="Copy command" onCopy={() => copyText(command.command)} />
					<CopyActionButton label="Copy markdown" onCopy={() => copyText(markdown)} />
				</div>
			</div>

			<div className="mt-5 flex flex-wrap gap-2">
				<MetadataBadge label="Group" value={command.group} />
				<MetadataBadge
					label="Risk"
					value={command.risk}
					tone={
						command.risk === "destructive"
							? "danger"
							: command.risk === "mutating"
								? "warn"
								: "default"
					}
				/>
				<MetadataBadge label="Visibility" value={command.visibility} />
				<MetadataBadge label="Permission" value={command.permission} />
			</div>

			<div className="mt-5">
				<p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">Command</p>
				<pre className="overflow-auto rounded-lg border border-emerald-500/20 bg-black/40 p-4 font-mono text-sm leading-6 whitespace-pre-wrap text-emerald-100">
					{command.command}
				</pre>
			</div>

			{command.notes && (
				<div className="mt-5 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
					<p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">Notes</p>
					<p className="text-sm leading-6 whitespace-pre-wrap text-gray-300">{command.notes}</p>
				</div>
			)}
		</HumanPanel>
	);
}

function HumanPanel({ children }: { children: ReactNode }) {
	return (
		<div className="max-h-[calc(100vh-23rem)] min-h-[28rem] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-5">
			{children}
		</div>
	);
}

function HumanTextSection({
	title,
	value,
	mono = false,
}: {
	title: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="mt-5 rounded-lg border border-gray-800 bg-gray-900/60 p-4">
			<p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">{title}</p>
			<p
				className={`text-sm leading-6 whitespace-pre-wrap text-gray-300 ${mono ? "font-mono" : ""}`}
			>
				{value}
			</p>
		</div>
	);
}

function CopyActionButton({ label, onCopy }: { label: string; onCopy: () => Promise<void> }) {
	return (
		<button
			type="button"
			onClick={() => void onCopy()}
			className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-3 text-sm text-gray-200 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
		>
			<Copy size={14} aria-hidden="true" />
			{label}
		</button>
	);
}

function MetadataBadge({
	label,
	value,
	tone = "default",
}: {
	label: string;
	value: string;
	tone?: "default" | "warn" | "danger";
}) {
	const toneClass =
		tone === "danger"
			? "border-red-500/30 bg-red-500/10 text-red-200"
			: tone === "warn"
				? "border-amber-500/30 bg-amber-500/10 text-amber-200"
				: "border-gray-700 bg-gray-900 text-gray-300";

	return (
		<span
			className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs ${toneClass}`}
		>
			<span className="text-gray-500">{label}</span>
			<span className="font-medium">{value}</span>
		</span>
	);
}

type HumanCommandDetails = {
	key: string;
	command: string;
	summary: string | null;
	group: string;
	risk: string;
	visibility: string;
	permission: string;
	notes: string | null;
};

type HumanOverviewDetails = NonNullable<ContextLoadoutItem["overview"]>;
type HumanRuleDetails = NonNullable<ContextLoadoutItem["rule"]>;
type HumanMemoryDetails = NonNullable<ContextLoadoutItem["memory"]>;

function formatOverviewMarkdown(overview: HumanOverviewDetails) {
	const label = overview.type === "project" ? "Project" : "Dev Mode";
	const lines = [`### ${label}: ${overview.name}`, "", `- Permission: \`${overview.permission}\``];

	if (overview.type === "project") {
		lines.push(
			`- Conventions: \`${overview.conventionCount ?? 0}\``,
			`- Gotchas: \`${overview.gotchaCount ?? 0}\``,
		);
		if (overview.stack && overview.stack.length > 0) {
			lines.push(`- Stack: ${overview.stack.map((item) => `\`${item}\``).join(", ")}`);
		}
	} else {
		lines.push(`- Principles: \`${overview.principleCount ?? 0}\``);
	}

	if (overview.description) lines.push("", overview.description);
	return lines.join("\n");
}

function formatRuleMarkdown(rule: HumanRuleDetails) {
	const label =
		rule.kind === "principle" ? "Principle" : rule.kind === "gotcha" ? "Gotcha" : "Convention";
	const lines = [
		`### ${label}`,
		"",
		rule.statement,
		"",
		`- Severity: \`${rule.severity}\``,
		`- Permission: \`${rule.permission}\``,
	];
	if (rule.rationale) lines.push("", "#### Rationale", "", rule.rationale);
	if (rule.example) lines.push("", "#### Example", "", rule.example);
	return lines.join("\n");
}

function formatMemoryMarkdown(memory: HumanMemoryDetails) {
	const lines = [
		`### [M${memory.id}] ${memory.title}`,
		"",
		`- Type: \`${memory.type}\``,
		`- Status: \`${memory.status}\``,
		`- Permission: \`${memory.permission}\``,
	];
	if (memory.placement)
		lines.push(`- Placement: \`${formatMemoryPlacementLabel(memory.placement)}\``);
	lines.push("", memory.content);
	return lines.join("\n");
}

function formatMemoryPlacementLabel(placement: HumanMemoryDetails["placement"]) {
	switch (placement) {
		case "project":
			return "Project";
		case "dev_mode":
			return "Dev Mode";
		case "shared":
			return "Shared";
		default:
			return "Unscoped";
	}
}

function getCommandDetails(item: ContextLoadoutItem): HumanCommandDetails {
	if (item.command) return item.command;

	return {
		key: item.title,
		command: extractLineValue(item.text, "Command") ?? item.text,
		summary: extractLineValue(item.text, "Summary"),
		group: item.subtitle.split(" · ")[0] ?? "unknown",
		risk: extractLineValue(item.text, "Risk") ?? "unknown",
		visibility: extractLineValue(item.text, "Visibility") ?? "unknown",
		permission: "unknown",
		notes: extractNotes(item.text),
	};
}

function extractLineValue(text: string, label: string) {
	const prefix = `${label}: `;
	return (
		text
			.split("\n")
			.find((line) => line.startsWith(prefix))
			?.slice(prefix.length)
			.trim() ?? null
	);
}

function extractNotes(text: string) {
	const marker = "\nNotes:\n";
	const start = text.indexOf(marker);
	if (start === -1) return null;
	const value = text
		.slice(start + marker.length)
		.replace(/\n\[\/COMMAND:[^\n]+\]$/, "")
		.trim();
	return value || null;
}

function formatCommandMarkdown(command: HumanCommandDetails) {
	const lines = [`### ${command.key}`];
	if (command.summary) lines.push("", command.summary);
	lines.push("", fencedCodeBlock(command.command, "bash"));
	lines.push(
		"",
		`- Group: \`${command.group}\``,
		`- Risk: \`${command.risk}\``,
		`- Visibility: \`${command.visibility}\``,
		`- Permission: \`${command.permission}\``,
	);
	if (command.notes) lines.push("", "#### Notes", "", command.notes);
	return lines.join("\n");
}

function fencedCodeBlock(value: string, language: string) {
	const longestBacktickRun = Math.max(
		0,
		...Array.from(value.matchAll(/`+/g), (match) => match[0].length),
	);
	const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
	return `${fence}${language}\n${value}\n${fence}`;
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
