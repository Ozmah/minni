import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Brain, Clock } from "lucide-react";

import { api, type Memory } from "@/lib/api";

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
		queryFn: () => api.memories({ limit: 100 }),
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
	const typeColor =
		{
			skill: "bg-blue-500/20 text-blue-300",
			pattern: "bg-green-500/20 text-green-300",
			anti_pattern: "bg-red-500/20 text-red-300",
			decision: "bg-purple-500/20 text-purple-300",
			insight: "bg-yellow-500/20 text-yellow-300",
			comparison: "bg-cyan-500/20 text-cyan-300",
			note: "bg-gray-500/20 text-gray-300",
			link: "bg-indigo-500/20 text-indigo-300",
			article: "bg-orange-500/20 text-orange-300",
			video: "bg-pink-500/20 text-pink-300",
			documentation: "bg-teal-500/20 text-teal-300",
			identity: "bg-amber-500/20 text-amber-300",
			context: "bg-emerald-500/20 text-emerald-300",
			scratchpad: "bg-slate-500/20 text-slate-300",
		}[memory.type] || "bg-gray-500/20 text-gray-300";

	const statusBadge =
		{
			draft: "text-gray-400",
			experimental: "text-yellow-400",
			proven: "text-green-400",
			battle_tested: "text-blue-400",
			deprecated: "text-red-400",
		}[memory.status] || "text-gray-400";

	return (
		<Link to="/memories/$id" params={{ id: memory.id.toString() }} className="block">
			<article className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 transition-colors hover:border-gray-600 hover:bg-gray-800">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1">
						<div className="flex items-center gap-2">
							<span className={`rounded px-2 py-0.5 text-xs font-medium ${typeColor}`}>
								{memory.type}
							</span>
							<h3 className="font-medium text-white">{memory.title}</h3>
						</div>

						<p className="mt-2 line-clamp-2 text-sm text-gray-400">{memory.content}</p>
					</div>

					<span className={`text-xs ${statusBadge}`}>{memory.status}</span>
				</div>

				<div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
					<Clock size={12} />
					{new Date(memory.updatedAt).toLocaleDateString()}
				</div>
			</article>
		</Link>
	);
}
