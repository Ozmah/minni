import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ListTodo, Clock, Circle, CircleCheck, CircleDot, CircleX } from "lucide-react";
import { api, type Task } from "@/lib/api";

export const Route = createFileRoute("/tasks")({
	component: TasksPage,
});

function TasksPage() {
	const { data: tasks, isLoading, error } = useQuery({
		queryKey: ["tasks"],
		queryFn: () => api.tasks({ limit: 100 }),
	});

	if (isLoading) {
		return <div className="p-6 text-gray-400">Loading tasks...</div>;
	}

	if (error) {
		return <div className="p-6 text-red-400">Error: {error.message}</div>;
	}

	if (!tasks?.length) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-gray-400">
				<ListTodo size={48} className="mb-4 opacity-50" />
				<p className="text-lg">No tasks yet</p>
				<p className="mt-2 text-sm">Create one using minni_task</p>
			</div>
		);
	}

	return (
		<>
			<div className="p-6">
				<h2 className="mb-6 text-2xl font-semibold tracking-tight">Tasks</h2>
				<div className="space-y-2">
					{tasks.map((task) => (
						<TaskCard key={task.id} task={task} />
					))}
				</div>
			</div>
			<Outlet />
		</>
	);
}

function TaskCard({ task }: { task: Task }) {
	const StatusIcon = {
		todo: Circle,
		in_progress: CircleDot,
		done: CircleCheck,
		cancelled: CircleX,
	}[task.status] || Circle;

	const statusColor = {
		todo: "text-gray-400",
		in_progress: "text-yellow-400",
		done: "text-green-400",
		cancelled: "text-red-400",
	}[task.status] || "text-gray-400";

	const priorityBadge = {
		high: "bg-red-500/20 text-red-300",
		medium: "bg-yellow-500/20 text-yellow-300",
		low: "bg-gray-500/20 text-gray-300",
	}[task.priority] || "bg-gray-500/20 text-gray-300";

	return (
		<Link
			to="/tasks/$id"
			params={{ id: task.id.toString() }}
			className="block"
		>
			<article className="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3 transition-colors hover:border-gray-600 hover:bg-gray-800">
				<StatusIcon size={20} className={statusColor} />
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<h3 className="font-medium text-white">{task.title}</h3>
						<span className={`rounded px-1.5 py-0.5 text-xs ${priorityBadge}`}>
							{task.priority}
						</span>
					</div>

					{task.description && (
						<p className="mt-1 line-clamp-1 text-sm text-gray-400">
							{task.description}
						</p>
					)}

					<div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
						<Clock size={12} />
						{new Date(task.updatedAt).toLocaleDateString()}
					</div>
				</div>
			</article>
		</Link>
	);
}
