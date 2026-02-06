import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brain, CircleDot, Clock, Shield, Tag } from "lucide-react";

import { Drawer } from "@/components/Drawer";
import { Section, InfoItem, LoadingState, ErrorState } from "@/components/ui";
import { api, type Memory } from "@/lib/api";
import { MEMORY_TYPE_CONFIG, MEMORY_STATUS_CONFIG, getStatusConfig } from "@/lib/config";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/memories/$id")({
	component: MemoryDetail,
});

function MemoryDetail() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const {
		data: memory,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["memory", id],
		queryFn: () => api.memory(Number(id)),
	});

	const handleClose = () => navigate({ to: "/memories" });

	return (
		<Drawer open={true} onClose={handleClose} title={memory?.title ?? "Memory"}>
			{isLoading && <LoadingState message="Loading memory..." />}
			{error && <ErrorState error={error} />}
			{memory && <MemoryContent memory={memory} />}
		</Drawer>
	);
}

function MemoryContent({ memory }: { memory: Memory }) {
	const type = getStatusConfig(MEMORY_TYPE_CONFIG, memory.type, memory.type);
	const status = getStatusConfig(MEMORY_STATUS_CONFIG, memory.status, memory.status);

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

			{/* Content */}
			<Section title="Content">
				<div className="rounded-lg bg-gray-800/50 p-4">
					<p className="text-sm whitespace-pre-wrap text-gray-300">{memory.content}</p>
				</div>
			</Section>

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
