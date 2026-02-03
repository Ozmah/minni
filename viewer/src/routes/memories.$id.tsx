import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brain, CircleDot, Clock, Shield, FolderOpen, Tag } from "lucide-react";
import { api, type Memory } from "@/lib/api";
import { Drawer } from "@/components/Drawer";

export const Route = createFileRoute("/memories/$id")({
	component: MemoryDetail,
});

function MemoryDetail() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const { data: memory, isLoading, error } = useQuery({
		queryKey: ["memory", id],
		queryFn: () => api.memory(Number(id)),
	});

	const handleClose = () => navigate({ to: "/memories" });

	return (
		<Drawer open={true} onClose={handleClose} title={memory?.title ?? "Memory"}>
			{isLoading && <LoadingState />}
			{error && <ErrorState error={error} />}
			{memory && <MemoryContent memory={memory} />}
		</Drawer>
	);
}

function MemoryContent({ memory }: { memory: Memory }) {
	const typeConfig: Record<string, { color: string; label: string }> = {
		skill: { color: "bg-blue-500/20 text-blue-400", label: "Skill" },
		pattern: { color: "bg-green-500/20 text-green-400", label: "Pattern" },
		anti_pattern: { color: "bg-red-500/20 text-red-400", label: "Anti-Pattern" },
		decision: { color: "bg-purple-500/20 text-purple-400", label: "Decision" },
		insight: { color: "bg-yellow-500/20 text-yellow-400", label: "Insight" },
		comparison: { color: "bg-cyan-500/20 text-cyan-400", label: "Comparison" },
		note: { color: "bg-gray-500/20 text-gray-400", label: "Note" },
		link: { color: "bg-indigo-500/20 text-indigo-400", label: "Link" },
		article: { color: "bg-orange-500/20 text-orange-400", label: "Article" },
		video: { color: "bg-pink-500/20 text-pink-400", label: "Video" },
		documentation: { color: "bg-teal-500/20 text-teal-400", label: "Documentation" },
	};

	const statusConfig: Record<string, { color: string; label: string }> = {
		draft: { color: "bg-gray-500/20 text-gray-400", label: "Draft" },
		experimental: { color: "bg-yellow-500/20 text-yellow-400", label: "Experimental" },
		proven: { color: "bg-green-500/20 text-green-400", label: "Proven" },
		battle_tested: { color: "bg-blue-500/20 text-blue-400", label: "Battle Tested" },
		deprecated: { color: "bg-red-500/20 text-red-400", label: "Deprecated" },
	};

	const type = typeConfig[memory.type] ?? { color: "bg-gray-500/20 text-gray-400", label: memory.type };
	const status = statusConfig[memory.status] ?? { color: "bg-gray-500/20 text-gray-400", label: memory.status };

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-gray-800 p-2">
					<Brain size={24} className="text-gray-400" />
				</div>
				<div className="flex-1">
					<h3 className="text-xl font-semibold text-white">{memory.title}</h3>
					<div className="mt-1 flex items-center gap-2">
						<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${type.color}`}>
							<Tag size={10} />
							{type.label}
						</span>
						<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
							<CircleDot size={10} />
							{status.label}
						</span>
					</div>
				</div>
			</div>

			{/* Content */}
			<Section title="Content">
				<div className="rounded-lg bg-gray-800/50 p-4">
					<p className="whitespace-pre-wrap text-sm text-gray-300">{memory.content}</p>
				</div>
			</Section>

			{/* Path */}
			{memory.path && (
				<Section title="Path">
					<div className="flex items-center gap-2 text-gray-300">
						<FolderOpen size={14} className="text-gray-500" />
						<code className="text-sm">{memory.path}</code>
					</div>
				</Section>
			)}

			{/* Permission */}
			<Section title="Permission">
				<InfoItem icon={Shield} label="Access" value={memory.permission} />
			</Section>

			{/* Timestamps */}
			<Section title="Timestamps">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<InfoItem icon={Clock} label="Created" value={formatDate(memory.createdAt)} />
					<InfoItem icon={Clock} label="Updated" value={formatDate(memory.updatedAt)} />
				</div>
			</Section>
		</div>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section>
			<h4 className="mb-2 text-sm font-medium uppercase tracking-wider text-gray-500">{title}</h4>
			{children}
		</section>
	);
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
	return (
		<div className="flex items-center gap-2 text-gray-400">
			<Icon size={14} />
			<span className="text-gray-500">{label}:</span>
			<span className="text-gray-300">{value}</span>
		</div>
	);
}

function formatDate(date: string | Date | number): string {
	return new Date(date).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function LoadingState() {
	return <div className="text-gray-400">Loading memory...</div>;
}

function ErrorState({ error }: { error: Error }) {
	return <div className="text-red-400">Error: {error.message}</div>;
}
