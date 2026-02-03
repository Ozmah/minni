import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListTodo, Circle, CircleCheck, CircleDot, CircleX, Clock, AlertTriangle, FolderKanban, GitBranch } from "lucide-react";
import { api, type Task } from "@/lib/api";
import { Drawer } from "@/components/Drawer";

export const Route = createFileRoute("/tasks/$id")({
	component: TaskDetail,
});

function TaskDetail() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const { data: task, isLoading, error } = useQuery({
		queryKey: ["task", id],
		queryFn: () => api.task(Number(id)),
	});

	const handleClose = () => navigate({ to: "/tasks" });

	return (
		<Drawer open={true} onClose={handleClose} title={task?.title ?? "Task"}>
			{isLoading && <LoadingState />}
			{error && <ErrorState error={error} />}
			{task && <TaskContent task={task} />}
		</Drawer>
	);
}

function TaskContent({ task }: { task: Task }) {
	const statusConfig: Record<string, { color: string; label: string; icon: typeof Circle }> = {
		todo: { color: "bg-gray-500/20 text-gray-400", label: "To Do", icon: Circle },
		in_progress: { color: "bg-yellow-500/20 text-yellow-400", label: "In Progress", icon: CircleDot },
		done: { color: "bg-green-500/20 text-green-400", label: "Done", icon: CircleCheck },
		cancelled: { color: "bg-red-500/20 text-red-400", label: "Cancelled", icon: CircleX },
	};

	const priorityConfig: Record<string, { color: string; label: string }> = {
		high: { color: "bg-red-500/20 text-red-400", label: "High" },
		medium: { color: "bg-yellow-500/20 text-yellow-400", label: "Medium" },
		low: { color: "bg-gray-500/20 text-gray-400", label: "Low" },
	};

	const status = statusConfig[task.status] ?? { color: "bg-gray-500/20 text-gray-400", label: task.status, icon: Circle };
	const priority = priorityConfig[task.priority] ?? { color: "bg-gray-500/20 text-gray-400", label: task.priority };
	const StatusIcon = status.icon;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start gap-3">
				<div className="rounded-lg bg-gray-800 p-2">
					<ListTodo size={24} className="text-gray-400" />
				</div>
				<div className="flex-1">
					<h3 className="text-xl font-semibold text-white">{task.title}</h3>
					<div className="mt-1 flex items-center gap-2">
						<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
							<StatusIcon size={10} />
							{status.label}
						</span>
						<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${priority.color}`}>
							<AlertTriangle size={10} />
							{priority.label}
						</span>
					</div>
				</div>
			</div>

			{/* Description */}
			{task.description && (
				<Section title="Description">
					<div className="rounded-lg bg-gray-800/50 p-4">
						<p className="whitespace-pre-wrap text-sm text-gray-300">{task.description}</p>
					</div>
				</Section>
			)}

			{/* Relations */}
			<Section title="Relations">
				<div className="space-y-2">
					{task.projectId && (
						<InfoItem icon={FolderKanban} label="Project ID" value={String(task.projectId)} />
					)}
					{task.parentId && (
						<InfoItem icon={GitBranch} label="Parent Task ID" value={String(task.parentId)} />
					)}
					{!task.projectId && !task.parentId && (
						<p className="text-sm text-gray-500">No relations</p>
					)}
				</div>
			</Section>

			{/* Timestamps */}
			<Section title="Timestamps">
				<div className="grid grid-cols-2 gap-4 text-sm">
					<InfoItem icon={Clock} label="Created" value={formatDate(task.createdAt)} />
					<InfoItem icon={Clock} label="Updated" value={formatDate(task.updatedAt)} />
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
	return <div className="text-gray-400">Loading task...</div>;
}

function ErrorState({ error }: { error: Error }) {
	return <div className="text-red-400">Error: {error.message}</div>;
}
