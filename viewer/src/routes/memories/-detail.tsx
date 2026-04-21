import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	Brain,
	CircleDot,
	Clock,
	FolderKanban,
	GitBranch,
	Link2,
	Pencil,
	Shield,
	Tag,
	Trash2,
	Wrench,
} from "lucide-react";

import type { MemoryDetail } from "@/lib/memories";

import { Drawer } from "@/components/Drawer";
import { Section, InfoItem, LoadingState, ErrorState, MarkdownContent } from "@/components/ui";
import { MEMORY_TYPE_CONFIG, MEMORY_STATUS_CONFIG, getStatusConfig } from "@/lib/config";
import { formatDate } from "@/lib/utils";
import { setDeleteTarget, setEditTarget } from "@/stores/ui";

import { memoryDetailQueryOptions } from "./-queries";

export function MemoryDetailRoute({ id }: { id: number }) {
	const navigate = useNavigate();
	const { data: memory, isLoading, error } = useQuery(memoryDetailQueryOptions(id));
	const handleClose = () => navigate({ to: "/memories" });

	return (
		<Drawer
			open={true}
			onClose={handleClose}
			title={memory?.title ?? "Memory"}
			content={memory && <MemoryBody memory={memory} />}
			footer={memory && <MemoryActions memory={memory} />}
		>
			{isLoading && <LoadingState message="Loading memory..." />}
			{error && <ErrorState error={error} />}
			{memory && <MemoryMetadata memory={memory} />}
		</Drawer>
	);
}

function MemoryMetadata({ memory }: { memory: MemoryDetail }) {
	const type = getStatusConfig(MEMORY_TYPE_CONFIG, memory.type, memory.type);
	const status = getStatusConfig(MEMORY_STATUS_CONFIG, memory.status, memory.status);

	return (
		<div className="space-y-6">
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-gray-800 p-2">
					<Brain size={24} className="text-gray-400" />
				</div>
				<div className="flex-1">
					<h3 className="text-xl font-semibold text-white">{memory.title}</h3>
					<div className="mt-1 flex items-center gap-2">
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${type.color}`}
						>
							<Tag size={10} />
							{type.label}
						</span>
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
						>
							<CircleDot size={10} />
							{status.label}
						</span>
					</div>
				</div>
			</div>
			<Section title="Permission">
				<InfoItem icon={Shield} label="Access" value={memory.permission} />
			</Section>
			{memory.tags.length > 0 && (
				<Section title="Tags">
					<div className="flex flex-wrap gap-2">
						{memory.tags.map((tag) => (
							<span
								key={tag}
								className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-300 ring-1 ring-gray-700 ring-inset"
							>
								#{tag}
							</span>
						))}
					</div>
				</Section>
			)}
			<Section title="Affiliations">
				<div className="space-y-4 text-sm">
					<div>
						<div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
							<FolderKanban size={12} />
							Projects
						</div>
						{memory.associations.projects.length > 0 ? (
							memory.associations.projects.map((project) => (
								<div key={project.id} className="text-gray-300">
									{project.name}
								</div>
							))
						) : (
							<div className="text-gray-500">No project affiliations</div>
						)}
					</div>
					<div>
						<div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
							<Wrench size={12} />
							Dev Modes
						</div>
						{memory.associations.devModes.length > 0 ? (
							memory.associations.devModes.map((mode) => (
								<div key={mode.id} className="text-gray-300">
									{mode.name}
								</div>
							))
						) : (
							<div className="text-gray-500">No dev mode affiliations</div>
						)}
					</div>
				</div>
			</Section>
			<Section title="Connections">
				<div className="space-y-4 text-sm">
					<div>
						<div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
							<Link2 size={12} />
							Outgoing
						</div>
						{memory.relations.outgoing.length > 0 ? (
							memory.relations.outgoing.map((item) => (
								<div key={item.id} className="text-gray-300">
									{item.title}
								</div>
							))
						) : (
							<div className="text-gray-500">No outgoing relations</div>
						)}
					</div>
					<div>
						<div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
							<GitBranch size={12} />
							Incoming
						</div>
						{memory.relations.incoming.length > 0 ? (
							memory.relations.incoming.map((item) => (
								<div key={item.id} className="text-gray-300">
									{item.title}
								</div>
							))
						) : (
							<div className="text-gray-500">No incoming relations</div>
						)}
					</div>
				</div>
			</Section>
			<Section title="Active Context">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<InfoItem
						icon={FolderKanban}
						label="Active Project"
						value={memory.activeContext.inActiveProject ? "Included" : "Not included"}
					/>
					<InfoItem
						icon={Wrench}
						label="Active Dev Mode"
						value={memory.activeContext.inActiveDevMode ? "Included" : "Not included"}
					/>
				</div>
			</Section>
			<Section title="Timestamps">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<InfoItem icon={Clock} label="Created" value={formatDate(memory.createdAt)} />
					<InfoItem icon={Clock} label="Updated" value={formatDate(memory.updatedAt)} />
				</div>
			</Section>
		</div>
	);
}

function MemoryBody({ memory }: { memory: MemoryDetail }) {
	return (
		<Section title="Content">
			<div className="rounded-lg bg-gray-800/50 p-4">
				<MarkdownContent content={memory.content} className="prose-sm" />
			</div>
		</Section>
	);
}

function MemoryActions({ memory }: { memory: MemoryDetail }) {
	return (
		<div className="flex gap-2">
			<button
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
				className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
			>
				<Pencil size={16} />
				Edit
			</button>
			<button
				onClick={() => setDeleteTarget({ type: "memory", id: memory.id, name: memory.title })}
				className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20"
			>
				<Trash2 size={16} />
				Delete
			</button>
		</div>
	);
}
