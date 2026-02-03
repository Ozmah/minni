import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ListTodo, Clock, Circle } from "lucide-react";

import { api, type Task } from "@/lib/api";
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from "@/lib/config";

export const Route = createFileRoute("/tasks")({
	component: TasksPage,
});

function TasksPage() {
	const {
		data: tasks,
		isLoading,
		error,
	} = useQuery({
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
	const statusConfig = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.todo;
	const priorityConfig = TASK_PRIORITY_CONFIG[task.priority] ?? TASK_PRIORITY_CONFIG.medium;
	const StatusIcon = statusConfig.icon ?? Circle;

	return (
		<Link to="/tasks/$id" params={{ id: task.id.toString() }} className="block">
			<article className="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3 transition-colors hover:border-gray-600 hover:bg-gray-800">
				<StatusIcon size={20} className={statusConfig.color} />
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<h3 className="font-medium text-white">{task.title}</h3>
						<span className={`rounded px-1.5 py-0.5 text-xs ${priorityConfig.color}`}>
							{task.priority}
						</span>
					</div>

					{task.description && (
						<p className="mt-1 line-clamp-1 text-sm text-gray-400">{task.description}</p>
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
