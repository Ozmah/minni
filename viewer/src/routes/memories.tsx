import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Brain, Clock } from "lucide-react";

import { api, unwrap } from "@/lib/api";
import { MEMORY_TYPE_CONFIG, MEMORY_STATUS_CONFIG, getStatusConfig } from "@/lib/config";

import type { Memory } from "../../../src/schema";

export const Route = createFileRoute("/memories")({
	component: MemoriesPage,
});

function MemoriesPage() {
	const {
		data: memories,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["memories"],
		queryFn: () => api.api.memories.get({ query: { limit: 100 } }).then(unwrap),
	});

	if (isLoading) {
		return <div className="p-6 text-gray-400">Loading memories...</div>;
	}

	if (error) {
		return <div className="p-6 text-red-400">Error: {error.message}</div>;
	}

	if (!memories?.length) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-gray-400">
				<Brain size={48} className="mb-4 opacity-50" />
				<p className="text-lg">No memories yet</p>
				<p className="mt-2 text-sm">Create one using minni_save</p>
			</div>
		);
	}

	return (
		<>
			<div className="p-6">
				<h2 className="mb-6 text-2xl font-semibold tracking-tight">Memories</h2>
				<div className="space-y-3">
					{memories.map((memory) => (
						<MemoryCard key={memory.id} memory={memory} />
					))}
				</div>
			</div>
			<Outlet />
		</>
	);
}

function MemoryCard({ memory }: { memory: Memory }) {
	const typeConfig = getStatusConfig(MEMORY_TYPE_CONFIG, memory.type);
	const statusConfig = getStatusConfig(MEMORY_STATUS_CONFIG, memory.status);

	// TODO need to do something about the colors, maybe a custom basic component/design system
	return (
		<Link to="/memories/$id" params={{ id: memory.id.toString() }} className="block">
			<article className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 transition-colors hover:border-gray-600 hover:bg-gray-800">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1">
						<div className="flex items-center gap-2">
							<span className={`rounded px-2 py-0.5 text-xs font-medium ${typeConfig.color}`}>
								{typeConfig.label}
							</span>
							<h3 className="font-medium text-white">{memory.title}</h3>
						</div>

						<p className="mt-2 line-clamp-2 text-sm text-gray-400">{memory.content}</p>
					</div>

					<span className={`text-xs ${statusConfig.color}`}>{statusConfig.label}</span>
				</div>

				<div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
					<Clock size={12} />
					{new Date(memory.updatedAt).toLocaleDateString()}
				</div>
			</article>
		</Link>
	);
}
